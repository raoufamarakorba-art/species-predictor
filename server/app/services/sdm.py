from __future__ import annotations

import hashlib
import math
import random
from collections import Counter, defaultdict
from contextlib import closing
from dataclasses import dataclass
from typing import Any

from app.services.biotopes import BIOTOPE_ORDER, biotope_label, infer_biotope
from app.services.occurrence_store import (
    connect,
    extract_coordinates,
    first_value,
    init_db,
    normalize_date,
    normalize_text,
    scientific_name,
)


MIN_PRESENCES = 5
DEFAULT_GRID_SIZE = 14


@dataclass(frozen=True)
class OccurrencePoint:
    taxon: str
    latitude: float
    longitude: float
    biotope: str
    locality: str | None = None
    observed_on: str | None = None


@dataclass(frozen=True)
class ModelContext:
    min_lat: float
    max_lat: float
    min_lon: float
    max_lon: float
    center_lat: float
    center_lon: float
    lat_scale: float
    lon_scale: float
    split_lat: float
    biotopes: tuple[str, ...]


def stable_seed(value: str) -> int:
    return int(hashlib.sha256(value.encode("utf-8")).hexdigest()[:12], 16)


def safe_sigmoid(value: float) -> float:
    if value >= 35:
        return 1.0
    if value <= -35:
        return 0.0
    return 1 / (1 + math.exp(-value))


def dot(left: list[float], right: list[float]) -> float:
    return sum(a * b for a, b in zip(left, right))


def point_from_record(record: dict[str, Any], target_taxon: str | None = None) -> OccurrencePoint | None:
    lat, lon = extract_coordinates(record)
    if lat is None or lon is None:
        return None

    locality = first_value(record, ("locality", "place_guess", "verbatimLocality", "place"))
    name = target_taxon or scientific_name(record)
    if not name:
        return None

    return OccurrencePoint(
        taxon=str(name),
        latitude=lat,
        longitude=lon,
        biotope=infer_biotope(
            lat,
            lon,
            locality=locality,
            explicit=first_value(record, ("biotope", "habitat", "habitatType", "habitat_type", "dwc:habitat")),
        ),
        locality=str(locality) if locality else None,
        observed_on=normalize_date(first_value(record, ("observed_on", "eventDate", "date", "verbatimEventDate"))),
    )


def points_from_observations(observations: list[dict[str, Any]], taxon_name: str) -> list[OccurrencePoint]:
    points: list[OccurrencePoint] = []
    seen: set[tuple[str, str | None, float, float]] = set()
    for record in observations:
        if not isinstance(record, dict):
            continue
        point = point_from_record(record, target_taxon=taxon_name)
        if not point:
            continue
        key = (normalize_text(point.taxon), point.observed_on, round(point.latitude, 5), round(point.longitude, 5))
        if key in seen:
            continue
        seen.add(key)
        points.append(point)
    return points


def points_from_database(taxon_name: str) -> list[OccurrencePoint]:
    term = normalize_text(taxon_name)
    like_term = f"%{term}%"
    with closing(connect()) as connection:
        init_db(connection)
        rows = connection.execute(
            """
            SELECT DISTINCT o.*
            FROM occurrences o
            LEFT JOIN occurrence_sources os ON os.occurrence_id = o.id
            LEFT JOIN sources s ON s.id = os.source_id
            WHERE o.latitude IS NOT NULL
              AND o.longitude IS NOT NULL
              AND (
                lower(o.scientific_name) = lower(?)
                OR lower(o.taxon_id) = lower(?)
                OR lower(o.scientific_name) LIKE ?
                OR lower(s.metadata_json) LIKE ?
              )
            """,
            (taxon_name, taxon_name, like_term, like_term),
        ).fetchall()

    points: list[OccurrencePoint] = []
    for row in rows:
        name = row["scientific_name"] or taxon_name
        points.append(
            OccurrencePoint(
                taxon=name,
                latitude=float(row["latitude"]),
                longitude=float(row["longitude"]),
                biotope=row["biotope"] or infer_biotope(row["latitude"], row["longitude"], locality=row["locality"]),
                locality=row["locality"],
                observed_on=row["observed_on"],
            )
        )
    return points


