import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import inaturalist as inaturalist_router
from app.routers import predict as predict_router


client = TestClient(app)


def test_health_reports_fastapi_backend():
    response = client.get("/api/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["backend"] == "fastapi"
    assert payload["model"]
    assert payload["timestamp"].endswith("Z")


def test_predict_status_when_ollama_is_unavailable(monkeypatch):
    async def unavailable():
        raise RuntimeError("connection failed")

    monkeypatch.setattr(predict_router.ollama, "list_models", unavailable)

    response = client.get("/api/predict/status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ollamaRunning"] is False
    assert payload["modelReady"] is False
    assert payload["configuredModel"] == predict_router.settings.ollama_model


def test_predict_requires_species_name():
    response = client.post("/api/predict", json={"observations": []})

    assert response.status_code == 400
    assert response.json()["error"] == "speciesName est requis"


def test_predict_returns_503_when_ollama_is_unavailable(monkeypatch):
    async def unavailable():
        raise RuntimeError("connection failed")

    monkeypatch.setattr(predict_router.ollama, "list_models", unavailable)

    response = client.post(
        "/api/predict",
        json={"speciesName": "Lynx lynx", "observations": [], "biotope": "Forêt"},
    )

    assert response.status_code == 503
    assert "Ollama n'est pas démarré" in response.json()["error"]


def test_inaturalist_autocomplete_uses_proxy_layer(monkeypatch):
    async def fake_fetch(path, params=None):
        assert path == "/taxa/autocomplete"
        assert params["q"] == "lynx"
        return {"total_results": 1, "results": [{"id": 42170, "name": "Lynx lynx"}]}

    monkeypatch.setattr(inaturalist_router, "fetch_inaturalist", fake_fetch)

    response = client.get("/api/inaturalist/taxa/autocomplete?q=lynx")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_results"] == 1
    assert payload["results"][0]["name"] == "Lynx lynx"


def test_dataset_summary_reports_quality_metrics():
    observations = [
        {
            "observed_on": "2024-04-10",
            "place_guess": "Atlas, Algeria",
            "quality_grade": "research",
            "geojson": {"coordinates": [4.5, 36.2]},
            "taxon": {"id": 42170},
        },
        {
            "observed_on": "2024-04-10",
            "place_guess": "Atlas, Algeria",
            "quality_grade": "research",
            "geojson": {"coordinates": [4.50001, 36.20001]},
            "taxon": {"id": 42170},
        },
        {
            "observed_on": "2025-05-12",
            "place_guess": "Kabylie, Algeria",
            "quality_grade": "needs_id",
        },
    ]

    response = client.post("/api/datasets/summary", json={"observations": observations})

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 3
    assert payload["withCoordinates"] == 2
    assert payload["withoutCoordinates"] == 1
    assert payload["coordinateCoverage"] == 66.7
    assert payload["yearRange"] == {"start": "2024", "end": "2025", "count": 2}
    assert payload["uniquePlaces"] == 2
    assert payload["likelyDuplicates"] == 1
    assert payload["qualityGrades"] == {"research": 2, "needs_id": 1}
    assert payload["bbox"] == {"west": 4.5, "south": 36.2, "east": 4.50001, "north": 36.20001}


def test_inaturalist_cache_status_endpoint():
    response = client.get("/api/inaturalist/cache/status")

    assert response.status_code == 200
    payload = response.json()
    assert "entries" in payload
    assert payload["ttlSeconds"] >= 0
