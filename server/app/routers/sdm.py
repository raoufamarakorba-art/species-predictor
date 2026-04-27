from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.sdm import stored_taxa, train_sdm


router = APIRouter(prefix="/api/sdm", tags=["sdm"])


class SdmPredictRequest(BaseModel):
    taxonName: str
    observations: list[dict[str, Any]] = Field(default_factory=list)
    gridSize: int = 14


@router.get("/taxa")
async def sdm_taxa(limit: int = 50):
    return {"results": stored_taxa(limit=limit)}


@router.post("/predict")
async def sdm_predict(payload: SdmPredictRequest):
    try:
        return train_sdm(
            taxon_name=payload.taxonName,
            observations=payload.observations,
            grid_size=payload.gridSize,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
