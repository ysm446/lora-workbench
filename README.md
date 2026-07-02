# lora-workbench

Illustrious (SDXL) 向けのキャラ／画風 **LoRA を、データセット準備から学習・即時テスト・
比較評価まで一気通貫で回す**ローカルデスクトップアプリ。

参照画像をドロップするだけで、次の一連の流れを一つのアプリ内で回せることを目指す。

```
Import → 自動タグ付け → タグ剪定 → データセット構築 → 学習 → 生成テスト → 比較評価
```

「学習して終わり」ではなく、**学習直後に実運用モデルで生成して、採用する epoch / weight を
その場で決める**ところまでを閉じたループにするのが主眼。

## 設計の芯

**車輪の再発明をしない。** 実績ある外部ツールを独立プロセスとして疎結合にラップし、
本体（backend）はオーケストレーションに徹する。

- 学習エンジン → **kohya_ss (sd-scripts)** を subprocess でラップ（専用 venv）
- 推論エンジン → **WebUI Forge** の `/sdapi/v1` をラップ
- タガー／VLM → **WD14 (onnxruntime)** と **llama.cpp** をラップ

クラウド学習・課金・マルチユーザ・リモート配信は対象外（ローカル完結）。

## アーキテクチャ

| 層 | 実体 | 役割 |
|----|------|------|
| Frontend | Electron + React + TypeScript (Vite) | 画像ドロップ・タグ編集・学習監視・比較ギャラリー |
| Backend | FastAPI (Python) | REST API・subprocess 制御・状態管理 |
| 推論(LLM) | llama.cpp server（OpenAI 互換） | VLM captioning ＋ テキスト LLM による剪定 |
| タガー | WD14 tagger (onnxruntime) | Danbooru タグ生成 |
| 学習 | kohya_ss / sd-scripts（専用 venv） | `accelerate launch sdxl_train_network.py` |
| 生成 | WebUI Forge（`/sdapi/v1`） | LoRA 即時テスト・比較グリッド |
| 永続化 | ローカル FS ＋ SQLite | データセット・config・LoRA・サンプル・メタ |

詳細は [`docs/SPEC.md`](docs/SPEC.md) を参照。

## リポジトリ構成

```
docs/
  SPEC.md            # 全体仕様（唯一の詳細な仕様書）
  changelog.md       # 変更履歴
  plan/
    goal.md          # 目的・完成形・重視する価値
    plan.md          # 実装方針・アーキテクチャ・優先順位
    progress.md      # 進捗
frontend/            # UI（Electron + React + TypeScript, Vite）※現在は UI モック
CLAUDE.md            # Claude Code 向け作業ガイド
AGENTS.md            # エージェント向けルール

# git 管理外（ローカルに用意）
models/              # ローカル LLM モデル（VLM / テキスト LLM の .gguf 等）
runtime/             # 外部エンジンのインストール先
  llama.cpp/         #   推論(LLM)サーバー
  kohya_ss/          #   学習エンジン（専用 venv は runtime/kohya_ss/.venv）
  forge/             #   WebUI Forge（生成テスト）
projects/            # プロジェクトごとのデータセット・config・LoRA・出力
```

`models/` と `runtime/` は大容量・マシン依存のため git 管理外。外部エンジン
（llama.cpp / kohya_ss / WebUI Forge）は `runtime/` 配下にダウンロード・インストールする。
初回セットアップは backend 側の仕組みで用意する。

## ワークフロー

ステッパー型（基本一方向）で以下を回す。

1. **Import** — raw 画像ドロップ → phash 重複除去 → 解像度／bucket 前提チェック
2. **Tag** — WD14 で booru タグ／（任意）VLM で自然文キャプション補完
3. **Curate** — タグ頻度分析＋テキスト LLM で剪定 → 人がレビュー（human-in-the-loop）
4. **Build** — repeats 設定 → kohya 入力形式（`train/{repeats}_{concept}/`＋`.txt`）を構築
5. **Config** — Illustrious 向けデフォルトの学習 TOML を生成
6. **Train** — kohya を subprocess 起動 → ログ配信 → epoch ごとに LoRA ＋サンプル
7. **Test** — Forge で固定プロンプト × epoch × weight × 固定 seed のグリッド生成
8. **Evaluate** — 比較ギャラリーで採用 epoch / weight を決定

> 品質の 8 割はデータセットで決まるため、タグ付け・剪定パイプラインを最優先で固める。

## 開発段階（MVP スコープ）

- **v0（最優先）**: Import → Tag → Curate／剪定 → Build → TOML 出力（学習は既存 kohya GUI に手渡し）
- **v1**: Train 統合（subprocess ＋ ログ配信 ＋ kohya サンプル）
- **v2**: Forge 即時テスト ＋ 比較ギャラリー
- **v3**: config sweep、DoRA／他ネットワーク対応、プリセット管理

## 開発の始め方

前提: Node.js 18+ / Python 3.13。

```bash
# frontend（現状は UI モック）
cd frontend
npm install
npm run dev            # → http://localhost:5173/

# backend（venv。依存は着手時に導入）
py -3.13 -m venv .venv                       # 未作成なら
.venv\Scripts\python -m pip install -U pip
# 例: .venv\Scripts\python -m pip install fastapi "uvicorn[standard]" pillow imagehash
```

## ステータス

**設計・UI モック段階。** frontend にダミーデータで動く UI モックあり
（`cd frontend && npm run dev`）。backend / 実データ処理は未着手。次は v0（Import → Tag →
Curate → Build → TOML）の backend 土台から。進捗は [`docs/plan/progress.md`](docs/plan/progress.md)。
