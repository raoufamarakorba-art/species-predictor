import asyncio

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import inaturalist as inaturalist_router
from app.routers import predict as predict_router
from app.services.ollama import OllamaClient


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


def test_prediction_json_normalizes_model_key_aliases():
    payload = predict_router.extract_prediction_json(
        (
            '{"summary":"ok","keyFacteurs":["habitat"],"qualiteDonnees":"faible",'
            '"predictions":[{"biotope":"Forêt","probability":0.75}]}'
        )
    )

    assert payload["summary"] == "ok"
    assert payload["keyFactors"] == ["habitat"]
    assert payload["dataQuality"] == "faible"
    assert payload["predictions"][0]["probability"] == 75


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


def test_ollama_chat_requests_json_format(monkeypatch):
    calls = []

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"message": {"content": '{"ok":true}'}}

    class FakeAsyncClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return None

        async def post(self, url, json):
            calls.append({"url": url, "payload": json, "timeout": self.timeout})
            return FakeResponse()

    monkeypatch.setattr("app.services.ollama.httpx.AsyncClient", FakeAsyncClient)

    client = OllamaClient("http://ollama.local/", "mistral", timeout_seconds=12, num_predict=34)
    content = asyncio.run(client.chat("test prompt"))

    assert content == '{"ok":true}'
    assert calls == [
        {
            "url": "http://ollama.local/api/chat",
            "timeout": 12,
            "payload": {
                "model": "mistral",
                "messages": [{"role": "user", "content": "test prompt"}],
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.3, "num_predict": 34},
            },
        }
    ]


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


def test_inaturalist_combined_taxon_place_query_is_split():
    taxon, place = inaturalist_router.split_taxon_place_query("Syrphidae d'Algérie")

    assert taxon == "Syrphidae"
    assert place == "Algérie"


def test_inaturalist_observations_resolve_taxon_and_place_ids(monkeypatch):
    calls = []

    async def fake_fetch(path, params=None):
        calls.append((path, dict(params or {})))
        if path == "/taxa/autocomplete":
            return {
                "results": [
                    {
                        "id": 49995,
                        "name": "Syrphidae",
                        "rank": "family",
                        "preferred_common_name": "Hover Flies",
                    }
                ]
            }
        if path == "/search":
            return {
                "results": [
                    {
                        "type": "Place",
                        "matches": ["Algeria", "Algérie"],
                        "record": {
                            "id": 7300,
                            "name": "Algeria",
                            "display_name": "Algeria",
                            "place_type": 12,
                        },
                    }
                ]
            }
        if path == "/observations":
            assert params["taxon_id"] == 49995
            assert params["place_id"] == 7300
            assert params["verifiable"] == "true"
            assert "quality_grade" not in params
            assert "taxon_name" not in params
            assert "place_name" not in params
            return {
                "total_results": 1202,
                "results": [{"id": 1, "taxon": {"id": 50000, "name": "Episyrphus balteatus"}}],
            }
        raise AssertionError(f"Unexpected path: {path}")

    monkeypatch.setattr(inaturalist_router, "fetch_inaturalist", fake_fetch)

    response = client.get("/api/inaturalist/observations?taxon_name=Syrphidae%20d%27Alg%C3%A9rie")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_results"] == 1202
    assert payload["resolved"]["taxon"] == {
        "id": 49995,
        "name": "Syrphidae",
        "rank": "family",
        "preferred_common_name": "Hover Flies",
        "iconic_taxon_name": None,
        "default_photo": None,
    }
    assert payload["resolved"]["place"]["id"] == 7300
    assert [path for path, _params in calls] == ["/taxa/autocomplete", "/search", "/observations"]


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
