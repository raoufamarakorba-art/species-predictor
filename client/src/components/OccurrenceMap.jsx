import { useEffect, useMemo } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import styles from './OccurrenceMap.module.css'

function observationPoint(observation) {
  const coordinates = observation.geojson?.coordinates
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null
  const lon = Number(coordinates[0])
  const lat = Number(coordinates[1])
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  return { lat, lon }
}

function FitBounds({ points }) {
  const map = useMap()

  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lon], 7)
      return
    }
    map.fitBounds(points.map(point => [point.lat, point.lon]), {
      padding: [24, 24],
      maxZoom: 9,
    })
  }, [map, points])

  return null
}

export default function OccurrenceMap({ observations }) {
  const points = useMemo(
    () => observations
      .map(observation => ({ observation, point: observationPoint(observation) }))
      .filter(item => item.point),
    [observations]
  )

  if (!points.length) return null

  const center = [points[0].point.lat, points[0].point.lon]

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.title}>Carte des occurrences</span>
        <span className={styles.count}>{points.length} points</span>
      </div>
      <div className={styles.mapShell}>
        <MapContainer center={center} zoom={5} className={styles.map} scrollWheelZoom={false}>
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points.map(item => item.point)} />
          {points.slice(0, 200).map(({ observation, point }) => (
            <CircleMarker
              key={observation.id}
              center={[point.lat, point.lon]}
              radius={5}
              pathOptions={{ color: '#1D9E75', fillColor: '#1D9E75', fillOpacity: 0.55, weight: 1 }}
            >
              <Popup>
                <div className={styles.popupTitle}>{observation.taxon?.name || 'Observation'}</div>
                <div className={styles.popupMeta}>{observation.observed_on || '?'}</div>
                <a
                  href={observation.uri || `https://www.inaturalist.org/observations/${observation.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Voir sur iNaturalist
                </a>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
