from __future__ import annotations

from time import monotonic
from typing import Any

import httpx
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.config import settings


router = APIRouter(prefix="/api/inaturalist", tags=["inaturalist"])
INAT_BASE = "https://api.inaturalist.org/v1"
_cache: dict[tuple[str, tuple[tuple[str, str], ...]], tuple[float, Any]] = {}


def make_cache_key(path: str, params: dict[str, Any] | None = None) -> tuple[str, tuple[tuple[str, str], ...]]:
    normalized = tuple(sorted((str(key), str(value)) for key, value in (params or {}).items()))
    return path, normalized


async def fetch_inaturalist(path: str, params: dict[str, Any] | None = None) -> Any:
    cache_key = make_cache_key(path, params)
    now = monotonic()
    ttl = settings.inaturalist_cache_ttl_seconds

    if ttl > 0 and cache_key in _cache:
        cached_at, cached_payload = _cache[cache_key]
        if now - cached_at < ttl:
            return cached_payload

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(f"{INAT_BASE}{path}", params=params)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(f"iNaturalist API: {exc.response.status_code}") from exc
    except httpx.HTTPError as exc:
        raise RuntimeError(str(exc) or "iNaturalist API inaccessible") from exc

    if ttl > 0:
        _cache[cache_key] = (now, payload)

    return payload


@router.get("/cache/status")
async def cache_status():
    return {
        "entries": len(_cache),
        "ttlSeconds": settings.inaturalist_cache_ttl_seconds,
    }


@router.get("/observations")
async def observations(
    taxon_name: str = "",
    place_name: str | None = None,
    per_page: int = Query(default=200, ge=1),
    taxon_id: str | None = None,
):
    params: dict[str, Any] = {
        "taxon_name": taxon_name,
        "per_page": min(per_page, 200),
        "order": "desc",
        "order_by": "created_at",
        "quality_grade": "research",
    }
    if place_name:
        params["place_name"] = place_name
    if taxon_id:
        params["taxon_id"] = taxon_id

    try:
        return await fetch_inaturalist("/observations", params)
    except RuntimeError as exc:
        return JSONResponse(status_code=502, content={"error": str(exc)})


@router.get("/taxa/autocomplete")
async def taxa_autocomplete(q: str = ""):
    params = {
        "q": q,
        "per_page": "8",
        "is_active": "true",
    }

    try:
        return await fetch_inaturalist("/taxa/autocomplete", params)
    except RuntimeError as exc:
        return JSONResponse(status_code=502, content={"error": str(exc)})


@router.get("/taxa/{taxon_id}/summary")
async def taxon_summary(taxon_id: str):
    try:
        return await fetch_inaturalist(f"/taxa/{taxon_id}")
    except RuntimeError as exc:
        return JSONResponse(status_code=502, content={"error": str(exc)})
