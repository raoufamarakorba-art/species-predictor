from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import unicodedata
from collections import Counter
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import settings
from app.services.biotopes import infer_biotope


SUPPORTED_SOURCE_TYPES = {"inaturalist", "gbif", "field", "literature", "article", "other"}


def now_utc() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def connect(database_path: Path | None = None) -> sqlite3.Connection:
    path = database_path or settings.database_path
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            source_type TEXT NOT NULL,
            citation TEXT,
            url TEXT,
            license TEXT,
            notes TEXT,
            metadata_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sources_type_name
            ON sources(source_type, name);

        CREATE TABLE IF NOT EXISTS occurrences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dedupe_key TEXT UNIQUE,
            taxon_id TEXT,
            scientific_name TEXT,
            common_name TEXT,
            taxon_rank TEXT,
            observed_on TEXT,
            year INTEGER,
            month INTEGER,
            latitude REAL,
            longitude REAL,
            place_guess TEXT,
            locality TEXT,
            biotope TEXT,
            country_code TEXT,
            observer TEXT,
            quality_grade TEXT,
            basis_of_record TEXT,
            url TEXT,
            first_source_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(first_source_id) REFERENCES sources(id)
        );

        CREATE INDEX IF NOT EXISTS idx_occurrences_taxon
            ON occurrences(scientific_name);
        CREATE INDEX IF NOT EXISTS idx_occurrences_locality
            ON occurrences(locality);
        CREATE INDEX IF NOT EXISTS idx_occurrences_date
            ON occurrences(year, month);

        CREATE TABLE IF NOT EXISTS occurrence_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            occurrence_id INTEGER NOT NULL,
            source_id INTEGER NOT NULL,
            source_record_id TEXT,
            source_record_key TEXT NOT NULL UNIQUE,
            url TEXT,
            raw_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(occurrence_id) REFERENCES occurrences(id) ON DELETE CASCADE,
            FOREIGN KEY(source_id) REFERENCES sources(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_occurrence_sources_occurrence
            ON occurrence_sources(occurrence_id);
        CREATE INDEX IF NOT EXISTS idx_occurrence_sources_source
            ON occurrence_sources(source_id);
        """
    )
    ensure_column(connection, "occurrences", "biotope", "TEXT")
    connection.execute("CREATE INDEX IF NOT EXISTS idx_occurrences_biotope ON occurrences(biotope)")


def ensure_column(connection: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    columns = {row["name"] for row in connection.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in columns:
        connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return dict(row)


def normalize_source_type(value: str | None) -> str:
    source_type = normalize_text(value or "other")
    return source_type if source_type in SUPPORTED_SOURCE_TYPES else "other"


def normalize_text(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"\s+", " ", text)


def source_identity(source: dict[str, Any]) -> tuple[str, str, str | None]:
    source_type = normalize_source_type(source.get("type") or source.get("source_type"))
    name = str(source.get("name") or source_type).strip() or source_type
    url = source.get("url")
    return source_type, name, str(url).strip() if url else None


def upsert_source(connection: sqlite3.Connection, source: dict[str, Any]) -> dict[str, Any]:
    init_db(connection)
    source_type, name, url = source_identity(source)
    timestamp = now_utc()
    row = connection.execute(
        """
        SELECT * FROM sources
        WHERE source_type = ?
          AND lower(name) = lower(?)
          AND ifnull(url, '') = ifnull(?, '')
        LIMIT 1
        """,
        (source_type, name, url),
    ).fetchone()

    metadata_json = json.dumps(source.get("metadata") or {}, ensure_ascii=False, sort_keys=True)
    payload = {
        "name": name,
        "source_type": source_type,
        "citation": source.get("citation"),
        "url": url,
        "license": source.get("license"),
        "notes": source.get("notes"),
        "metadata_json": metadata_json,
        "updated_at": timestamp,
    }

    if row:
        connection.execute(
            """
            UPDATE sources
            SET citation = COALESCE(?, citation),
                license = COALESCE(?, license),
                notes = COALESCE(?, notes),
                metadata_json = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                payload["citation"],
                payload["license"],
                payload["notes"],
                payload["metadata_json"],
                payload["updated_at"],
                row["id"],
            ),
        )
        return row_to_dict(connection.execute("SELECT * FROM sources WHERE id = ?", (row["id"],)).fetchone()) or {}

    cursor = connection.execute(
        """
        INSERT INTO sources (
            name, source_type, citation, url, license, notes, metadata_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload["name"],
            payload["source_type"],
            payload["citation"],
            payload["url"],
            payload["license"],
            payload["notes"],
            payload["metadata_json"],
            timestamp,
            payload["updated_at"],
        ),
    )
    return row_to_dict(connection.execute("SELECT * FROM sources WHERE id = ?", (cursor.lastrowid,)).fetchone()) or {}


def first_value(data: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        if key in data and data[key] not in (None, ""):
            return data[key]
    return None


def nested_value(data: dict[str, Any], *keys: str) -> Any:
    current: Any = data
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def parse_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed


def extract_coordinates(record: dict[str, Any]) -> tuple[float | None, float | None]:
    coordinates = nested_value(record, "geojson", "coordinates")
    if isinstance(coordinates, (list, tuple)) and len(coordinates) >= 2:
        lon = parse_float(coordinates[0])
        lat = parse_float(coordinates[1])
    else:
        lat = parse_float(first_value(record, ("latitude", "decimalLatitude", "lat")))
        lon = parse_float(first_value(record, ("longitude", "decimalLongitude", "lon", "lng")))

    if lat is None or lon is None:
        return None, None
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None, None
    return lat, lon


def normalize_date(value: Any) -> str | None:
    if value in (None, ""):
        return None
    text = str(value).strip()
    if not text:
        return None
    match = re.match(r"^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?", text)
    if not match:
        return text[:32]
    year = match.group(1)
    month = match.group(2)
    day = match.group(3)
    if month and day:
        return f"{year}-{month}-{day}"
    if month:
        return f"{year}-{month}"
    return year


def extract_year_month(date_text: str | None) -> tuple[int | None, int | None]:
    if not date_text:
        return None, None
    match = re.match(r"^(\d{4})(?:-(\d{2}))?", date_text)
    if not match:
        return None, None
    year = int(match.group(1))
    month = int(match.group(2)) if match.group(2) else None
    return year, month


def scientific_name(record: dict[str, Any]) -> str | None:
    return first_value(
        record,
        (
            "scientific_name",
            "scientificName",
            "taxonName",
            "species",
            "acceptedScientificName",
        ),
    ) or nested_value(record, "taxon", "name")


def common_name(record: dict[str, Any]) -> str | None:
    return first_value(record, ("common_name", "commonName", "vernacularName")) or nested_value(
        record, "taxon", "preferred_common_name"
    )


def observer_name(record: dict[str, Any]) -> str | None:
    value = first_value(record, ("recordedBy", "observer", "collector"))
    if value not in (None, ""):
        return str(value)
    user = record.get("user")
    if isinstance(user, dict):
        return user.get("login") or user.get("name")
    if user not in (None, ""):
        return str(user)
    return None


def source_record_id(record: dict[str, Any]) -> str | None:
    value = first_value(
        record,
        (
            "id",
            "occurrenceID",
            "occurrence_id",
            "gbifID",
            "catalogNumber",
            "recordNumber",
            "source_record_id",
        ),
    )
    return str(value).strip() if value not in (None, "") else None


def record_url(record: dict[str, Any]) -> str | None:
    value = first_value(record, ("url", "uri", "references", "source_url"))
    return str(value).strip() if value not in (None, "") else None


def raw_hash(record: dict[str, Any]) -> str:
    encoded = json.dumps(record, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()[:16]


def build_dedupe_key(record: dict[str, Any], lat: float | None, lon: float | None, observed_on: str | None) -> str | None:
    name = scientific_name(record)
    if not name or lat is None or lon is None or not observed_on:
        return None
    return "|".join(
        [
            normalize_text(name),
            observed_on,
            f"{lat:.5f}",
            f"{lon:.5f}",
        ]
    )


def normalize_record(record: dict[str, Any], source_id: int) -> dict[str, Any]:
    lat, lon = extract_coordinates(record)
    observed_on = normalize_date(first_value(record, ("observed_on", "eventDate", "date", "verbatimEventDate")))
    year, month = extract_year_month(observed_on)
    record_id = source_record_id(record)
    url = record_url(record)
    source_key_value = record_id or url or raw_hash(record)
    source_key = f"{source_id}:{source_key_value}"

    locality = first_value(record, ("locality", "place_guess", "verbatimLocality", "place"))

    return {
        "source_record_id": record_id,
        "source_record_key": source_key,
        "dedupe_key": build_dedupe_key(record, lat, lon, observed_on),
        "taxon_id": first_value(record, ("taxon_id", "taxonID", "taxonKey")) or nested_value(record, "taxon", "id"),
        "scientific_name": scientific_name(record),
        "common_name": common_name(record),
        "taxon_rank": first_value(record, ("rank", "taxonRank")) or nested_value(record, "taxon", "rank"),
        "observed_on": observed_on,
        "year": year,
        "month": month,
        "latitude": lat,
        "longitude": lon,
        "place_guess": first_value(record, ("place_guess", "verbatimLocality", "place")),
        "locality": locality,
        "biotope": infer_biotope(
            lat,
            lon,
            locality=locality,
            explicit=first_value(record, ("biotope", "habitat", "habitatType", "habitat_type", "dwc:habitat")),
        ),
        "country_code": first_value(record, ("countryCode", "country_code")),
        "observer": observer_name(record),
        "quality_grade": first_value(record, ("quality_grade", "qualityGrade")),
        "basis_of_record": first_value(record, ("basisOfRecord", "basis_of_record")),
        "url": url,
        "raw_json": json.dumps(record, ensure_ascii=False, sort_keys=True, default=str),
    }


def find_occurrence(connection: sqlite3.Connection, normalized: dict[str, Any]) -> sqlite3.Row | None:
    linked = connection.execute(
        """
        SELECT o.*
        FROM occurrences o
        JOIN occurrence_sources os ON os.occurrence_id = o.id
        WHERE os.source_record_key = ?
        LIMIT 1
        """,
        (normalized["source_record_key"],),
    ).fetchone()
    if linked:
        return linked

    dedupe_key = normalized.get("dedupe_key")
    if not dedupe_key:
        return None
    return connection.execute("SELECT * FROM occurrences WHERE dedupe_key = ? LIMIT 1", (dedupe_key,)).fetchone()


def clean_payload(value: Any) -> Any:
    if value == "":
        return None
    return value


def insert_occurrence(connection: sqlite3.Connection, source_id: int, normalized: dict[str, Any]) -> int:
    timestamp = now_utc()
    cursor = connection.execute(
        """
        INSERT INTO occurrences (
            dedupe_key, taxon_id, scientific_name, common_name, taxon_rank,
            observed_on, year, month, latitude, longitude, place_guess, locality,
            biotope, country_code, observer, quality_grade, basis_of_record, url,
            first_source_id, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            normalized["dedupe_key"],
            clean_payload(normalized["taxon_id"]),
            clean_payload(normalized["scientific_name"]),
            clean_payload(normalized["common_name"]),
            clean_payload(normalized["taxon_rank"]),
            clean_payload(normalized["observed_on"]),
            normalized["year"],
            normalized["month"],
            normalized["latitude"],
            normalized["longitude"],
            clean_payload(normalized["place_guess"]),
            clean_payload(normalized["locality"]),
            clean_payload(normalized["biotope"]),
            clean_payload(normalized["country_code"]),
            clean_payload(normalized["observer"]),
            clean_payload(normalized["quality_grade"]),
            clean_payload(normalized["basis_of_record"]),
            clean_payload(normalized["url"]),
            source_id,
            timestamp,
            timestamp,
        ),
    )
    return int(cursor.lastrowid)


