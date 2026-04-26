import { useState, useCallback } from 'react'
import { fetchObservations, computeStats } from '../services/inaturalist.js'
import { fetchPrediction } from '../services/api.js'
import { fetchDatasetSummary } from '../services/datasets.js'

const initialState = {
  observations: [],
  taxon: null,
  stats: null,
  datasetSummary: null,
  prediction: null,
  loading: false,
  loadingPredict: false,
  error: null,
  errorPredict: null,
}

export function useSpeciesData() {
  const [state, setState] = useState(initialState)

  const search = useCallback(async ({ speciesName, placeName, biotope }) => {
    if (!speciesName.trim()) return

    setState(s => ({ ...s, loading: true, error: null, prediction: null, errorPredict: null }))

    try {
      // 1 – Fetch observations from iNaturalist
      const data = await fetchObservations({ taxonName: speciesName, placeName })
      const observations = data.results || []

      if (observations.length === 0) {
        setState(s => ({
          ...s,
          loading: false,
          error: 'Aucune observation trouvée. Vérifiez le nom ou élargissez la zone.',
        }))
        return
      }

      // Best-matching taxon (first observation)
      const taxon = observations[0]?.taxon || null
      const stats = computeStats(observations)
      let datasetSummary = null

      try {
        datasetSummary = await fetchDatasetSummary(observations)
      } catch {
        datasetSummary = null
      }

      setState(s => ({
        ...s,
        observations,
        taxon,
        stats,
        datasetSummary,
        loading: false,
      }))

      // 2 – Fetch AI predictions (async, non-blocking)
      setState(s => ({ ...s, loadingPredict: true }))
      try {
        const result = await fetchPrediction({ observations, taxon, speciesName, biotope })
        setState(s => ({ ...s, prediction: result.prediction, loadingPredict: false }))
      } catch (predErr) {
        setState(s => ({
          ...s,
          loadingPredict: false,
          errorPredict: predErr.message,
        }))
      }
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err.message }))
    }
  }, [])

  const reset = useCallback(() => setState(initialState), [])

  return { ...state, search, reset }
}
