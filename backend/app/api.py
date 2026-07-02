"""REST エンドポイント（/api）。"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from . import services
from .models import Project, ProjectCreate

router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/projects", response_model=list[Project])
def list_projects() -> list[Project]:
    return services.list_projects()


@router.post("/projects", response_model=Project, status_code=201)
def create_project(data: ProjectCreate) -> Project:
    try:
        return services.create_project(data)
    except FileExistsError:
        raise HTTPException(status_code=409, detail="project already exists")


@router.get("/projects/{project_id}", response_model=Project)
def get_project(project_id: str) -> Project:
    try:
        return services.get_project(project_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="project not found")
