# 進捗

最終更新: 2026-07-02

## 全体ステータス

**設計・UI モック段階。** backend / 実データ処理は未着手。方針は [`goal.md`](goal.md) /
[`plan.md`](plan.md)、仕様は [`../SPEC.md`](../SPEC.md) を参照。

## 完了済み

- ドキュメント整備: SPEC / goal / plan / progress / README / CLAUDE / AGENTS
- プロジェクト名を `lora-workbench` に確定
- リポジトリ方針を確定
  - 外部エンジンは `runtime/` 配下に集約（`llama.cpp` / `kohya_ss` / `forge`）
  - ローカル LLM モデルは `models/`（いずれも git 管理外）
  - `.gitignore` 整備
- **UI 骨格を確定**（SPEC §9 / plan §7 に記録）
  - 左＝ワークスペース(LoRA)サイドバー ／ 右＝ステッパー＋作業画面
  - Tag/Curate 画面: サムネイル・グリッド＋下部タグバー（複数選択・一括操作）
- **frontend UI モック**（`frontend/`, Vite + React + TS）: ダミーデータで骨格を実装・確認済み
  - 起動: `cd frontend && npm run dev` → http://localhost:5173/
  - まだ静的モック（API 未配線・ボタン未実装）
- backend 用 venv 作成: プロジェクト直下 `.venv`（Python 3.13.11）。依存は未インストール

## 未着手 / 次の作業（v0 を最優先）

v0 = Import → Tag → Curate/剪定 → Build → TOML 出力。

1. **backend 土台**: FastAPI 雛形 ＋ SQLite スキーマ（`projects`/`images`/`runs`/`samples`）
   ＋ プロジェクト FS レイアウト生成
2. **Import**: raw ドロップ → phash 重複除去 → 解像度／bucket 前提チェック
3. **Tag**: WD14 (onnxruntime) 連携で booru タグ生成 →（任意）VLM(llama.cpp)
4. **Curate**: タグ頻度分析 ＋ テキスト LLM 剪定 → 人がレビュー
5. **Build / Config**: `train/{repeats}_{concept}/` ＋ `.txt` 生成 → Illustrious 向け TOML 出力
6. **frontend の API 配線**: モックを backend に接続（ダミー → 実データ）

その後 v1（Train 統合）→ v2（Forge テスト＋比較ギャラリー）。

## 注意点 / 保留事項

- backend 依存はまだ未インストール（`.venv` は空）。着手時に `fastapi` / `uvicorn` /
  `pillow` / `imagehash`（Import）、続いて `onnxruntime`（WD14）を入れる。
- Electron ラップは未着手（現状は Vite の browser preview で確認）。
- GPU ベンダー未確認（NVIDIA 前提なら WD14/kohya を GPU 版に）。
- SPEC §12 の未決事項（WD14 内蔵 or 別プロセス、剪定閾値の既定値、GPU 同時占有、
  Forge 常駐 or オンデマンド）は実装時に順次確定する。