def update_occurrence(connection: sqlite3.Connection, occurrence_id: int, normalized: dict[str, Any]) -> None:
    timestamp = now_utc()
    connection.execute(
        """
        UPDATE occurrences
        SET taxon_id = COALESCE(?, taxon_id),
            scientific_name = COALESCE(?, scientific_name),
            common_name = COALESCE(?, common_name),
            taxon_rank = COALESCE(?, taxon_rank),
            observed_on = COALESCE(?, observed_on),
            year = COALESCE(?, year),
            month = COALESCE(?, month),
            latitude = COALESCE(?, latitude),
            longitude = COALESCE(?, longitude),
            place_guess = COALESCE(?, place_guess),
            locality = COALESCE(?, locality),
            biotope = COALESCE(?, biotope),
            country_code = COALESCE(?, country_code),
            observer = COALESCE(?, observer),
            quality_grade = COALESCE(?, quality_grade),
            basis_of_record = COALESCE(?, basis_of_record),
            url = COALESCE(?, url),
            updated_at = ?
        WHERE id = ?
        """,
        (
            clean_payload(normalized["taxon_id"]),
            clean_payload(normalized["scientific_name"]),
            clean_payload(normalized["common_name"]),
            clean_payload(normalized["taxon_rank"]),
            clean_payload(normalized["observed_on"]),
            normalized["year"],
            normalized["month"],
            normalized["latitude"],
            normalized["longitude"],
            clean_payload(normalized["place_guess"]),
            clean_payload(normalized["locality"]),
            clean_payload(normalized["biotope"]),
            clean_payload(normalized["country_code"]),
            clean_payload(normalized["observer"]),
            clean_payload(normalized["quality_grade"]),
            clean_payload(normalized["basis_of_record"]),
            clean_payload(normalized["url"]),
            timestamp,
            occurrence_id,
        ),
    )


