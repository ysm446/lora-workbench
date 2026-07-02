"""プロジェクトの作成・一覧・取得。

1 プロジェクト = 1 LoRA = projects/{id}/ ディレクトリ（自己完結の project.db を持つ）。
一覧は projects/ の走査で得る（FS が真実）。
"""

from __future__ import annotations

from datetime import datetime, timezone

from . import config, database
from .models import Project, ProjectCreate

# 作成時に用意するサブディレクトリ（train は Build 時に repeats 付きで作る）
SUBDIRS = ["dataset/raw", "dataset/train", "captions", "configs", "output", "eval"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def create_project(data: ProjectCreate) -> Project:
    project_id = config.slugify(data.name)
    pdir = config.project_dir(project_id)
    if pdir.exists():
        raise FileExistsError(project_id)

    for sub in SUBDIRS:
        (pdir / sub).mkdir(parents=True, exist_ok=True)

    db_path = config.project_db_path(project_id)
    database.init_db(db_path)

    conn = database.connect(db_path)
    try:
        conn.execute(
            "INSERT INTO project (id, name, base_model, gen_model, created_at)"
            " VALUES (?, ?, ?, ?, ?)",
            (project_id, data.name, data.base_model, data.gen_model, _now()),
        )
        conn.commit()
    finally:
        conn.close()

    return get_project(project_id)


def list_projects() -> list[Project]:
    result: list[Project] = []
    for pdir in sorted(config.projects_dir().iterdir()):
        if not (pdir / "project.db").exists():
            continue
        p = _load(pdir.name)
        if p is not None:
            result.append(p)
    return result


def get_project(project_id: str) -> Project:
    p = _load(project_id)
    if p is None:
        raise FileNotFoundError(project_id)
    return p


def _load(project_id: str) -> Project | None:
    db_path = config.project_db_path(project_id)
    if not db_path.exists():
        return None
    conn = database.connect(db_path)
    try:
        row = conn.execute("SELECT * FROM project LIMIT 1").fetchone()
        if row is None:
            return None
        count = conn.execute("SELECT COUNT(*) AS c FROM images").fetchone()["c"]
    finally:
        conn.close()

    return Project(
        id=row["id"],
        name=row["name"],
        base_model=row["base_model"],
        gen_model=row["gen_model"],
        created_at=row["created_at"],
        image_count=count,
    )
