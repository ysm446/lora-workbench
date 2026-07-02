# CLAUDE.md

このファイルは Claude Code がこのリポジトリで作業する際のガイドです。

このリポジトリは **`lora-workbench`** — Illustrious (SDXL) 向けキャラ／画風 LoRA を、
データセット準備から学習・即時テスト・比較評価まで一気通貫で回すローカルデスクトップ
アプリです。詳細仕様は [`docs/SPEC.md`](docs/SPEC.md)。

## 作業開始時の確認

このプロジェクトで作業を始める前に、まず以下を確認する。

1. `docs/SPEC.md` — 全体仕様（唯一の詳細な仕様書）。
2. `docs/plan/goal.md` — プロジェクトの目的、完成形、重視する価値。
3. `docs/plan/plan.md` — 実装方針、アーキテクチャ、優先順位、MVP 段階。
4. `docs/plan/progress.md` — 現在の進捗、完了済み／未完了作業、注意点。

そのうえで、今回の依頼が現在の計画や進捗のどこに関係するかを把握してから作業する。
作業内容がこれらの方針と矛盾しそうな場合は、実装前に確認する。

> 注: 実装はまだ初期段階。以下のアーキテクチャは SPEC / plan に基づく **設計方針**であり、
> コードが追いついていない箇所がある。実態と食い違う場合はコードを正とし、このファイルと
> `docs/plan/` を更新する。

## 実行環境・開発コマンド

- **frontend** (`frontend/`): Node.js 18+ / Vite + React + TypeScript。現状は UI モック。
  - `cd frontend && npm install` → `npm run dev`（http://localhost:5173/）
  - `node_modules/` は git 管理外。
- **backend**: プロジェクト直下 `.venv`（Python 3.13）。**kohya の venv とは分離**する
  （kohya は `runtime/kohya_ss/.venv`）。
  - `py -3.13 -m venv .venv` → `.venv\Scripts\python -m pip install ...`
  - 依存はまだ未インストール。着手時に `fastapi` / `uvicorn` / `pillow` / `imagehash`、
    続いて `onnxruntime`（WD14）を導入する。
- 現在の進捗と次の作業は必ず [`docs/plan/progress.md`](docs/plan/progress.md) を見る。

## 設計の芯（最重要）

**車輪の再発明をしない。** 外部の重い処理はすべて独立プロセスとして HTTP / subprocess で
疎結合にし、backend はオーケストレーションに徹する。

- 学習エンジンは自作しない → **kohya_ss (sd-scripts)** を subprocess でラップ（専用 venv）
- 推論エンジンは自作しない → **WebUI Forge** の `/sdapi/v1` をラップ（diffusers を抱えない）
- タガー／VLM は自作しない → **WD14 (onnxruntime)** と **llama.cpp** をラップ
- クラウド学習・課金・マルチユーザ・リモート配信は対象外（ローカル完結）

## アーキテクチャ

| 層 | 実体 | 役割 |
|----|------|------|
| Frontend | Electron + React + TypeScript (Vite) | 画像ドロップ・タグ編集・学習監視・比較ギャラリー |
| Backend | FastAPI (Python) | REST API・subprocess 制御・状態管理 |
| 推論(LLM) | llama.cpp server（OpenAI 互換） | VLM captioning ＋ テキスト LLM による剪定 |
| タガー | WD14 tagger (onnxruntime) | Danbooru タグ生成 |
| 学習 | kohya_ss / sd-scripts（**専用 venv**） | `accelerate launch sdxl_train_network.py` |
| 生成 | WebUI Forge（`/sdapi/v1`） | LoRA 即時テスト・比較グリッド |
| 永続化 | ローカル FS ＋ SQLite | データセット・config・LoRA・サンプル・メタ |

### プロセス／GPU 分離（重要な設計）

- **kohya は専用 venv**。backend と Python 依存（torch / xformers）を共有しない。完全に
  外部プロセスとして扱う。
- llama.cpp / Forge も別プロセス。backend は起動・監視・HTTP 呼び出しのみ。スレッド／
  プロセスから直接 UI を触らない。通知は API / SSE 経由。
- **GPU はフェーズ排他**（MVP）: Phase A(tag) → Phase B(train) → Phase C(test) を単純ロック
  またはジョブキューで逐次化し、同時占有を防ぐ。将来（48GB 級）で部分同時常駐を検討。

### ローカル資産（models/ ・ runtime/）

- **`models/`**: ローカル LLM モデル（VLM / テキスト LLM の `.gguf` 等）をダウンロードして配置。
- **`runtime/`**: 外部エンジンのインストール先。engine ごとにサブフォルダを切る。
  ```
  runtime/
    llama.cpp/   # 推論(LLM)サーバー。backend が起動し models/ をロードして OpenAI 互換 API を提供
    kohya_ss/    # 学習エンジン。専用 venv は runtime/kohya_ss/.venv（backend venv と共有しない）
    forge/       # WebUI Forge（生成テスト）
  ```
- 両フォルダともマシン依存・大容量のため **git 管理外**（`.gitignore`）。初回セットアップ
  （ダウンロード／インストール）を担う仕組みは backend 側に用意する。

