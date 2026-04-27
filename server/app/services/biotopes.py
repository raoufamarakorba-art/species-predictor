from __future__ import annotations

import re
import unicodedata
from typing import Any


BIOTOPE_LABELS: dict[str, str] = {
    "forest": "Forêt / maquis",
    "wetland": "Zone humide",
    "grassland": "Prairie / steppe",
    "marine": "Littoral / marin",
    "mountain": "Montagne",
    "urban": "Urbain",
    "desert": "Désert",
    "freshwater": "Eau douce",
    "agriculture": "Agricole",
    "scrubland": "Maquis / garrigue",
    "unknown": "Non renseigné",
}

BIOTOPE_ORDER = [
    "forest",
    "wetland",
    "grassland",
    "marine",
    "mountain",
    "urban",
    "desert",
    "freshwater",
    "agriculture",
    "scrubland",
]

KEYWORD_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("freshwater", ("oued", "wadi", "river", "riviere", "rivière", "lac", "lake", "barrage", "source")),
    ("wetland", ("marais", "wetland", "humide", "marsh", "sebkha", "chott", "daya", "dayet")),
    ("marine", ("plage", "beach", "coast", "cote", "côte", "littoral", "sea", "mer")),
    ("mountain", ("djebel", "jebel", "atlas", "mont", "mount", "mountain", "montagne")),
    ("forest", ("foret", "forêt", "forest", "bois", "maquis", "cedre", "cèdre", "pin", "chene", "chêne")),
    ("urban", ("ville", "city", "urban", "urbain", "campus", "jardin", "park", "parc")),
    ("agriculture", ("ferme", "farm", "verger", "orchard", "culture", "cultures", "agricole", "champ")),
    ("desert", ("sahara", "desert", "désert", "dune", "erg", "reg", "hamada", "oasis")),
    ("grassland", ("steppe", "prairie", "grassland", "pelouse", "pasture", "paturage", "pâturage")),
)


def normalize_text(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"\s+", " ", text)


def normalize_biotope(value: Any) -> str | None:
    text = normalize_text(value)
    if not text:
        return None

    aliases = {
        "foret": "forest",
        "forêt": "forest",
        "maquis": "forest",
        "zone humide": "wetland",
        "zones humides": "wetland",
        "prairie": "grassland",
        "steppe": "grassland",
        "littoral": "marine",
        "marin": "marine",
        "montagne": "mountain",
        "urbain": "urban",
        "desert": "desert",
        "désert": "desert",
        "eau douce": "freshwater",
        "agricole": "agriculture",
        "agriculture": "agriculture",
        "garrigue": "scrubland",
    }

    if text in BIOTOPE_LABELS:
        return text
    if text in aliases:
        return aliases[text]

    for code, keywords in KEYWORD_RULES:
        if any(keyword in text for keyword in keywords):
            return code
    return None


def infer_biotope(latitude: float | None, longitude: float | None, locality: Any = None, explicit: Any = None) -> str:
    explicit_code = normalize_biotope(explicit)
    if explicit_code:
        return explicit_code

    locality_code = normalize_biotope(locality)
    if locality_code:
        return locality_code

    if latitude is None or longitude is None:
        return "unknown"

    # Coarse Maghreb/Algeria ecological proxy until raster land-cover layers are added.
    if latitude < 29.5:
        return "desert"
    if latitude < 33.5:
        return "grassland"
    if latitude < 34.8:
        return "scrubland"
    if latitude >= 36.6:
        return "marine" if 1.0 <= longitude <= 8.8 else "agriculture"
    if latitude >= 35.4:
        return "agriculture"
    return "scrubland"


def biotope_label(code: str | None) -> str:
    return BIOTOPE_LABELS.get(code or "unknown", BIOTOPE_LABELS["unknown"])
