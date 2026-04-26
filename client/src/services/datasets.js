export async function fetchDatasetSummary(observations) {
  const res = await fetch('/api/datasets/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ observations }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Erreur résumé dataset: ${res.status}`)
  }
  return res.json()
}

export async function importDatasetRecords({ source, observations }) {
  const res = await fetch('/api/datasets/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, observations }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || err.error || `Erreur import dataset: ${res.status}`)
  }
  return res.json()
}

export async function fetchDatasetLibrary() {
  const res = await fetch('/api/datasets/library')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || err.error || `Erreur bibliothèque: ${res.status}`)
  }
  return res.json()
}

export async function fetchStoredOccurrences(limit = 50) {
  const res = await fetch(`/api/datasets/occurrences?limit=${encodeURIComponent(limit)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || err.error || `Erreur occurrences stockées: ${res.status}`)
  }
  return res.json()
}

function csvValue(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

function observationCoordinates(observation) {
  const coordinates = observation.geojson?.coordinates
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null
  const lon = Number(coordinates[0])
  const lat = Number(coordinates[1])
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  return { lon, lat }
}

export function observationsToCsv(observations) {
  const headers = [
    'id',
    'taxon_id',
    'scientific_name',
    'common_name',
    'observed_on',
    'created_at',
    'quality_grade',
    'latitude',
    'longitude',
    'place_guess',
    'user',
    'url',
  ]

  const rows = observations.map(observation => {
    const coords = observationCoordinates(observation)
    return [
      observation.id,
      observation.taxon?.id,
      observation.taxon?.name,
      observation.taxon?.preferred_common_name,
      observation.observed_on,
      observation.created_at,
      observation.quality_grade,
      coords?.lat,
      coords?.lon,
      observation.place_guess,
      observation.user?.login,
      observation.uri || `https://www.inaturalist.org/observations/${observation.id}`,
    ].map(csvValue).join(',')
  })

  return [headers.join(','), ...rows].join('\n')
}

export function observationsToGeoJson(observations) {
  return {
    type: 'FeatureCollection',
    features: observations
      .map(observation => {
        const coords = observationCoordinates(observation)
        if (!coords) return null

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [coords.lon, coords.lat],
          },
          properties: {
            id: observation.id,
            taxon_id: observation.taxon?.id ?? null,
            scientific_name: observation.taxon?.name ?? null,
            common_name: observation.taxon?.preferred_common_name ?? null,
            observed_on: observation.observed_on ?? null,
            quality_grade: observation.quality_grade ?? null,
            place_guess: observation.place_guess ?? null,
            user: observation.user?.login ?? null,
            url: observation.uri || `https://www.inaturalist.org/observations/${observation.id}`,
          },
        }
      })
      .filter(Boolean),
  }
}

export function downloadTextFile(filename, content, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function exportFilename(speciesName, extension) {
  const safeName = (speciesName || 'species')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${safeName || 'species'}-observations.${extension}`
}
