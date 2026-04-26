import { useEffect, useMemo, useState } from 'react'
import {
  fetchDatasetLibrary,
  fetchStoredOccurrences,
  importDatasetRecords,
} from '../services/datasets.js'
import styles from './DatasetLibrary.module.css'

const SOURCE_TYPES = [
  { value: 'field', label: 'Terrain' },
  { value: 'literature', label: 'Article' },
  { value: 'gbif', label: 'GBIF' },
  { value: 'inaturalist', label: 'iNaturalist' },
  { value: 'other', label: 'Autre' },
]

const INITIAL_SOURCE = {
  type: 'field',
  name: '',
  citation: '',
  url: '',
  license: '',
  notes: '',
}

function emptyToNull(value) {
  const text = String(value || '').trim()
  return text || null
}

function detectDelimiter(line) {
  const candidates = [',', ';', '\t']
  return candidates
    .map(delimiter => ({ delimiter, count: line.split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0].delimiter
}

function parseDelimitedRows(text, delimiter) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
      continue
    }
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === delimiter && !quoted) {
      row.push(cell)
      cell = ''
      continue
    }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1
      row.push(cell)
      if (row.some(value => value.trim() !== '')) rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += char
  }

  row.push(cell)
  if (row.some(value => value.trim() !== '')) rows.push(row)
  return rows
}

function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || ''
  const delimiter = detectDelimiter(firstLine)
  const rows = parseDelimitedRows(text, delimiter)
  const headers = rows.shift()?.map(header => header.trim()) || []

  return rows
    .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() || null])))
    .filter(record => Object.values(record).some(Boolean))
}

function featureToRecord(feature) {
  const coordinates = feature?.geometry?.coordinates
  return {
    ...(feature?.properties || {}),
    decimalLongitude: Array.isArray(coordinates) ? coordinates[0] : undefined,
    decimalLatitude: Array.isArray(coordinates) ? coordinates[1] : undefined,
  }
}

function recordsFromJson(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.observations)) return data.observations
  if (Array.isArray(data?.results)) return data.results
  if (data?.type === 'FeatureCollection' && Array.isArray(data.features)) {
    return data.features.map(featureToRecord)
  }
  if (data && typeof data === 'object') return [data]
  return []
}

async function recordsFromFile(file) {
  const text = await file.text()
  const trimmed = text.trim()
  if (!trimmed) return []

  const isJson = file.name.toLowerCase().endsWith('.json') || ['[', '{'].includes(trimmed[0])
  if (isJson) return recordsFromJson(JSON.parse(trimmed))

  return parseCsv(trimmed)
}

function metricLabel(value) {
  return Number(value || 0).toLocaleString('fr-DZ')
}

async function loadLibraryData() {
  const [library, stored] = await Promise.all([
    fetchDatasetLibrary(),
    fetchStoredOccurrences(50),
  ])
  return { library, stored }
}