def stored_taxa(limit: int = 50) -> list[dict[str, Any]]:
    with closing(connect()) as connection:
        init_db(connection)
        rows = connection.execute(
            """
            SELECT scientific_name AS name,
                   COUNT(*) AS occurrences,
                   COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) AS georeferenced
            FROM occurrences
            WHERE scientific_name IS NOT NULL AND scientific_name != ''
            GROUP BY scientific_name
            HAVING georeferenced > 0
            ORDER BY georeferenced DESC, scientific_name ASC
            LIMIT ?
            """,
            (max(1, min(limit, 200)),),
        ).fetchall()
    return [dict(row) for row in rows]


def build_context(points: list[OccurrencePoint]) -> ModelContext:
    lats = [point.latitude for point in points]
    lons = [point.longitude for point in points]
    min_lat, max_lat = min(lats), max(lats)
    min_lon, max_lon = min(lons), max(lons)
    lat_span = max(max_lat - min_lat, 0.4)
    lon_span = max(max_lon - min_lon, 0.4)
    padding_lat = max(lat_span * 0.18, 0.08)
    padding_lon = max(lon_span * 0.18, 0.08)

    min_lat = max(-90, min_lat - padding_lat)
    max_lat = min(90, max_lat + padding_lat)
    min_lon = max(-180, min_lon - padding_lon)
    max_lon = min(180, max_lon + padding_lon)
    center_lat = (min_lat + max_lat) / 2
    center_lon = (min_lon + max_lon) / 2

    observed_biotopes = sorted({point.biotope for point in points if point.biotope != "unknown"})
    biotopes = tuple(code for code in BIOTOPE_ORDER if code in observed_biotopes) or ("unknown",)

    return ModelContext(
        min_lat=min_lat,
        max_lat=max_lat,
        min_lon=min_lon,
        max_lon=max_lon,
        center_lat=center_lat,
        center_lon=center_lon,
        lat_scale=max((max_lat - min_lat) / 2, 0.1),
        lon_scale=max((max_lon - min_lon) / 2, 0.1),
        split_lat=center_lat,
        biotopes=biotopes,
    )


def scaled_coordinates(latitude: float, longitude: float, context: ModelContext) -> tuple[float, float]:
    lat = (latitude - context.center_lat) / context.lat_scale
    lon = (longitude - context.center_lon) / context.lon_scale
    return lat, lon


def encode_features(latitude: float, longitude: float, biotope: str, context: ModelContext) -> list[float]:
    lat, lon = scaled_coordinates(latitude, longitude, context)
    features = [1.0, lat, lon, lat * lon, lat * lat, lon * lon]
    features.extend(1.0 if biotope == code else 0.0 for code in context.biotopes)
    return features


def feature_names(context: ModelContext) -> list[str]:
    return [
        "biais",
        "latitude",
        "longitude",
        "latitude × longitude",
        "latitude²",
        "longitude²",
        *[biotope_label(code) for code in context.biotopes],
    ]


def build_background(points: list[OccurrencePoint], context: ModelContext, taxon_name: str) -> list[OccurrencePoint]:
    count = min(max(len(points) * 3, 80), 700)
    rng = random.Random(stable_seed(f"{taxon_name}:{context.min_lat}:{context.min_lon}:{len(points)}"))
    background: list[OccurrencePoint] = []
    presence_cells = {(round(point.latitude, 3), round(point.longitude, 3)) for point in points}

    attempts = 0
    while len(background) < count and attempts < count * 8:
        attempts += 1
        lat = rng.uniform(context.min_lat, context.max_lat)
        lon = rng.uniform(context.min_lon, context.max_lon)
        if (round(lat, 3), round(lon, 3)) in presence_cells:
            continue
        background.append(
            OccurrencePoint(
                taxon="background",
                latitude=lat,
                longitude=lon,
                biotope=infer_biotope(lat, lon),
            )
        )
    return background


def train_test_split(
    positives: list[OccurrencePoint],
    background: list[OccurrencePoint],
    taxon_name: str,
) -> tuple[list[OccurrencePoint], list[OccurrencePoint], list[OccurrencePoint], list[OccurrencePoint]]:
    rng = random.Random(stable_seed(f"split:{taxon_name}:{len(positives)}:{len(background)}"))
    pos = positives[:]
    neg = background[:]
    rng.shuffle(pos)
    rng.shuffle(neg)

    if len(pos) < 8 or len(neg) < 20:
        return pos, neg, [], []

    pos_test_count = max(2, round(len(pos) * 0.25))
    neg_test_count = max(10, round(len(neg) * 0.25))
    return pos[pos_test_count:], neg[neg_test_count:], pos[:pos_test_count], neg[:neg_test_count]