def upsert_occurrence_source(
    connection: sqlite3.Connection,
    occurrence_id: int,
    source_id: int,
    normalized: dict[str, Any],
) -> bool:
    timestamp = now_utc()
    row = connection.execute(
        "SELECT id FROM occurrence_sources WHERE source_record_key = ?",
        (normalized["source_record_key"],),
    ).fetchone()
    if row:
        connection.execute(
            """
            UPDATE occurrence_sources
            SET occurrence_id = ?, url = COALESCE(?, url), raw_json = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                occurrence_id,
                clean_payload(normalized["url"]),
                normalized["raw_json"],
                timestamp,
                row["id"],
            ),
        )
        return False

    connection.execute(
        """
        INSERT INTO occurrence_sources (
            occurrence_id, source_id, source_record_id, source_record_key, url,
            raw_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            occurrence_id,
            source_id,
            clean_payload(normalized["source_record_id"]),
            normalized["source_record_key"],
            clean_payload(normalized["url"]),
            normalized["raw_json"],
            timestamp,
            timestamp,
        ),
    )
    return True


def import_occurrences(source: dict[str, Any], observations: list[dict[str, Any]]) -> dict[str, Any]:
    if not observations:
        return {"created": 0, "updated": 0, "sourceLinksCreated": 0, "skipped": 0, "totalStored": 0}

    with closing(connect()) as connection:
        with connection:
            init_db(connection)
            source_row = upsert_source(connection, source)
            source_id = int(source_row["id"])

            created = 0
            updated = 0
            links_created = 0
            skipped = 0

            for record in observations:
                if not isinstance(record, dict):
                    skipped += 1
                    continue

                normalized = normalize_record(record, source_id)
                if not normalized["scientific_name"] and not normalized["taxon_id"]:
                    skipped += 1
                    continue

                existing = find_occurrence(connection, normalized)
                if existing:
                    occurrence_id = int(existing["id"])
                    update_occurrence(connection, occurrence_id, normalized)
                    updated += 1
                else:
                    occurrence_id = insert_occurrence(connection, source_id, normalized)
                    created += 1

                if upsert_occurrence_source(connection, occurrence_id, source_id, normalized):
                    links_created += 1

            total_stored = int(connection.execute("SELECT COUNT(*) FROM occurrences").fetchone()[0])
            return {
                "created": created,
                "updated": updated,
                "sourceLinksCreated": links_created,
                "skipped": skipped,
                "totalStored": total_stored,
                "source": source_public_dict(source_row),
            }


