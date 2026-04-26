from __future__ import annotations

from collections import Counter
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field


router = APIRouter(prefix="/api/datasets", tags=["datasets"])


class DatasetSummaryRequest(BaseModel):
    observations: list[dict[str, Any]] = Field(default_factory=list)


def get_coordinates(observation: dict[str, Any]) -> tuple[float, float] | None:
    coordinates = observation.get("geojson", {}).get("coordinates")
    if not isinstance(coordinates, list | tuple) or len(coordinates) < 2:
        return None

    try:
        lon = float(coordinates[0])
        lat = float(coordinates[1])
    except (TypeError, ValueError):
        return None

    if not (-180 <= lon <= 180 and -90 <= lat <= 90):
        return None

    return lon, lat


def build_recommendations(
    total: int,
    with_coordinates: int,
    likely_duplicates: int,
    year_count: int,
) -> list[str]:
    recommendations: list[str] = []

    if total < 30:
        recommendations.append("Échantillon faible: élargir la zone, la période ou ajouter GBIF avant un SDM.")
    if total and with_coordinates / total < 0.8:
        recommendations.append("Couverture géographique incomplète: filtrer ou enrichir les coordonnées.")
    if likely_duplicates:
        recommendations.append("Doublons probables détectés: dédupliquer avant modélisation.")
    if year_count < 3:
        recommendations.append("Couverture temporelle limitée: prudence sur les tendances annuelles.")
    if not recommendations:
        recommendations.append("Jeu de données utilisable pour exploration; nettoyage spatial requis avant SDM.")

    return recommendations


@router.post("/summary")
async def dataset_summary(payload: DatasetSummaryRequest):
    observations = payload.observations
    total = len(observations)
    coordinates: list[tuple[float, float]] = []
    years: Counter[str] = Counter()
    places: Counter[str] = Counter()
    quality_grades: Counter[str] = Counter()
    duplicate_keys: Counter[tuple[Any, ...]] = Counter()

    for observation in observations:
        coords = get_coordinates(observation)
        if coords:
            lon, lat = coords
            coordinates.append(coords)
        else:
            lon = lat = None

        observed_on = observation.get("observed_on")
        if isinstance(observed_on, str) and len(observed_on) >= 4:
            years[observed_on[:4]] += 1

        place_guess = observation.get("place_guess")
        if isinstance(place_guess, str) and place_guess:
            places[place_guess.strip()] += 1

        grade = observation.get("quality_grade")
        if isinstance(grade, str) and grade:
            quality_grades[grade] += 1

        if lon is not None and lat is not None:
            taxon_id = observation.get("taxon", {}).get("id")
            duplicate_keys[(taxon_id, observed_on, round(lon, 4), round(lat, 4))] += 1

    sorted_years = sorted(years.keys())
    likely_duplicates = sum(count - 1 for count in duplicate_keys.values() if count > 1)
    with_coordinates = len(coordinates)
    without_coordinates = total - with_coordinates

    if coordinates:
        lons = [coord[0] for coord in coordinates]
        lats = [coord[1] for coord in coordinates]
        bbox = {
            "west": min(lons),
            "south": min(lats),
            "east": max(lons),
            "north": max(lats),
        }
    else:
        bbox = None

    return {
        "total": total,
        "withCoordinates": with_coordinates,
        "withoutCoordinates": without_coordinates,
        "coordinateCoverage": round((with_coordinates / total) * 100, 1) if total else 0,
        "yearRange": {
            "start": sorted_years[0] if sorted_years else None,
            "end": sorted_years[-1] if sorted_years else None,
            "count": len(sorted_years),
        },
        "uniquePlaces": len(places),
        "likelyDuplicates": likely_duplicates,
        "qualityGrades": dict(quality_grades),
        "bbox": bbox,
        "recommendations": build_recommendations(
            total=total,
            with_coordinates=with_coordinates,
            likely_duplicates=likely_duplicates,
            year_count=len(sorted_years),
        ),
    }
