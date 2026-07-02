-- lora-workbench: プロジェクトごとの自己完結 DB スキーマ。
-- FS が真実、DB は再スキャンで再構築できる索引という位置づけ。

CREATE TABLE IF NOT EXISTS project (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  base_model  TEXT,
  gen_model   TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS images (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id       TEXT NOT NULL,
  path             TEXT NOT NULL,          -- プロジェクト相対 POSIX パス
  phash            TEXT,                   -- 重複除去用 perceptual hash
  width            INTEGER,
  height           INTEGER,
  wd_tags          TEXT,                   -- WD14 タグ（JSON 文字列）
  vlm_caption      TEXT,                   -- VLM 自然文キャプション
  curated_caption  TEXT,                   -- 剪定後の最終キャプション
  keep             INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_images_project ON images(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_images_path ON images(path);

CREATE TABLE IF NOT EXISTS runs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id   TEXT NOT NULL,
  config_path  TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
  log_path     TEXT,
  started_at   TEXT,
  finished_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_project ON runs(project_id);

CREATE TABLE IF NOT EXISTS samples (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id       INTEGER NOT NULL,
  epoch        INTEGER,
  lora_weight  REAL,
  prompt       TEXT,
  seed         INTEGER,
  image_path   TEXT,
  source       TEXT CHECK(source IN ('kohya', 'forge'))
);
CREATE INDEX IF NOT EXISTS idx_samples_run ON samples(run_id);
