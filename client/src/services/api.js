/**
 * Appel backend predict (Ollama local)
 */
export async function fetchPrediction({ observations, taxon, speciesName, biotope }) {
  const res = await fetch('/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ observations, taxon, speciesName, biotope }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Erreur serveur: ${res.status}`)
  }
  return res.json()
}

/**
 * Vérifie l'état d'Ollama et du modèle configuré
 * @returns {{ ollamaRunning, modelReady, models, configuredModel }}
 */
export async function checkOllamaStatus() {
  const res = await fetch('/api/predict/status')
  return res.json()
}

export async function checkHealth() {
  const res = await fetch('/api/health')
  return res.json()
}
