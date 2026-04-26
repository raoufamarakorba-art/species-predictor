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
