import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styles from './ChatGPTAnalysis.module.css'

export const acceptedAnalysisFiles = '.md,.markdown,.txt,.json,application/json,text/markdown,text/plain'

const acceptedExtensions = ['.md', '.markdown', '.txt', '.json']
const acceptedMimeTypes = ['application/json', 'text/markdown', 'text/plain']

const markdownPlugins = [remarkGfm]

export function isAcceptedAnalysisFile(file) {
  const name = file?.name?.toLowerCase() || ''
  return acceptedExtensions.some(extension => name.endsWith(extension)) || acceptedMimeTypes.includes(file?.type)
}

export async function analysisFromFile(file) {
  if (!file) throw new Error('Aucun fichier sélectionné.')
  if (!isAcceptedAnalysisFile(file)) {
    throw new Error('Format non pris en charge. Utilisez un fichier Markdown, texte ou JSON.')
  }

  let text = ''
  try {
    text = await file.text()
  } catch {
    throw new Error('Impossible de lire ce fichier.')
  }

  const name = file.name || 'rapport'
  const isJson = name.toLowerCase().endsWith('.json') || file.type === 'application/json'
  if (isJson) {
    try {
      return { type: 'json', name, value: JSON.parse(text) }
    } catch {
      throw new Error('Le fichier JSON est invalide.')
    }
  }

  return { type: 'markdown', name, value: text }
}

export function AnalysisReport({ analysis, onClear, onPrint = printPage }) {
  if (!analysis) return null

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <span className={styles.kicker}>Analyse importée</span>
          <h3 className={styles.title}>{analysis.name}</h3>
        </div>
        <div className={styles.reportActions}>
          <button className={styles.btn} onClick={onPrint}>Imprimer</button>
          {onClear && (
            <button className={styles.btn} onClick={onClear}>Effacer</button>
          )}
        </div>
      </div>
      {analysis.type === 'json' ? (
        <StructuredAnalysis value={analysis.value} />
      ) : (
        <MarkdownAnalysis value={analysis.value} />
      )}
    </div>
  )
}

function MarkdownAnalysis({ value }) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown remarkPlugins={markdownPlugins}>
        {value}
      </ReactMarkdown>
    </div>
  )
}

function StructuredAnalysis({ value }) {
  return (
    <div className={styles.structured}>
      {Object.entries(value).map(([key, item]) => (
        <section key={key} className={styles.section}>
          <h4>{formatKey(key)}</h4>
          <StructuredValue value={item} />
        </section>
      ))}
    </div>
  )
}

function StructuredValue({ value }) {
  if (Array.isArray(value)) {
    return <StructuredArray value={value} />
  }

  if (value && typeof value === 'object') {
    return <StructuredObject value={value} />
  }

  return <p className={styles.scalarValue}>{formatScalar(value)}</p>
}

function StructuredObject({ value }) {
  const entries = Object.entries(value)
  if (entries.length === 0) return <p className={styles.scalarValue}>Aucune donnée.</p>

  if (entries.every(([_key, item]) => isScalar(item))) {
    return (
      <dl className={styles.keyValueGrid}>
        {entries.map(([key, item]) => (
          <div key={key} className={styles.keyValueItem}>
            <dt>{formatKey(key)}</dt>
            <dd>{formatScalar(item)}</dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <div className={styles.nestedSections}>
      {entries.map(([key, item]) => (
        <section key={key} className={styles.nestedSection}>
          <h5>{formatKey(key)}</h5>
          <StructuredValue value={item} />
        </section>
      ))}
    </div>
  )
}

function StructuredArray({ value }) {
  if (value.length === 0) return <p className={styles.scalarValue}>Aucun élément.</p>

  if (value.every(isScalar)) {
    return (
      <ul className={styles.valueList}>
        {value.map((item, index) => (
          <li key={`${item}-${index}`}>{formatScalar(item)}</li>
        ))}
      </ul>
    )
  }

  if (value.every(isFlatObject)) {
    return <StructuredTable rows={value} />
  }

  return (
    <div className={styles.itemList}>
      {value.map((item, index) => (
        <div key={index} className={styles.nestedCard}>
          <StructuredValue value={item} />
        </div>
      ))}
    </div>
  )
}

function StructuredTable({ rows }) {
  const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row))))

  return (
    <div className={styles.tableWrap}>
      <table className={styles.structuredTable}>
        <thead>
          <tr>
            {columns.map(column => (
              <th key={column}>{formatKey(column)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map(column => (
                <td key={column}>{formatScalar(row[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, char => char.toUpperCase())
}

function formatScalar(value) {
  if (typeof value === 'boolean') return value ? 'oui' : 'non'
  return String(value ?? '')
}

function isScalar(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value)
}

function isFlatObject(value) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every(isScalar)
  )
}

function printPage() {
  window.print?.()
}
