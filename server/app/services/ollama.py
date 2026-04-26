from __future__ import annotations

from typing import Any

import httpx


class OllamaClient:
    def __init__(self, base_url: str, model: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model

    async def list_models(self) -> list[str]:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(f"Ollama ne répond pas: HTTP {exc.response.status_code}") from exc
        except httpx.HTTPError as exc:
            raise RuntimeError(str(exc) or "Ollama ne répond pas") from exc

        data = response.json()
        return [model.get("name", "") for model in data.get("models", []) if model.get("name")]

    async def chat(self, prompt: str) -> str:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "options": {
                "temperature": 0.3,
                "num_predict": 1200,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(f"{self.base_url}/api/chat", json=payload)
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            text = exc.response.text[:200]
            raise RuntimeError(f"Ollama: {exc.response.status_code} - {text}") from exc
        except httpx.HTTPError as exc:
            raise RuntimeError(str(exc) or "Ollama ne répond pas") from exc

        data = response.json()
        return data.get("message", {}).get("content", "")
