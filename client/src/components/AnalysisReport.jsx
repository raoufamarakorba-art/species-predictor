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

function printPage() {
  window.print?.()
}