## データモデル

### FS レイアウト

```
projects/{project}/
  dataset/raw/                       # ドロップ元の原画像
  dataset/train/{repeats}_{concept}/ # kohya 入力形式（例: 10_mychar）
  captions/                          # {画像名}.txt（train 画像と同名）
  configs/{run}.toml
  output/{run}/                      # LoRA .safetensors + kohya サンプル
  eval/{run}/                        # Forge 生成テスト画像
  project.db                         # SQLite（プロジェクトごとに自己完結）
```

### SQLite スキーマ（概略）

- `projects(id, name, base_model, gen_model, created_at)`
- `images(id, project_id, path, wd_tags, vlm_caption, curated_caption, keep)`
- `runs(id, project_id, config_path, status, log_path, started_at, finished_at)`
- `samples(id, run_id, epoch, lora_weight, prompt, seed, image_path, source)` /
  `source ∈ {kohya, forge}`

## コアワークフロー（ステッパー型・基本一方向）

`Import → Tag → Curate → Build → Config → Train → Test → Evaluate`

1. **Import** — raw ドロップ → phash 重複除去 → 解像度／bucket 前提チェック
2. **Tag** — WD14 で booru タグ／（任意）VLM で自然文キャプション補完
3. **Curate** — 頻度分析＋テキスト LLM で剪定 → `curated_caption` → 人がレビュー
4. **Build** — repeats 設定 → `train/{repeats}_{concept}/` 構築＋`.txt` 書き出し
5. **Config** — Illustrious 向けデフォルトの学習 TOML 生成
6. **Train** — kohya subprocess 起動 → ログ SSE → epoch ごとに LoRA ＋サンプル
7. **Test** — Forge で固定プロンプト × epoch × weight × 固定 seed のグリッド生成
8. **Evaluate** — 比較ギャラリーで採用 epoch / weight を決定

## タグ付け・剪定（差別化の核・最優先）

タグ生成は専用タガーに任せ、**テキスト LLM は「編集者」に徹させる**。

- WD14 で客観タグ（信頼度閾値を設定可）
- **タグ頻度分析**: データセット全体で各タグの出現率を集計
  - 高出現（例 >80%）＝キャラ固有候補 → **剪定候補**（トリガーワードへ焼き込む）
  - 中／低出現＝状況依存 → **残す**（推論時に可変にできる要素）
- 剪定フロー: 頻度で候補抽出 → テキスト LLM が方針プロンプトで最終判断 → 人がレビュー
- トリガーワードを常にキャプション先頭へ挿入
- ブラックリスト一括除去（`watermark`, `signature`, `monochrome` など）
- Illustrious 前提: 自然文より Danbooru タグ優先（ハイブリッド時はタグ＋短い自然文）

## 学習統合（kohya_ss）

- 呼び出し: `accelerate launch sdxl_train_network.py --config_file {run}.toml
  --dataset_config {ds}.toml`
- **Illustrious 向け TOML デフォルト**: resolution 1024 / bucketing on /
  network_dim 16–32・alpha=dim/2 / optimizer Prodigy（自動 LR）または AdamW8bit /
  scheduler cosine（Prodigy 時 constant）/ unet_lr 1e-4・text_encoder_lr 0–5e-5 /
  save_every_n_epochs / sample_every_n_epochs ＋ sample_prompts。
  学習調整版 checkpoint 使用時は `noise_offset` 無効化。
- **kohya のバージョンを pin** し、引数差分を吸収する薄い adapter 層を backend に持つ
  （バージョン間で引数名が変わるため）。

## SD テスト統合（WebUI Forge）

- API: `/sdapi/v1/txt2img`, `/sdapi/v1/refresh-loras`, `/sdapi/v1/sd-models`
- 各 epoch で LoRA が出たら `refresh-loras` で読み込ませる
- Eval grid: 固定プロンプト × epoch × weight（`<lora:{name}:{w}>`）× 固定 seed
- 生成 checkpoint は実運用モデル（WAI / Ikastrious 等）を指定可＝本番相当のテスト
- kohya native サンプル（学習ベースモデル上）と Forge テスト（実運用モデル上）の 2 系統で確認

## MVP スコープ（段階）

- **v0（最優先）**: Import → Tag（WD14 ＋ VLM）→ Curate／剪定 → Build（フォルダ＋txt）
  → TOML 出力。学習は既存 kohya GUI に手渡し。
- **v1**: Train 統合（subprocess ＋ ログ SSE ＋ kohya サンプル）
- **v2**: Forge 即時テスト ＋ 比較ギャラリー
- **v3**: config sweep、DoRA／他ネットワーク対応、プリセット管理

> 品質の 8 割はデータセットで決まるため、**v0 のタグ付け・剪定パイプライン**を最優先で固める。

## ドキュメント運用

- 仕様は `docs/SPEC.md`、方針は `docs/plan/`（goal / plan / progress）に集約する。
- 変更履歴は `docs/changelog.md` に新しいものを上へ、日付は `YYYY-MM-DD`。
- 実装が方針とずれたら、コードを正としてこのファイルと `docs/plan/` を更新する。
