import {
  downloadTextFile,
  exportFilename,
  observationsToCsv,
  observationsToGeoJson,
} from '../services/datasets.js'
import styles from './DataExports.module.css'

export default function DataExports({ observations, speciesName }) {
  if (!observations?.length) return null

  const geojson = observationsToGeoJson(observations)
  const coordinateCount = geojson.features.length

  const exportCsv = () => {
    downloadTextFile(
      exportFilename(speciesName, 'csv'),
      observationsToCsv(observations),
      'text/csv;charset=utf-8'
    )
  }

  const exportGeoJson = () => {
    downloadTextFile(
      exportFilename(speciesName, 'geojson'),
      JSON.stringify(geojson, null, 2),
      'application/geo+json;charset=utf-8'
    )
  }

  return (
    <div className={styles.bar}>
      <div>
        <div className={styles.label}>Jeu de données</div>
        <div className={styles.meta}>
          {observations.length} observations · {coordinateCount} géoréférencées
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.btn} onClick={exportCsv}>CSV</button>
        <button className={styles.btn} onClick={exportGeoJson} disabled={coordinateCount === 0}>
          GeoJSON
        </button>
      </div>
    </div>
  )
}
