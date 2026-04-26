# Roadmap

## v0.1.x - Explorer

- Stabilize the public repository and documentation.
- Keep the React interface and FastAPI endpoints API-compatible.
- Validate the backend with lightweight tests.
- Keep AI output outside the runtime by using ChatGPT export/import files.

## v0.2.0 - Data

- Export observations as CSV and GeoJSON.
- Add a map view for occurrence points.
- Add backend caching for iNaturalist requests.
- Add dataset quality summaries: coordinates, years, places, duplicates, and basic recommendations.
- Improve iNaturalist taxon/place matching with resolved IDs.

## v0.3.0 - ChatGPT workflow

- Remove Ollama from the default runtime and legacy API surface.
- Export a ChatGPT-ready prompt, metadata JSON, CSV, and GeoJSON.
- Import ChatGPT Markdown or JSON analysis back into the interface.
- Keep `npm run dev` as the single-terminal development command.

## v0.4.0 - Cleaning

- Add GBIF as a second occurrence source.
- Merge and deduplicate iNaturalist and GBIF records.
- Flag suspect coordinates.
- Add simple spatial thinning with a configurable grid size.

## v0.5.0 - SDM

- Add a first Python-native SDM pipeline with `elapid`.
- Generate pseudo-absences from cleaned occurrence data.
- Add environmental raster ingestion.
- Report evaluation metrics and model uncertainty.

## Later

- Evaluate an R bridge for `biomod2` only after the Python data pipeline is stable.
- Add reproducibility metadata, fixed seeds, model export, and notebook reports.
