from __future__ import annotations

from typing import Any

import httpx


class OllamaClient:
    def __init__(
        self,
        base_url: str,
        model: str,
        timeout_seconds: float = 300.0,
        num_predict: int = 1200,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.num_predict = num_predict

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

    async def chat(self, prompt: str, response_format: str | dict[str, Any] = "json") -> str:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "format": response_format,
            "options": {
                "temperature": 0.3,
                "num_predict": self.num_predict,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(f"{self.base_url}/api/chat", json=payload)
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            text = exc.response.text[:200]
            raise RuntimeError(f"Ollama: {exc.response.status_code} - {text}") from exc
        except httpx.HTTPError as exc:
            raise RuntimeError(str(exc) or "Ollama ne répond pas") from exc

        data = response.json()
        return data.get("message", {}).get("content", "")
