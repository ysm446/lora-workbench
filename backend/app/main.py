"""FastAPI アプリのエントリポイント。

起動: リポジトリ直下で
    .venv\\Scripts\\python -m uvicorn backend.app.main:app --reload
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import router

app = FastAPI(title="lora-workbench backend", version="0.0.1")

# frontend (Vite) からの呼び出しを許可
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "lora-workbench", "docs": "/docs"}
