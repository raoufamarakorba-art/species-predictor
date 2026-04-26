import { useMemo, useRef, useState } from 'react'
import {
  buildChatGPTMetadata,
  buildChatGPTPrompt,
} from '../services/chatgptExport.js'
import {
  downloadTextFile,
  exportFilename,
  observationsToCsv,
  observationsToGeoJson,
} from '../services/datasets.js'
import styles from './ChatGPTAnalysis.module.css'

export default function ChatGPTAnalysis({ observations, taxon, stats, datasetSummary, speciesName }) {
  const [analysis, setAnalysis] = useState(null)
  const fileInputRef = useRef(null)

  const metadata = useMemo(
    () => buildChatGPTMetadata({ observations, taxon, stats, datasetSummary, speciesName }),
    [observations, taxon, stats, datasetSummary, speciesName]
  )
  const prompt = useMemo(() => buildChatGPTPrompt({ metadata }), [metadata])
  const geojson = useMemo(() => observationsToGeoJson(observations), [observations])
  const baseName = taxon?.name || speciesName || 'species'

  if (!observations?.length) return null

  const exportCsv = () => {
    downloadTextFile(
      exportFilename(baseName, 'csv'),
      observationsToCsv(observations),
      'text/csv;charset=utf-8'
    )
  }

  const exportGeoJson = () => {
    downloadTextFile(
      exportFilename(baseName, 'geojson'),
      JSON.stringify(geojson, null, 2),
      'application/geo+json;charset=utf-8'
    )
  }

  const exportMetadata = () => {
    downloadTextFile(
      exportFilename(baseName, 'metadata.json'),
      JSON.stringify(metadata, null, 2),
      'application/json;charset=utf-8'
    )
  }

  const exportPrompt = () => {
    downloadTextFile(
      exportFilename(baseName, 'prompt.md'),
      prompt,
      'text/markdown;charset=utf-8'
    )
  }

  const importAnalysis = async event => {
    const file = event.target.files?.[0]
    if (!file) return

    const text = await file.text()
    try {
      setAnalysis({ type: 'json', name: file.name, value: JSON.parse(text) })
    } catch {
      setAnalysis({ type: 'text', name: file.name, value: text })
    }
    event.target.value = ''
  }

  return (
    <div className={styles.container}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div>
            <span className={styles.kicker}>Analyse externe</span>
            <h3 className={styles.title}>ChatGPT Data Analysis</h3>
          </div>
          <span className={styles.tag}>{metadata.dataset.loadedObservations} lignes</span>
        </div>

        <div className={styles.actions}>
          <button className={styles.btn} onClick={exportCsv}>CSV</button>
          <button className={styles.btn} onClick={exportGeoJson} disabled={geojson.features.length === 0}>
            GeoJSON
          </button>
          <button className={styles.btn} onClick={exportMetadata}>Métadonnées</button>
          <button className={styles.btnPrimary} onClick={exportPrompt}>Prompt ChatGPT</button>
          <button className={styles.btn} onClick={() => fileInputRef.current?.click()}>
            Importer analyse
          </button>
          <input
            ref={fileInputRef}
            className={styles.fileInput}
            type="file"
            accept=".md,.txt,.json,application/json,text/markdown,text/plain"
            onChange={importAnalysis}
          />
        </div>

        <div className={styles.metaGrid}>
          <Metric label="Total iNaturalist" value={metadata.dataset.totalObservations} />
          <Metric label="Export CSV" value={metadata.dataset.loadedObservations} />
          <Metric label="Géoréférencées" value={metadata.dataset.georeferencedObservations} />
          <Metric label="Rang taxon" value={metadata.query.rank || 'inconnu'} />
        </div>
      </div>

      {analysis && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <div>
              <span className={styles.kicker}>Analyse importée</span>
              <h3 className={styles.title}>{analysis.name}</h3>
            </div>
            <button className={styles.btn} onClick={() => setAnalysis(null)}>Effacer</button>
          </div>
          {analysis.type === 'json' ? (
            <StructuredAnalysis value={analysis.value} />
          ) : (
            <pre className={styles.markdown}>{analysis.value}</pre>
          )}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <strong className={styles.metricValue}>{value}</strong>
    </div>
  )
}

function StructuredAnalysis({ value }) {
  return (
    <div className={styles.structured}>
      {Object.entries(value).map(([key, item]) => (
        <section key={key} className={styles.section}>
          <h4>{formatKey(key)}</h4>
          <p>{formatValue(item)}</p>
        </section>
      ))}
    </div>
  )
}

function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, char => char.toUpperCase())
}

function formatValue(value) {
  if (Array.isArray(value)) {
    if (value.every(item => item === null || ['string', 'number', 'boolean'].includes(typeof item))) {
      return value.map(item => `- ${item}`).join('\n')
    }
    return JSON.stringify(value, null, 2)
  }
  if (value && typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value ?? '')
}
