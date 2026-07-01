# lora-workbench — SPEC

> `lora-workbench`（lowercase-hyphenated）。Illustrious (SDXL) 向けキャラ／画風 LoRA を、データセット準備から学習・即時テストまで一気通貫で回すローカルデスクトップアプリ。

## 1. ゴール

参照画像をドロップするだけで、次の一連を一つのアプリ内で回せること。

Import → 自動タグ付け → タグ剪定 → 学習用データセット構築 → 学習 → 生成テスト → 比較評価

「学習して終わり」ではなく「学習直後に実運用モデルで生成して、採用する epoch / weight をその場で決める」までを閉じたループにするのが主眼。

## 2. 非ゴール（重要）

車輪の再発明をしないことを設計の芯に置く。

- 学習エンジンを自作しない → **kohya_ss (sd-scripts)** を subprocess でラップ
- 推論エンジンを自作しない → **WebUI Forge** の `/sdapi/v1` をラップ（diffusers を backend に抱えない）
- タガー／VLM を自作しない → **WD14 (onnxruntime)** と **llama.cpp** をラップ
- クラウド学習、課金、マルチユーザ、リモート配信は対象外

## 3. アーキテクチャ

外部の重い処理はすべて独立プロセスとして HTTP / subprocess で疎結合にする。backend はオーケストレーションに徹する。

### コンポーネント

| 層 | 実体 | 役割 |
|----|------|------|
| Frontend | Electron + React + TypeScript (Vite) | 画像ドロップ・タグ編集・学習監視・比較ギャラリー |
| Backend | FastAPI (Python) | REST API・subprocess 制御・状態管理 |
| 推論(LLM) | llama.cpp server (OpenAI 互換) | VLM captioning + テキスト LLM による剪定 |
| タガー | WD14 tagger (onnxruntime) | Danbooru タグ生成 |
| 学習 | kohya_ss / sd-scripts（**専用 venv**） | `accelerate launch sdxl_train_network.py` |
| 生成 | WebUI Forge（`/sdapi/v1`） | LoRA 即時テスト・比較グリッド生成 |
| 永続化 | ローカル FS + SQLite | データセット・config・LoRA・サンプル・メタ |

### プロセス／GPU 分離方針

- **kohya は専用 venv。** backend と Python 依存（torch / xformers）を共有しない。完全に外部プロセスとして扱う。
- llama.cpp / Forge も別プロセス。backend は起動・監視・HTTP 呼び出しのみ。
- **GPU はフェーズ排他**（MVP）:
  - Phase A（tag）: VLM ロード → タグ付け → アンロード
  - Phase B（train）: kohya が GPU を占有
  - Phase C（test）: Forge ロード → 生成
  - 単純ロックまたはジョブキューで同時占有を防ぐ。48GB なら一部同時常駐も可能だが、MVP では排他で単純化。

## 4. データモデル

### ファイルシステム・レイアウト

```
models/                           # ローカル LLM モデル（VLM / テキスト LLM の .gguf 等）※git 管理外
runtime/                          # 外部エンジンのインストール先 ※git 管理外
  llama.cpp/                      #   推論(LLM)サーバー
  kohya_ss/                       #   学習エンジン（専用 venv: runtime/kohya_ss/.venv）
  forge/                          #   WebUI Forge（生成テスト）

projects/{project}/
  dataset/
    raw/                          # ドロップ元の原画像
    train/{repeats}_{concept}/    # kohya 入力形式（例: 10_mychar）
  captions/                       # {画像名}.txt（train 画像と同名）
  configs/{run}.toml
  output/{run}/                   # LoRA .safetensors + kohya サンプル
  eval/{run}/                     # Forge 生成テスト画像
  project.db                      # SQLite
```

### SQLite スキーマ（概略）

- `projects(id, name, base_model, gen_model, created_at)`
- `images(id, project_id, path, wd_tags, vlm_caption, curated_caption, keep)`
- `runs(id, project_id, config_path, status, log_path, started_at, finished_at)`
- `samples(id, run_id, epoch, lora_weight, prompt, seed, image_path, source)`
  - `source ∈ {kohya, forge}`

## 5. コアワークフロー

1. **Import** — raw 画像ドロップ → 重複除去（phash）→ 解像度／bucket 前提チェック
2. **Tag** — WD14 で booru タグ生成／（任意）VLM で自然文キャプション補完
3. **Curate** — 剪定エンジン（§6）で `curated_caption` を生成 → タグエディタで人がレビュー
4. **Build** — repeats を設定 → `train/{repeats}_{concept}/` を構築し `.txt` を書き出し
5. **Config** — TOML を生成（§7）
6. **Train** — kohya を subprocess 起動 → ログを SSE 配信 → epoch ごとに LoRA + kohya サンプル
7. **Test** — Forge で固定プロンプト × epoch × weight のグリッド生成（§8）
8. **Evaluate** — 比較ギャラリーで採用 epoch / weight を決定

