from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse


router = APIRouter(prefix="/api/inaturalist", tags=["inaturalist"])
INAT_BASE = "https://api.inaturalist.org/v1"


async def fetch_inaturalist(path: str, params: dict[str, Any] | None = None) -> Any:
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(f"{INAT_BASE}{path}", params=params)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(f"iNaturalist API: {exc.response.status_code}") from exc
    except httpx.HTTPError as exc:
        raise RuntimeError(str(exc) or "iNaturalist API inaccessible") from exc


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
