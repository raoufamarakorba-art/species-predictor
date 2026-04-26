const BASE = '/api/inaturalist'
const PLACE_CONNECTOR_RE = /^(.+?)\s+(?:d['’]\s*|de\s+l['’]\s*|de\s+la\s+|de\s+|du\s+|des\s+|en\s+|dans\s+|à\s+|a\s+|in\s+)(.+)$/i
const COUNTRY_PLACE_PARTS = new Set(['algeria', 'algerie', 'dz', 'france', 'fr', 'worldwide'])

export function extractTaxonSearchTerm(value) {
  const query = value.trim()
  if (query.includes(',')) return query.split(',', 1)[0].trim()
  const match = query.match(PLACE_CONNECTOR_RE)
  return (match?.[1] || query).trim()
}

/**
 * Fetch species observations from iNaturalist via the local proxy
 * @param {Object} params
 * @param {string} params.taxonName
 * @param {string} [params.placeName]
 * @param {number} [params.perPage=200]
 */
export async function fetchObservations({ taxonName, placeName, perPage = 200 }) {
  const query = new URLSearchParams({ taxon_name: taxonName, per_page: perPage })
  if (placeName) query.set('place_name', placeName)

  const res = await fetch(`${BASE}/observations?${query}`)
  if (!res.ok) throw new Error(`Erreur iNaturalist: ${res.status}`)
  return res.json()
}

/**
 * Autocomplete species name suggestions
 * @param {string} q
 */
export async function autocompleteTaxa(q) {
  const taxonTerm = extractTaxonSearchTerm(q)
  if (taxonTerm.length < 2) return []
  const res = await fetch(`${BASE}/taxa/autocomplete?q=${encodeURIComponent(taxonTerm)}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.results || []
}

function normalizePlacePart(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function localPlaceName(placeGuess) {
  const parts = String(placeGuess || '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)

  if (parts.length === 0) return 'Autre'

  const local = parts.find(part => !COUNTRY_PLACE_PARTS.has(normalizePlacePart(part)))
  return (local || parts[0]).slice(0, 32)
}

/**
 * Compute statistics from a raw observations array
 * @param {Array} observations
 */
export function computeStats(observations, totalResults = observations.length) {
  const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

  const monthCounts = new Array(12).fill(0)
  const yearMap = {}
  const placeMap = {}
  const coordinatesPresent = []

  observations.forEach(o => {
    if (o.observed_on) {
      const m = parseInt(o.observed_on.slice(5, 7)) - 1
      const y = o.observed_on.slice(0, 4)
      if (m >= 0 && m < 12) monthCounts[m]++
      yearMap[y] = (yearMap[y] || 0) + 1
    }
    if (o.place_guess) {
      const key = localPlaceName(o.place_guess)
      placeMap[key] = (placeMap[key] || 0) + 1
    }
    if (o.geojson?.coordinates) coordinatesPresent.push(o.geojson.coordinates)
  })

  const sortedYears = Object.keys(yearMap).sort()
  const topPlaces = Object.entries(placeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  const peakMonth = monthCounts.indexOf(Math.max(...monthCounts))
  const totalYears = sortedYears.length
  const avgPerYear = totalYears > 1 ? (observations.length / totalYears).toFixed(1) : '-'
  const total = Number.isFinite(totalResults) ? totalResults : observations.length

  // Detect trend: compare first half vs second half of years
  let trend = 'stable'
  if (sortedYears.length >= 4) {
    const mid = Math.floor(sortedYears.length / 2)
    const firstHalf = sortedYears.slice(0, mid).reduce((s, y) => s + (yearMap[y] || 0), 0)
    const secondHalf = sortedYears.slice(mid).reduce((s, y) => s + (yearMap[y] || 0), 0)
    const ratio = secondHalf / (firstHalf || 1)
    if (ratio > 1.4) trend = 'increasing'
    else if (ratio < 0.6) trend = 'decreasing'
  }

  return {
    total,
    sampleSize: observations.length,
    monthCounts,
    monthLabels: MONTHS,
    yearMap,
    sortedYears,
    topPlaces,
    peakMonth,
    peakMonthLabel: MONTHS[peakMonth],
    avgPerYear,
    totalYears,
    coordinates: coordinatesPresent,
    uniquePlaces: Object.keys(placeMap).length,
    trend,
  }
}
