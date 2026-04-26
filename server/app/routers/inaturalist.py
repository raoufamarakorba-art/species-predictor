from __future__ import annotations

import re
from time import monotonic
from typing import Any
from unicodedata import combining, normalize

import httpx
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.config import settings


router = APIRouter(prefix="/api/inaturalist", tags=["inaturalist"])
INAT_BASE = "https://api.inaturalist.org/v1"
_cache: dict[tuple[str, tuple[tuple[str, str], ...]], tuple[float, Any]] = {}
PLACE_CONNECTOR_RE = re.compile(
    r"^(.+?)\s+(?:d['’]\s*|de\s+l['’]\s*|de\s+la\s+|de\s+|du\s+|des\s+|en\s+|dans\s+|à\s+|a\s+|in\s+)(.+)$",
    re.IGNORECASE,
)
PLACE_ARTICLE_RE = re.compile(r"^(?:l['’]\s*|la\s+|le\s+|les\s+|the\s+)", re.IGNORECASE)


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


def normalize_search_value(value: str) -> str:
    folded = normalize("NFKD", value.casefold())
    return "".join(char for char in folded if not combining(char)).strip()


def clean_place_name(value: str) -> str:
    return PLACE_ARTICLE_RE.sub("", value.strip(" \t\n\r,;")).strip()


def split_taxon_place_query(taxon_name: str, place_name: str | None = None) -> tuple[str, str | None]:
    taxon = taxon_name.strip()
    place = clean_place_name(place_name or "")
    if place:
        return taxon, place

    if "," in taxon:
        left, right = (part.strip() for part in taxon.split(",", 1))
        if left and right:
            return left, clean_place_name(right)

    match = PLACE_CONNECTOR_RE.match(taxon)
    if match:
        return match.group(1).strip(), clean_place_name(match.group(2))

    return taxon, None


def pick_taxon_result(results: list[dict[str, Any]], taxon_name: str) -> dict[str, Any] | None:
    if not results:
        return None

    target = normalize_search_value(taxon_name)
    for result in results:
        candidates = [
            result.get("name"),
            result.get("preferred_common_name"),
            result.get("matched_term"),
        ]
        if any(isinstance(candidate, str) and normalize_search_value(candidate) == target for candidate in candidates):
            return result

    return results[0]


def minimal_taxon(taxon: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": taxon.get("id"),
        "name": taxon.get("name"),
        "rank": taxon.get("rank"),
        "preferred_common_name": taxon.get("preferred_common_name"),
        "iconic_taxon_name": taxon.get("iconic_taxon_name"),
        "default_photo": taxon.get("default_photo"),
    }


async def resolve_taxon(taxon_name: str) -> dict[str, Any] | None:
    if not taxon_name:
        return None

    payload = await fetch_inaturalist(
        "/taxa/autocomplete",
        {"q": taxon_name, "per_page": "10", "is_active": "true"},
    )
    result = pick_taxon_result(payload.get("results", []), taxon_name)
    return minimal_taxon(result) if result else None


def pick_place_result(results: list[dict[str, Any]], place_name: str) -> dict[str, Any] | None:
    target = normalize_search_value(place_name)
    for result in results:
        if result.get("type") != "Place":
            continue

        record = result.get("record") or {}
        candidates = [
            record.get("name"),
            record.get("display_name"),
            record.get("matched_term"),
            result.get("matched_term"),
            *(result.get("matches") or []),
        ]
        if any(isinstance(candidate, str) and normalize_search_value(candidate) == target for candidate in candidates):
            return record

    for result in results:
        if result.get("type") == "Place" and result.get("record", {}).get("id"):
            return result["record"]

    return None


def minimal_place(place: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": place.get("id"),
        "name": place.get("name"),
        "display_name": place.get("display_name") or place.get("name"),
        "place_type": place.get("place_type"),
    }


async def resolve_place(place_name: str) -> dict[str, Any] | None:
    if not place_name:
        return None

    payload = await fetch_inaturalist(
        "/search",
        {"q": place_name, "sources": "places", "per_page": "5"},
    )
    result = pick_place_result(payload.get("results", []), place_name)
    return minimal_place(result) if result else None


def empty_observation_response(
    per_page: int,
    taxon_query: str,
    place_query: str | None,
    resolved_taxon: dict[str, Any] | None = None,
    resolved_place: dict[str, Any] | None = None,
    message: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "total_results": 0,
        "page": 1,
        "per_page": per_page,
        "results": [],
        "resolved": {
            "taxonName": taxon_query,
            "placeName": place_query,
            "taxon": resolved_taxon,
            "place": resolved_place,
        },
    }
    if message:
        payload["message"] = message
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
    safe_per_page = min(per_page, 200)
    taxon_query, place_query = split_taxon_place_query(taxon_name, place_name)
    resolved_taxon: dict[str, Any] | None = None
    resolved_place: dict[str, Any] | None = None

    params: dict[str, Any] = {
        "per_page": safe_per_page,
        "order": "desc",
        "order_by": "created_at",
        "verifiable": "true",
    }

    try:
        if taxon_id:
            params["taxon_id"] = taxon_id
        elif taxon_query:
            resolved_taxon = await resolve_taxon(taxon_query)
            if resolved_taxon and resolved_taxon.get("id"):
                params["taxon_id"] = resolved_taxon["id"]
            else:
                params["taxon_name"] = taxon_query

        if place_query:
            resolved_place = await resolve_place(place_query)
            if not resolved_place or not resolved_place.get("id"):
                return empty_observation_response(
                    safe_per_page,
                    taxon_query,
                    place_query,
                    resolved_taxon=resolved_taxon,
                    message=f'Lieu "{place_query}" introuvable dans iNaturalist.',
                )
            params["place_id"] = resolved_place["id"]

        payload = await fetch_inaturalist("/observations", params)
    except RuntimeError as exc:
        return JSONResponse(status_code=502, content={"error": str(exc)})

    if isinstance(payload, dict):
        payload["resolved"] = {
            "taxonName": taxon_query,
            "placeName": place_query,
            "taxon": resolved_taxon,
            "place": resolved_place,
            "params": params,
        }
    return payload


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
