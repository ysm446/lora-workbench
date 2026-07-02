# 変更履歴

新しいものを上に記載する。日付は `YYYY-MM-DD`。

## 2026-07-02

- frontend UI モックを追加（`frontend/`, Vite + React + TypeScript）。左ワークスペース
  (LoRA)サイドバー＋ステッパー＋Tag/Curate（グリッド＋下部タグバー）をダミーデータで実装。
- UI 骨格を確定し SPEC §9 / plan §7 に記録（左サイドバー＝LoRA 切替、Tag/Curate は
  グリッド＋下部タグバー・複数選択・一括操作）。
- 外部エンジンを `runtime/` 配下に集約する構成へ統一（`llama.cpp` / `kohya_ss` / `forge`）。
- `README.md` / `.gitignore` を追加。backend 用 `.venv`（Python 3.13）を作成。
- 仕様・計画ドキュメントを整備（SPEC を基に goal / plan をまとめ、CLAUDE を書き換え）。
- プロジェクト名を `lora-workbench` に確定。
