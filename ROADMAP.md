# Roadmap

## v0.1.x - Explorer

- Stabilize the public repository and documentation.
- Keep the React interface and FastAPI endpoints API-compatible.
- Validate the backend with lightweight tests.
- Keep predictions explicitly labeled as qualitative LLM summaries.

## v0.2.0 - Data

- Export observations as CSV and GeoJSON.
- Add a map view for occurrence points.
- Add backend caching for iNaturalist requests.
- Add dataset quality summaries: coordinates, years, places, duplicates, and spatial bias indicators.

## v0.3.0 - Cleaning

- Add GBIF as a second occurrence source.
- Merge and deduplicate iNaturalist and GBIF records.
- Flag suspect coordinates.
- Add simple spatial thinning with a configurable grid size.

## v0.4.0 - SDM

- Add a first Python-native SDM pipeline with `elapid`.
- Generate pseudo-absences from cleaned occurrence data.
- Add environmental raster ingestion.
- Report evaluation metrics and model uncertainty.

## Later

- Evaluate an R bridge for `biomod2` only after the Python data pipeline is stable.
- Add reproducibility metadata, fixed seeds, model export, and notebook reports.
