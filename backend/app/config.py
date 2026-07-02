"""パス解決とプロジェクト名のスラッグ化。

プロジェクトは <repo>/projects/{id}/ に自己完結で置く（各ディレクトリに project.db）。
保存先は環境変数 LORA_WORKBENCH_PROJECTS_DIR で上書きできる（テスト・配布用）。
"""

from __future__ import annotations

import os
import re
from pathlib import Path

# backend/app/config.py -> parents[2] がリポジトリルート
REPO_ROOT = Path(__file__).resolve().parents[2]

_slug_re = re.compile(r"[^a-zA-Z0-9_-]+")


def projects_dir() -> Path:
    override = os.environ.get("LORA_WORKBENCH_PROJECTS_DIR")
    base = Path(override) if override else REPO_ROOT / "projects"
    base.mkdir(parents=True, exist_ok=True)
    return base


def slugify(name: str) -> str:
    """表示名から安全なディレクトリ名（= プロジェクト id）を作る。"""
    s = _slug_re.sub("_", name.strip()).strip("_")
    return s or "project"


def project_dir(project_id: str) -> Path:
    return projects_dir() / project_id


def project_db_path(project_id: str) -> Path:
    return project_dir(project_id) / "project.db"
