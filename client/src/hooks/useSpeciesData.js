import { useState, useCallback } from 'react'
import { fetchObservations, computeStats } from '../services/inaturalist.js'
import { fetchDatasetSummary } from '../services/datasets.js'

const initialState = {
  observations: [],
  taxon: null,
  place: null,
  stats: null,
  datasetSummary: null,
  loading: false,
  error: null,
}

export function useSpeciesData() {
  const [state, setState] = useState(initialState)

  const search = useCallback(async ({ speciesName, placeName }) => {
    if (!speciesName.trim()) return

    setState(s => ({ ...s, loading: true, error: null }))

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

      const taxon = data.resolved?.taxon || observations[0]?.taxon || null
      const place = data.resolved?.place || null
      const stats = computeStats(observations, data.total_results)
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
        place,
        stats,
        datasetSummary,
        loading: false,
      }))
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err.message }))
    }
  }, [])

  const reset = useCallback(() => setState(initialState), [])

  return { ...state, search, reset }
}
