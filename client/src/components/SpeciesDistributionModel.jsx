import { useEffect, useState } from 'react'
import { fetchSdmTaxa, predictSpeciesDistribution } from '../services/sdm.js'
import styles from './SpeciesDistributionModel.module.css'

function numberLabel(value, digits = 0) {
  if (value === null || value === undefined) return '—'
  return Number(value).toLocaleString('fr-DZ', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function percentLabel(value) {
  if (value === null || value === undefined) return '—'
  return `${Math.round(Number(value) * 100)} %`
}

function sourceLabel(value) {
  return value === 'local_database' ? 'Base locale' : 'Observations courantes'
}

export default function SpeciesDistributionModel({
  observations = [],
  taxon = null,
  speciesName = '',
  useLocalDatabase = false,
}) {
  const [taxonName, setTaxonName] = useState(taxon?.name || speciesName || '')
  const [gridSize, setGridSize] = useState(14)
  const [taxa, setTaxa] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!useLocalDatabase) return
    let active = true
    fetchSdmTaxa()
      .then(payload => {
        if (active) setTaxa(payload.results || [])
      })
      .catch(() => {
        if (active) setTaxa([])
      })
    return () => {
      active = false
    }
  }, [useLocalDatabase])

  const runModel = async event => {
    event?.preventDefault()
    if (!taxonName.trim()) return

    setLoading(true)
    setError(null)
    try {
      const payload = await predictSpeciesDistribution({
        taxonName: taxonName.trim(),
        observations: useLocalDatabase ? [] : observations,
        gridSize,
      })
      setResult(payload)
    } catch (err) {
      setError(err.message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className={styles.wrapper}>
      <form className={styles.panel} onSubmit={runModel}>
        <label>
          <span>Taxon</span>
          <input
            value={taxonName}
            onChange={event => setTaxonName(event.target.value)}
            placeholder="Syrphidae"
            list={useLocalDatabase ? 'sdm-taxa' : undefined}
          />
          {useLocalDatabase && (
            <datalist id="sdm-taxa">
              {taxa.map(item => (
                <option key={item.name} value={item.name}>
                  {item.georeferenced} points
                </option>
              ))}
            </datalist>
          )}
        </label>
        <label>
          <span>Grille</span>
          <select value={gridSize} onChange={event => setGridSize(Number(event.target.value))}>
            <option value={10}>10 × 10</option>
            <option value={14}>14 × 14</option>
            <option value={20}>20 × 20</option>
          </select>
        </label>
        <button type="submit" disabled={loading || !taxonName.trim()}>
          {loading ? 'Calcul…' : 'Modéliser'}
        </button>
      </form>

      {error && <div className={styles.error}>{error}</div>}

      {result && (
        <>
          <div className={styles.metrics}>
            <div>
              <span>Source</span>
              <strong>{sourceLabel(result.dataSource)}</strong>
            </div>
            <div>
              <span>Présences</span>
              <strong>{numberLabel(result.taxon.presenceCount)}</strong>
            </div>
            <div>
              <span>Background</span>
              <strong>{numberLabel(result.backgroundCount)}</strong>
            </div>
            <div>
              <span>AUC</span>
              <strong>{numberLabel(result.evaluation.auc, 3)}</strong>
            </div>
          </div>

          <div className={styles.grid}>
            <section className={styles.section}>
              <h3>Nord / Sud</h3>
              <table>
                <thead>
                  <tr>
                    <th>Zone</th>
                    <th>Score moyen</th>
                    <th>Max</th>
                    <th>Présences</th>
                  </tr>
                </thead>
                <tbody>
                  {result.northSouth.map(row => (
                    <tr key={row.code}>
                      <td>{row.label}</td>
                      <td>{percentLabel(row.meanSuitability)}</td>
                      <td>{percentLabel(row.maxSuitability)}</td>
                      <td>{row.presenceCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className={styles.section}>
              <h3>Biotopes</h3>
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Score moyen</th>
                    <th>Max</th>
                    <th>Présences</th>
                  </tr>
                </thead>
                <tbody>
                  {result.biotopeSuitability.map(row => (
                    <tr key={row.code}>
                      <td>{row.label}</td>
                      <td>{percentLabel(row.meanSuitability)}</td>
                      <td>{percentLabel(row.maxSuitability)}</td>
                      <td>{row.presenceCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <section className={styles.section}>
            <h3>Cellules prioritaires</h3>
            <table>
              <thead>
                <tr>
                  <th>Score</th>
                  <th>Zone</th>
                  <th>Biotope</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                </tr>
              </thead>
              <tbody>
                {result.topCells.map(cell => (
                  <tr key={`${cell.latitude}-${cell.longitude}`}>
                    <td>{percentLabel(cell.suitability)}</td>
                    <td>{cell.zoneLabel}</td>
                    <td>{cell.biotopeLabel}</td>
                    <td>{numberLabel(cell.latitude, 5)}</td>
                    <td>{numberLabel(cell.longitude, 5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className={styles.grid}>
            <section className={styles.section}>
              <h3>Variables</h3>
              <table>
                <thead>
                  <tr>
                    <th>Variable</th>
                    <th>Poids</th>
                    <th>Sens</th>
                  </tr>
                </thead>
                <tbody>
                  {result.featureImportance.map(row => (
                    <tr key={row.feature}>
                      <td>{row.feature}</td>
                      <td>{numberLabel(row.weight, 4)}</td>
                      <td>{row.direction === 'positive' ? '+' : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className={styles.section}>
              <h3>Contrôle</h3>
              <dl className={styles.details}>
                <div>
                  <dt>Méthode</dt>
                  <dd>{result.algorithm}</dd>
                </div>
                <div>
                  <dt>Validation</dt>
                  <dd>{result.evaluation.method}</dd>
                </div>
                <div>
                  <dt>AUC train</dt>
                  <dd>{numberLabel(result.evaluation.trainAuc, 3)}</dd>
                </div>
                <div>
                  <dt>Latitude S/N</dt>
                  <dd>{numberLabel(result.northSouthSplitLatitude, 5)}</dd>
                </div>
              </dl>
            </section>
          </div>

          <section className={styles.warnings}>
            {result.warnings.map(item => (
              <p key={item}>{item}</p>
            ))}
          </section>
        </>
      )}
    </section>
  )
}
