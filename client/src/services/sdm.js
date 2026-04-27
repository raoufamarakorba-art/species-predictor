export async function predictSpeciesDistribution({ taxonName, observations = [], gridSize = 14 }) {
  const res = await fetch('/api/sdm/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taxonName, observations, gridSize }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || err.error || `Erreur modèle SDM: ${res.status}`)
  }
  return res.json()
}

export async function fetchSdmTaxa(limit = 50) {
  const res = await fetch(`/api/sdm/taxa?limit=${encodeURIComponent(limit)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || err.error || `Erreur taxons SDM: ${res.status}`)
  }
  return res.json()
}
