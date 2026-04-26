import {
  downloadTextFile,
  exportFilename,
  importDatasetRecords,
  observationsToCsv,
  observationsToGeoJson,
} from '../services/datasets.js'
import { useState } from 'react'
import styles from './DataExports.module.css'

export default function DataExports({ observations, speciesName, taxon, place }) {
  const [saveStatus, setSaveStatus] = useState(null)

  if (!observations?.length) return null

  const geojson = observationsToGeoJson(observations)
  const coordinateCount = geojson.features.length
  const saving = saveStatus?.state === 'saving'

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

  const saveToLibrary = async () => {
    setSaveStatus({ state: 'saving', message: 'Enregistrement…' })
    try {
      const result = await importDatasetRecords({
        source: {
          name: 'iNaturalist',
          type: 'inaturalist',
          url: 'https://www.inaturalist.org',
          license: 'Source publique iNaturalist; vérifier la licence par observation avant publication.',
          metadata: {
            taxon: taxon?.name || speciesName || null,
            place: place?.display_name || place?.name || null,
          },
        },
        observations,
      })
      setSaveStatus({
        state: 'saved',
        message: `${result.created} nouvelles · ${result.updated} mises à jour · ${result.totalStored} en base`,
      })
    } catch (err) {
      setSaveStatus({ state: 'error', message: err.message })
    }
  }

  return (
    <div className={styles.bar}>
      <div>
        <div className={styles.label}>Jeu de données</div>
        <div className={styles.meta}>
          {observations.length} observations · {coordinateCount} géoréférencées
        </div>
        {saveStatus && (
          <div className={`${styles.status} ${styles[saveStatus.state]}`} role="status">
            {saveStatus.message}
          </div>
        )}
      </div>
      <div className={styles.actions}>
        <button className={styles.btn} onClick={saveToLibrary} disabled={saving}>
          {saving ? 'Stockage…' : 'Enregistrer'}
        </button>
        <button className={styles.btn} onClick={exportCsv}>CSV</button>
        <button className={styles.btn} onClick={exportGeoJson} disabled={coordinateCount === 0}>
          GeoJSON
        </button>
      </div>
    </div>
  )
}