def fit_logistic(
    positives: list[OccurrencePoint],
    background: list[OccurrencePoint],
    context: ModelContext,
) -> list[float]:
    training = [(point, 1.0) for point in positives] + [(point, 0.0) for point in background]
    weights = [0.0] * len(encode_features(positives[0].latitude, positives[0].longitude, positives[0].biotope, context))
    positive_weight = len(training) / max(len(positives) * 2, 1)
    negative_weight = len(training) / max(len(background) * 2, 1)
    learning_rate = 0.09
    l2 = 0.025

    for _iteration in range(900):
        gradients = [0.0] * len(weights)
        for point, label in training:
            features = encode_features(point.latitude, point.longitude, point.biotope, context)
            prediction = safe_sigmoid(dot(weights, features))
            sample_weight = positive_weight if label == 1.0 else negative_weight
            error = (prediction - label) * sample_weight
            for index, value in enumerate(features):
                gradients[index] += error * value

        divisor = max(len(training), 1)
        for index in range(len(weights)):
            regularization = 0.0 if index == 0 else l2 * weights[index]
            weights[index] -= learning_rate * ((gradients[index] / divisor) + regularization)

    return weights


def predict_probability(point: OccurrencePoint, weights: list[float], context: ModelContext) -> float:
    features = encode_features(point.latitude, point.longitude, point.biotope, context)
    return safe_sigmoid(dot(weights, features))


def auc_score(labels: list[int], scores: list[float]) -> float | None:
    positives = [score for label, score in zip(labels, scores) if label == 1]
    negatives = [score for label, score in zip(labels, scores) if label == 0]
    if not positives or not negatives:
        return None

    wins = 0.0
    total = len(positives) * len(negatives)
    for pos_score in positives:
        for neg_score in negatives:
            if pos_score > neg_score:
                wins += 1
            elif pos_score == neg_score:
                wins += 0.5
    return round(wins / total, 3)


def evaluate(
    positives: list[OccurrencePoint],
    background: list[OccurrencePoint],
    weights: list[float],
    context: ModelContext,
) -> dict[str, Any]:
    labels = [1] * len(positives) + [0] * len(background)
    scores = [predict_probability(point, weights, context) for point in positives + background]
    auc = auc_score(labels, scores)
    return {
        "auc": auc,
        "samples": len(labels),
        "presences": len(positives),
        "background": len(background),
    }


def zone_code(latitude: float, split_lat: float) -> str:
    return "north" if latitude >= split_lat else "south"


def zone_label(code: str) -> str:
    return "Nord" if code == "north" else "Sud"


def summarize_grouped_scores(
    grouped: dict[str, list[float]],
    presence_counts: Counter[str],
    labeler,
) -> list[dict[str, Any]]:
    rows = []
    for code, scores in grouped.items():
        if not scores:
            continue
        rows.append(
            {
                "code": code,
                "label": labeler(code),
                "meanSuitability": round(sum(scores) / len(scores), 3),
                "maxSuitability": round(max(scores), 3),
                "presenceCount": presence_counts.get(code, 0),
                "cells": len(scores),
            }
        )
    return sorted(rows, key=lambda item: item["meanSuitability"], reverse=True)


