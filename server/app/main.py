from __future__ import annotations

from datetime import datetime, timezone
from time import monotonic
from typing import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers.datasets import router as datasets_router
from app.routers.inaturalist import router as inaturalist_router
from app.routers.predict import router as predict_router


app = FastAPI(title="Species Predictor API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.allowed_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

predict_hits: dict[str, list[float]] = {}


@app.middleware("http")
async def rate_limit_predict(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    if request.url.path.rstrip("/") == "/api/predict" and request.method == "POST":
        client = request.client.host if request.client else "unknown"
        now = monotonic()
        recent = [hit for hit in predict_hits.get(client, []) if now - hit < 60]
        if len(recent) >= 20:
            return JSONResponse(
                status_code=429,
                content={"error": "Trop de requêtes, attendez une minute."},
            )
        recent.append(now)
        predict_hits[client] = recent

    return await call_next(request)


app.include_router(predict_router)
app.include_router(inaturalist_router)
app.include_router(datasets_router)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "ollama": settings.ollama_url,
        "model": settings.ollama_model,
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
