"""API スキーマ（pydantic）。"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    base_model: str = "Illustrious-XL-v2.0"
    gen_model: str | None = None


class Project(BaseModel):
    id: str
    name: str
    base_model: str | None = None
    gen_model: str | None = None
    created_at: str
    image_count: int = 0