export default function DatasetLibrary() {
  const [summary, setSummary] = useState(null)
  const [occurrences, setOccurrences] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [source, setSource] = useState(INITIAL_SOURCE)
  const [file, setFile] = useState(null)
  const [importStatus, setImportStatus] = useState(null)

  const hasData = Number(summary?.totalOccurrences || 0) > 0
  const sourceTypes = useMemo(() => summary?.bySourceType || {}, [summary])

  const applyLibraryData = ({ library, stored }) => {
    setSummary(library)
    setOccurrences(stored.results || [])
  }

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      applyLibraryData(await loadLibraryData())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    loadLibraryData()
      .then(data => {
        if (!active) return
        setSummary(data.library)
        setOccurrences(data.stored.results || [])
      })
      .catch(err => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const updateSource = event => {
    const { name, value } = event.target
    setSource(current => ({ ...current, [name]: value }))
  }

  const importFile = async event => {
    event.preventDefault()
    if (!file) return

    setImportStatus({ state: 'saving', message: 'Import en cours…' })
    try {
      const records = await recordsFromFile(file)
      if (!records.length) throw new Error('Aucune observation exploitable dans le fichier.')

      const result = await importDatasetRecords({
        source: {
          type: source.type,
          name: emptyToNull(source.name) || file.name,
          citation: emptyToNull(source.citation),
          url: emptyToNull(source.url),
          license: emptyToNull(source.license),
          notes: emptyToNull(source.notes),
          metadata: { originalFile: file.name },
        },
        observations: records,
      })

      setImportStatus({
        state: 'saved',
        message: `${result.created} nouvelles · ${result.updated} mises à jour · ${result.skipped} ignorées`,
      })
      setSource(INITIAL_SOURCE)
      setFile(null)
      event.target.reset()
      await refresh()
    } catch (err) {
      setImportStatus({ state: 'failed', message: err.message })
    }
  }

  return (
    <section className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h2>Base locale</h2>
          <p>{summary?.databasePath || 'data/species_predictor.sqlite3'}</p>
        </div>
        <button className={styles.secondaryBtn} onClick={refresh} type="button" disabled={loading}>
          Actualiser
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span>Occurrences</span>
          <strong>{metricLabel(summary?.totalOccurrences)}</strong>
        </div>
        <div className={styles.metric}>
          <span>Géoréférencées</span>
          <strong>{metricLabel(summary?.georeferencedOccurrences)}</strong>
        </div>
        <div className={styles.metric}>
          <span>Taxons</span>
          <strong>{metricLabel(summary?.taxa)}</strong>
        </div>
        <div className={styles.metric}>
          <span>Localités</span>
          <strong>{metricLabel(summary?.localities)}</strong>
        </div>
      </div>

      <form className={styles.importPanel} onSubmit={importFile}>
        <div className={styles.formGrid}>
          <label>
            <span>Type</span>
            <select name="type" value={source.type} onChange={updateSource}>
              {SOURCE_TYPES.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Source</span>
            <input name="name" value={source.name} onChange={updateSource} placeholder="Nom du jeu de données" />
          </label>
          <label>
            <span>Citation</span>
            <input name="citation" value={source.citation} onChange={updateSource} placeholder="Référence ou auteur" />
          </label>
          <label>
            <span>URL / DOI</span>
            <input name="url" value={source.url} onChange={updateSource} placeholder="https://doi.org/..." />
          </label>
          <label>
            <span>Licence</span>
            <input name="license" value={source.license} onChange={updateSource} placeholder="CC-BY, CC0..." />
          </label>
          <label>
            <span>Fichier</span>
            <input
              type="file"
              accept=".csv,.tsv,.txt,.json,.geojson"
              onChange={event => setFile(event.target.files?.[0] || null)}
            />
          </label>
        </div>
        <label className={styles.notesField}>
          <span>Notes</span>
          <input name="notes" value={source.notes} onChange={updateSource} placeholder="Contexte terrain, protocole, filtre appliqué" />
        </label>
        <div className={styles.formFooter}>
          {importStatus && (
            <div className={`${styles.status} ${styles[importStatus.state]}`} role="status">
              {importStatus.message}
            </div>
          )}
          <button className={styles.primaryBtn} type="submit" disabled={!file || importStatus?.state === 'saving'}>
            Importer dans la base
          </button>
        </div>
      </form>

      <div className={styles.columns}>
        <section className={styles.section}>
          <h3>Sources</h3>
          {hasData ? (
            <div className={styles.sourceList}>
              {summary.sources.map(item => (
                <div className={styles.sourceItem} key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.type} · {metricLabel(item.records)} enregistrements</span>
                  </div>
                  {item.url && <a href={item.url} target="_blank" rel="noreferrer">Lien</a>}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>Aucune source enregistrée</div>
          )}
        </section>

        <section className={styles.section}>
          <h3>Types</h3>
          {Object.keys(sourceTypes).length ? (
            <div className={styles.typeList}>
              {Object.entries(sourceTypes).map(([type, count]) => (
                <div key={type}>
                  <span>{type}</span>
                  <strong>{metricLabel(count)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>Aucun type enregistré</div>
          )}
        </section>
      </div>

      <section className={styles.section}>
        <h3>Occurrences récentes</h3>
        {occurrences.length ? (
          <div className={styles.occurrenceTableWrap}>
            <table className={styles.occurrenceTable}>
              <thead>
                <tr>
                  <th>Taxon</th>
                  <th>Date</th>
                  <th>Localité</th>
                  <th>Source</th>
                  <th>Coordonnées</th>
                </tr>
              </thead>
              <tbody>
                {occurrences.map(item => (
                  <tr key={item.id}>
                    <td>{item.scientific_name || item.taxon_id || 'Taxon inconnu'}</td>
                    <td>{item.observed_on || '—'}</td>
                    <td>{item.locality || item.place_guess || '—'}</td>
                    <td>{item.sources.map(sourceItem => sourceItem.name).join(', ')}</td>
                    <td>
                      {item.latitude !== null && item.longitude !== null
                        ? `${Number(item.latitude).toFixed(5)}, ${Number(item.longitude).toFixed(5)}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.empty}>Aucune occurrence enregistrée</div>
        )}
      </section>
    </section>
  )
}