def source_public_dict(row: dict[str, Any] | sqlite3.Row) -> dict[str, Any]:
    source = dict(row)
    source["type"] = source.pop("source_type")
    source["metadata"] = json.loads(source.pop("metadata_json") or "{}")
    return source


def occurrence_public_dict(row: sqlite3.Row) -> dict[str, Any]:
    occurrence = dict(row)
    occurrence["sources"] = json.loads(occurrence.pop("sources_json") or "[]")
    return occurrence


def library_summary() -> dict[str, Any]:
    with closing(connect()) as connection:
        init_db(connection)
        totals = connection.execute(
            """
            SELECT
                COUNT(*) AS total_occurrences,
                COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) AS georeferenced,
                COUNT(DISTINCT scientific_name) AS taxa,
                COUNT(DISTINCT locality) AS localities
            FROM occurrences
            """
        ).fetchone()
        sources = connection.execute(
            """
            SELECT s.*, COUNT(os.id) AS records
            FROM sources s
            LEFT JOIN occurrence_sources os ON os.source_id = s.id
            GROUP BY s.id
            ORDER BY s.updated_at DESC
            """
        ).fetchall()
        top_taxa = connection.execute(
            """
            SELECT scientific_name AS label, COUNT(*) AS count
            FROM occurrences
            WHERE scientific_name IS NOT NULL AND scientific_name != ''
            GROUP BY scientific_name
            ORDER BY count DESC, scientific_name ASC
            LIMIT 8
            """
        ).fetchall()
        top_localities = connection.execute(
            """
            SELECT locality AS label, COUNT(*) AS count
            FROM occurrences
            WHERE locality IS NOT NULL AND locality != ''
            GROUP BY locality
            ORDER BY count DESC, locality ASC
            LIMIT 8
            """
        ).fetchall()
        by_source_type = Counter()
        source_payload = []
        for row in sources:
            source = source_public_dict(row)
            source["records"] = row["records"]
            by_source_type[source["type"]] += row["records"]
            source_payload.append(source)

        return {
            "totalOccurrences": totals["total_occurrences"],
            "georeferencedOccurrences": totals["georeferenced"],
            "taxa": totals["taxa"],
            "localities": totals["localities"],
            "sources": source_payload,
            "bySourceType": dict(by_source_type),
            "topTaxa": [dict(row) for row in top_taxa],
            "topLocalities": [dict(row) for row in top_localities],
            "databasePath": str(settings.database_path),
        }


def list_occurrences(limit: int = 100) -> list[dict[str, Any]]:
    bounded_limit = max(1, min(limit, 500))
    with closing(connect()) as connection:
        init_db(connection)
        rows = connection.execute(
            """
            SELECT o.*,
                   json_group_array(
                       json_object(
                           'id', s.id,
                           'name', s.name,
                           'type', s.source_type,
                           'recordId', os.source_record_id,
                           'url', os.url
                       )
                   ) AS sources_json
            FROM occurrences o
            LEFT JOIN occurrence_sources os ON os.occurrence_id = o.id
            LEFT JOIN sources s ON s.id = os.source_id
            GROUP BY o.id
            ORDER BY o.updated_at DESC
            LIMIT ?
            """,
            (bounded_limit,),
        ).fetchall()
    return [occurrence_public_dict(row) for row in rows]
