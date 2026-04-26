import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styles from './ChatGPTAnalysis.module.css'

export const acceptedAnalysisFiles = '.md,.txt,.json,application/json,text/markdown,text/plain'

const markdownPlugins = [remarkGfm]

export async function analysisFromFile(file) {
  const text = await file.text()
  try {
    return { type: 'json', name: file.name, value: JSON.parse(text) }
  } catch {
    return { type: 'markdown', name: file.name, value: text }
  }
}

export function AnalysisReport({ analysis, onClear }) {
  if (!analysis) return null

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <span className={styles.kicker}>Analyse importée</span>
          <h3 className={styles.title}>{analysis.name}</h3>
        </div>
        {onClear && (
          <button className={styles.btn} onClick={onClear}>Effacer</button>
        )}
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
