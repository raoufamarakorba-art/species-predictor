from __future__ import annotations

from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers.datasets import router as datasets_router
from app.routers.inaturalist import router as inaturalist_router


app = FastAPI(title="Species Predictor API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.allowed_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(inaturalist_router)
app.include_router(datasets_router)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z",
        "backend": "fastapi",
    }


if settings.public_dir.exists():
    assets_dir = settings.public_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    async def index():
        return FileResponse(settings.public_dir / "index.html")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        requested = settings.public_dir / full_path
        if requested.is_file():
            return FileResponse(requested)
        return FileResponse(settings.public_dir / "index.html")
