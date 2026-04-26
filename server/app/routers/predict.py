from __future__ import annotations

import json
import re
from collections import Counter
from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.services.ollama import OllamaClient


router = APIRouter(prefix="/api/predict", tags=["predict"])
MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]
ollama = OllamaClient(settings.ollama_url, settings.ollama_model)


class PredictRequest(BaseModel):
    observations: list[dict[str, Any]] = Field(default_factory=list)
    taxon: dict[str, Any] | None = None
    speciesName: str | None = None
    biotope: str | None = None


def model_is_available(models: list[str]) -> bool:
    return any(model.startswith(settings.ollama_model) for model in models)


def extract_prediction_json(raw: str) -> dict[str, Any]:
    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        raise ValueError("Réponse non-JSON reçue du modèle")
    return json.loads(match.group(0))


def build_prompt(payload: PredictRequest) -> str:
    month_counts = [0] * 12
    year_counts: Counter[str] = Counter()
    place_counts: Counter[str] = Counter()

    for observation in payload.observations:
        observed_on = observation.get("observed_on")
        if isinstance(observed_on, str) and len(observed_on) >= 7:
            try:
                month_index = int(observed_on[5:7]) - 1
            except ValueError:
                month_index = -1
            if 0 <= month_index < 12:
                month_counts[month_index] += 1
            year_counts[observed_on[:4]] += 1

        place_guess = observation.get("place_guess")
        if isinstance(place_guess, str) and place_guess:
            key = (place_guess.split(",")[-1].strip() or "Autre")[:30]
            place_counts[key] += 1

    peak_month = max(range(12), key=lambda index: month_counts[index])
    sorted_years = sorted(year_counts.keys())
    top_places = place_counts.most_common(6)

    taxon = payload.taxon or {}
    taxon_group = taxon.get("iconic_taxon_name") or taxon.get("rank") or "inconnu"
    species_name = payload.speciesName or ""
    first_year = sorted_years[0] if sorted_years else "?"
    last_year = sorted_years[-1] if sorted_years else "?"
    monthly_distribution = ", ".join(f"{month}:{month_counts[index]}" for index, month in enumerate(MONTHS))
    main_places = ", ".join(f"{place}({count})" for place, count in top_places)
    biotope = payload.biotope or "tous"

    return f"""Tu es un expert en écologie. Données iNaturalist pour "{species_name}" (groupe: {taxon_group}):
- Observations: {len(payload.observations)}
- Période: {first_year} -> {last_year}
- Pic phénologique: {MONTHS[peak_month]} (mois {peak_month + 1})
- Distribution mensuelle: {monthly_distribution}
- Principales zones: {main_places}
- Biotope ciblé: {biotope}

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans balises markdown:
{{"summary":"...","predictions":[{{"biotope":"Forêt","probability":75,"abundance":"Modérée","confidence":"Haute","season":"Printemps-Été","notes":"..."}},{{"biotope":"Prairies","probability":45,"abundance":"Faible","confidence":"Moyenne","season":"Été","notes":"..."}},{{"biotope":"Zones humides","probability":30,"abundance":"Rare","confidence":"Basse","season":"Variable","notes":"..."}},{{"biotope":"Montagne","probability":20,"abundance":"Rare","confidence":"Basse","season":"Été","notes":"..."}}],"seasonality":"...","trend":"stable","trendExplanation":"...","keyFactors":["facteur1","facteur2"],"conservation":"...","dataQuality":"..."}}"""


@router.get("/status")
async def status():
    try:
        models = await ollama.list_models()
        return {
            "ollamaRunning": True,
            "models": models,
            "configuredModel": settings.ollama_model,
            "modelReady": model_is_available(models),
        }
    except RuntimeError as exc:
        return {
            "ollamaRunning": False,
            "error": str(exc),
            "configuredModel": settings.ollama_model,
            "modelReady": False,
        }


@router.post("")
@router.post("/")
async def predict(payload: PredictRequest):
    if not payload.speciesName:
        return JSONResponse(status_code=400, content={"error": "speciesName est requis"})

    try:
        models = await ollama.list_models()
    except RuntimeError as exc:
        return JSONResponse(
            status_code=503,
            content={
                "error": f'Ollama n\'est pas démarré. Lancez "ollama serve" dans un terminal. ({exc})'
            },
        )

    if not model_is_available(models):
        return JSONResponse(
            status_code=503,
            content={
                "error": (
                    f'Modèle "{settings.ollama_model}" non trouvé dans Ollama. '
                    f"Modèles disponibles: {', '.join(models)}. "
                    f"Lancez: ollama pull {settings.ollama_model}"
                ),
                "availableModels": models,
            },
        )

    try:
        raw = await ollama.chat(build_prompt(payload))
        prediction = extract_prediction_json(raw)
        return {"success": True, "prediction": prediction, "model": settings.ollama_model}
    except (RuntimeError, ValueError, json.JSONDecodeError) as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})
