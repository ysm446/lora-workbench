# 実装方針・計画

> 対象仕様は [`docs/SPEC.md`](../SPEC.md)、目的は [`goal.md`](goal.md) を参照。

## 1. アーキテクチャ方針

外部の重い処理はすべて **独立プロセス** として HTTP / subprocess で疎結合にする。
backend はオーケストレーションに徹する。

| 層 | 実体 | 役割 |
|----|------|------|
| Frontend | Electron + React + TypeScript (Vite) | 画像ドロップ・タグ編集・学習監視・比較ギャラリー |
| Backend | FastAPI (Python) | REST API・subprocess 制御・状態管理 |
| 推論(LLM) | llama.cpp server（OpenAI 互換） | VLM captioning ＋ テキスト LLM による剪定 |
| タガー | WD14 tagger (onnxruntime) | Danbooru タグ生成 |
| 学習 | kohya_ss / sd-scripts（**専用 venv**） | `accelerate launch sdxl_train_network.py` |
| 生成 | WebUI Forge（`/sdapi/v1`） | LoRA 即時テスト・比較グリッド |
| 永続化 | ローカル FS ＋ SQLite | データセット・config・LoRA・サンプル・メタ |

### プロセス／GPU 分離

- **kohya は専用 venv**。backend と Python 依存（torch / xformers）を共有しない。
- llama.cpp / Forge も別プロセス。backend は起動・監視・HTTP 呼び出しのみ。
- **GPU はフェーズ排他**（MVP）: tag → train → test を単純ロック／ジョブキューで
  逐次化し、同時占有を防ぐ。将来（48GB 級）で部分同時常駐を検討。

### ローカル資産（models/ ・ runtime/）

- **`models/`**: ローカル LLM モデル（VLM / テキスト LLM の `.gguf` 等）を
  ダウンロードして配置。
- **`runtime/`**: llama.cpp サーバー本体をダウンロード・インストール。
  backend が `runtime/` の実行ファイルを起動し、`models/` のモデルをロードして
  OpenAI 互換エンドポイントを提供する。
- 両フォルダともマシン依存・大容量のため **git 管理外**。初回セットアップ
  （ダウンロード／インストール）を担う仕組みは backend 側に用意する。

## 2. データモデル

### FS レイアウト

```
projects/{project}/
  dataset/raw/                       # ドロップ元の原画像
  dataset/train/{repeats}_{concept}/ # kohya 入力形式（例: 10_mychar）
  captions/                          # {画像名}.txt（train 画像と同名）
  configs/{run}.toml
  output/{run}/                      # LoRA .safetensors + kohya サンプル
  eval/{run}/                        # Forge 生成テスト画像
  project.db                         # SQLite
```

### SQLite スキーマ（概略）

- `projects(id, name, base_model, gen_model, created_at)`
- `images(id, project_id, path, wd_tags, vlm_caption, curated_caption, keep)`
- `runs(id, project_id, config_path, status, log_path, started_at, finished_at)`
- `samples(id, run_id, epoch, lora_weight, prompt, seed, image_path, source)` /
  `source ∈ {kohya, forge}`

## 3. コアワークフロー

1. **Import** — raw ドロップ → phash 重複除去 → 解像度／bucket 前提チェック
2. **Tag** — WD14 で booru タグ／（任意）VLM で自然文キャプション補完
3. **Curate** — 頻度分析＋テキスト LLM で剪定 → `curated_caption` → 人がレビュー
4. **Build** — repeats 設定 → `train/{repeats}_{concept}/` 構築＋`.txt` 書き出し
5. **Config** — Illustrious 向けデフォルトの TOML 生成
6. **Train** — kohya subprocess 起動 → ログ SSE → epoch ごとに LoRA ＋サンプル
7. **Test** — Forge で固定プロンプト × epoch × weight × 固定 seed のグリッド生成
8. **Evaluate** — 比較ギャラリーで採用 epoch / weight を決定

## 4. タグ付け・剪定（差別化の核・最優先）

タグ生成は専用タガーに任せ、テキスト LLM は「編集者」に徹させる。

- WD14 で客観タグ（信頼度閾値を設定可）
- **タグ頻度分析**: データセット全体で各タグの出現率を集計
  - 高出現（例 >80%）＝キャラ固有候補 → **剪定候補**（トリガーワードへ焼き込む）
  - 中／低出現＝状況依存 → **残す**（推論時に可変にできる要素）
- 剪定フロー: 頻度で候補抽出 → テキスト LLM が方針プロンプトで最終判断 → 人がレビュー
- トリガーワードを常にキャプション先頭へ挿入
- ブラックリスト一括除去（`watermark`, `signature`, `monochrome` など）
- Illustrious 前提: 自然文より Danbooru タグ優先（ハイブリッド時はタグ＋短い自然文）

## 5. 学習統合（kohya_ss）の方針

- 呼び出し: `accelerate launch sdxl_train_network.py --config_file {run}.toml
  --dataset_config {ds}.toml`
- **Illustrious 向け TOML デフォルト**: resolution 1024 / bucketing on /
  network_dim 16–32・alpha=dim/2 / optimizer Prodigy（自動 LR）または AdamW8bit /
  scheduler cosine（Prodigy 時 constant）/ unet_lr 1e-4・text_encoder_lr 0–5e-5 /
  save_every_n_epochs / sample_every_n_epochs ＋ sample_prompts。
  学習調整版 checkpoint 使用時は `noise_offset` 無効化。
- **kohya のバージョンを pin** し、引数差分を吸収する薄い adapter 層を backend に持つ。

## 6. SD テスト統合（WebUI Forge）の方針

- API: `/sdapi/v1/txt2img`, `/sdapi/v1/refresh-loras`, `/sdapi/v1/sd-models`
- 各 epoch で LoRA が出たら `refresh-loras` で読み込ませる
- Eval grid: 固定プロンプト × epoch × weight（`<lora:{name}:{w}>`）× 固定 seed
- 生成 checkpoint は実運用モデル（WAI / Ikastrious 等）を指定可＝本番相当のテスト
- kohya native サンプル（学習ベースモデル上）と Forge テスト（実運用モデル上）の
  2 系統で確認

## 7. UI 方針

- **ステッパー型**（Import → Tag → Curate → Build → Train → Test）。基本一方向のため
  ノードグラフより素直。
- タグエディタ: 画像とタグを並列表示、剪定候補をハイライト、一括操作
- 学習モニタ: ログストリーム、loss、進捗
- 比較ギャラリー: epoch × weight の XY グリッド（独立画面、v2）

## 8. 優先順位・段階（MVP スコープ）

- **v0（最優先）**: Import → Tag（WD14 ＋ VLM）→ Curate／剪定 → Build（フォルダ＋txt）
  → TOML 出力。学習は既存 kohya GUI に手渡し。
- **v1**: Train 統合（subprocess ＋ ログ SSE ＋ kohya サンプル）
- **v2**: Forge 即時テスト ＋ 比較ギャラリー
- **v3**: config sweep、DoRA／他ネットワーク対応、プリセット管理

> 品質の 8 割はデータセットで決まるため、**v0 のタグ付け・剪定パイプライン**を
> 最優先で固める。

## 9. 未決事項（SPEC §12）

- WD14 を backend 内蔵にするか別プロセスにするか
- 剪定閾値のデフォルト値とプリセット設計
- GPU 同時占有をどこまで許すか（フェーズ排他 vs 部分同時）
- Forge を常駐させるかオンデマンド起動にするか
- ~~プロジェクト名の確定~~ → `lora-workbench` に確定
- `models/` ・ `runtime/` への自動ダウンロード／インストール手段の具体化