## 6. タグ付け・剪定スペック（差別化の核）

タグ生成そのものは専用タガーに任せ、テキスト LLM は「編集者」に徹させる。

- WD14 で客観タグを生成（信頼度閾値を設定可）
- **タグ頻度分析**: データセット全体で各タグの出現率を集計
  - 高出現（例 > 80%）= キャラ固有候補 → **剪定候補**（トリガーワードに焼き込む）
  - 中／低出現 = 状況依存 → **残す**（推論時に可変にできる要素）
- **剪定フロー**: 頻度で候補抽出 → テキスト LLM が方針プロンプトに沿って最終判断 → 人がレビュー（human-in-loop）
- トリガーワードを常にキャプション先頭へ挿入
- ブラックリスト一括除去（`watermark`, `signature`, `monochrome` など）
- Illustrious 前提: 自然文より Danbooru タグ優先。ハイブリッド時はタグ + 短い自然文

## 7. 学習統合（kohya_ss）

- 呼び出し: `accelerate launch sdxl_train_network.py --config_file {run}.toml --dataset_config {ds}.toml`
- TOML を生成。**Illustrious 向けデフォルト**:
  - base_model: `Illustrious-XL-v2.0`（または学習調整版）
  - resolution 1024 / bucketing on
  - network_dim 16–32 / network_alpha = dim/2
  - optimizer: Prodigy（自動 LR）または AdamW8bit
  - scheduler: cosine（Prodigy 時は constant）
  - unet_lr 1e-4 / **text_encoder_lr 0–5e-5**（破滅的忘却対策で低め or 切る）
  - save_every_n_epochs（全 epoch を比較対象にするため）
  - sample_every_n_epochs + sample_prompts（kohya native サンプル）
  - 注意: 学習調整版 checkpoint 使用時は `noise_offset` を無効化
- **kohya のバージョンを pin** し、引数差分を吸収する薄い adapter 層を backend に持つ（バージョン間で引数名が変わるため）。

## 8. SD テスト統合（WebUI Forge）

- Forge API: `/sdapi/v1/txt2img`, `/sdapi/v1/refresh-loras`, `/sdapi/v1/sd-models`
- 学習完了／各 epoch で `output/` に LoRA が出たら `refresh-loras` で読み込ませる
- **Eval grid**: 固定プロンプトセット × epoch × weight（`<lora:{name}:{w}>`）× 固定 seed
- 生成 checkpoint は実運用モデル（WAI / Ikastrious 等）を指定可 = 本番相当のテスト
- kohya native サンプル（学習ベースモデル上）と Forge テスト（実運用モデル上）の 2 系統で確認

## 9. UI

- **ステッパー型**（Import → Tag → Curate → Build → Train → Test）。この処理は基本的に一方向なのでノードグラフより素直。
- **タグエディタ**: 画像とタグを並列表示、剪定候補をハイライト、一括操作
- **学習モニタ**: ログストリーム、loss、進捗
- **比較ギャラリー**: epoch × weight の XY グリッド（独立画面、v2）

## 10. 技術スタック

Electron + React + TypeScript (Vite) / FastAPI (Python) / SQLite / onnxruntime / llama.cpp / kohya_ss (sd-scripts) / WebUI Forge

## 11. MVP スコープ（段階）

- **v0**: Import → Tag（WD14 + VLM）→ Curate／剪定 → Build（フォルダ + txt）→ TOML 出力。学習は既存 kohya GUI に手渡し。
- **v1**: Train 統合（subprocess + ログ SSE + kohya サンプル）
- **v2**: Forge 即時テスト + 比較ギャラリー
- **v3**: config sweep、DoRA／他ネットワーク対応、プリセット管理

品質の 8 割はデータセットで決まるため、v0 のタグ付け・剪定パイプラインを最優先で固める。

## 12. 未決事項

- WD14 を backend 内蔵にするか別プロセスにするか
- 剪定閾値のデフォルト値とプリセット設計
- GPU 同時占有をどこまで許すか（フェーズ排他 vs 部分同時）
- Forge を常駐させるかオンデマンド起動にするか
- ~~プロジェクト名の確定~~ → `lora-workbench` に確定