def build_prediction_grid(
    weights: list[float],
    context: ModelContext,
    presences: list[OccurrencePoint],
    grid_size: int,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    bounded_grid = max(6, min(grid_size, 30))
    lat_step = (context.max_lat - context.min_lat) / bounded_grid
    lon_step = (context.max_lon - context.min_lon) / bounded_grid
    cells: list[dict[str, Any]] = []
    by_biotope: dict[str, list[float]] = defaultdict(list)
    by_zone: dict[str, list[float]] = defaultdict(list)
    presence_biotopes = Counter(point.biotope for point in presences)
    presence_zones = Counter(zone_code(point.latitude, context.split_lat) for point in presences)

    for lat_index in range(bounded_grid):
        lat = context.min_lat + (lat_index + 0.5) * lat_step
        for lon_index in range(bounded_grid):
            lon = context.min_lon + (lon_index + 0.5) * lon_step
            biotope = infer_biotope(lat, lon)
            point = OccurrencePoint(taxon="grid", latitude=lat, longitude=lon, biotope=biotope)
            suitability = predict_probability(point, weights, context)
            zone = zone_code(lat, context.split_lat)
            by_biotope[biotope].append(suitability)
            by_zone[zone].append(suitability)
            cells.append(
                {
                    "latitude": round(lat, 5),
                    "longitude": round(lon, 5),
                    "suitability": round(suitability, 3),
                    "biotope": biotope,
                    "biotopeLabel": biotope_label(biotope),
                    "zone": zone,
                    "zoneLabel": zone_label(zone),
                }
            )

    return (
        sorted(cells, key=lambda cell: cell["suitability"], reverse=True),
        summarize_grouped_scores(by_zone, presence_zones, zone_label),
        summarize_grouped_scores(by_biotope, presence_biotopes, biotope_label),
    )


def feature_importance(weights: list[float], context: ModelContext) -> list[dict[str, Any]]:
    names = feature_names(context)
    rows = [
        {
            "feature": names[index],
            "weight": round(weights[index], 4),
            "importance": round(abs(weights[index]), 4),
            "direction": "positive" if weights[index] >= 0 else "negative",
        }
        for index in range(1, len(weights))
    ]
    return sorted(rows, key=lambda row: row["importance"], reverse=True)[:8]


def build_warnings(presences: list[OccurrencePoint], evaluation: dict[str, Any], used_holdout: bool) -> list[str]:
    warnings = [
        "Modèle présence-background exploratoire: les background points ne sont pas des absences observées.",
        "Les biotopes sont encore des proxys dérivés des coordonnées/localités; il faudra ajouter des rasters d'occupation du sol.",
    ]
    if len(presences) < 30:
        warnings.append("Échantillon faible: interpréter les scores comme hypothèses, pas comme carte validée.")
    if len({point.biotope for point in presences}) < 2:
        warnings.append("Un seul biotope domine les présences; l'effet habitat est peu identifiable.")
    if not used_holdout:
        warnings.append("Validation holdout non utilisée faute de données suffisantes.")
    if evaluation.get("auc") is not None and evaluation["auc"] > 0.95:
        warnings.append("AUC très élevée: possible sur-apprentissage avec peu de variables et peu de points.")
    return warnings


def train_sdm(
    taxon_name: str,
    observations: list[dict[str, Any]] | None = None,
    grid_size: int = DEFAULT_GRID_SIZE,
) -> dict[str, Any]:
    if not taxon_name.strip():
        raise ValueError("Nom de taxon requis.")

    if observations:
        presences = points_from_observations(observations, taxon_name.strip())
        data_source = "current_observations"
    else:
        presences = points_from_database(taxon_name.strip())
        data_source = "local_database"

    if len(presences) < MIN_PRESENCES:
        raise ValueError(
            f"Au moins {MIN_PRESENCES} présences géoréférencées sont nécessaires pour entraîner un modèle SDM."
        )

    context = build_context(presences)
    background = build_background(presences, context, taxon_name)
    train_pos, train_neg, test_pos, test_neg = train_test_split(presences, background, taxon_name)
    weights = fit_logistic(train_pos, train_neg, context)
    used_holdout = bool(test_pos and test_neg)
    evaluation = evaluate(test_pos, test_neg, weights, context) if used_holdout else evaluate(train_pos, train_neg, weights, context)
    train_evaluation = evaluate(train_pos, train_neg, weights, context)
    grid, north_south, biotope_suitability = build_prediction_grid(weights, context, presences, grid_size)

    return {
        "algorithm": "presence-background-logistic",
        "dataSource": data_source,
        "taxon": {
            "name": taxon_name.strip(),
            "presenceCount": len(presences),
            "uniqueBiotopes": len({point.biotope for point in presences}),
        },
        "backgroundCount": len(background),
        "bbox": {
            "west": round(context.min_lon, 6),
            "south": round(context.min_lat, 6),
            "east": round(context.max_lon, 6),
            "north": round(context.max_lat, 6),
        },
        "northSouthSplitLatitude": round(context.split_lat, 6),
        "evaluation": {
            **evaluation,
            "method": "spatially naive holdout" if used_holdout else "training-set diagnostic",
            "trainAuc": train_evaluation["auc"],
        },
        "northSouth": north_south,
        "biotopeSuitability": biotope_suitability,
        "featureImportance": feature_importance(weights, context),
        "predictionGrid": grid[:120],
        "topCells": grid[:12],
        "warnings": build_warnings(presences, evaluation, used_holdout),
    }
