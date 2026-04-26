import { useRef, useState } from 'react'
import { AnalysisReport, acceptedAnalysisFiles, analysisFromFile } from './AnalysisReport.jsx'
import styles from './ChatGPTAnalysis.module.css'

export const reportStorageKey = 'species-predictor:report-analysis'

export default function ReportImportMode() {
  const [analysis, setAnalysis] = useState(loadStoredAnalysis)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)

  const setImportedAnalysis = nextAnalysis => {
    setAnalysis(nextAnalysis)
    storeAnalysis(nextAnalysis)
  }

  const importFile = async file => {
    try {
      setError('')
      setImportedAnalysis(await analysisFromFile(file))
    } catch (err) {
      setError(err.message)
    }
  }

  const importAnalysis = async event => {
    const file = event.target.files?.[0]
    if (file) await importFile(file)
    event.target.value = ''
  }

  const clearAnalysis = () => {
    setAnalysis(null)
    setError('')
    window.localStorage?.removeItem(reportStorageKey)
  }

  const handleDrop = async event => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) await importFile(file)
  }

  const openFilePicker = () => fileInputRef.current?.click()

  const openFilePickerFromKeyboard = event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openFilePicker()
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div>
            <span className={styles.kicker}>Rapport local</span>
            <h3 className={styles.title}>Ouvrir une analyse Markdown</h3>
          </div>
          <span className={styles.tag}>.md / .json</span>
        </div>

        <p className={styles.description}>
          Chargez un rapport ChatGPT déjà généré sans lancer de nouvelle recherche iNaturalist.
        </p>

        <div
          className={`${styles.dropzone} ${dragging ? styles.activeDropzone : ''}`}
          onDragEnter={() => setDragging(true)}
          onDragLeave={() => setDragging(false)}
          onDragOver={event => event.preventDefault()}
          onDrop={handleDrop}
          onClick={openFilePicker}
          onKeyDown={openFilePickerFromKeyboard}
          role="button"
          tabIndex="0"
          aria-label="Importer un rapport Markdown ou JSON"
        >
          <strong>Déposer le rapport ici</strong>
          <span>Markdown, texte ou JSON</span>
        </div>

        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={openFilePicker}>
            Ouvrir un rapport
          </button>
          <input
            ref={fileInputRef}
            className={styles.fileInput}
            type="file"
            accept={acceptedAnalysisFiles}
            onChange={importAnalysis}
          />
        </div>
        {error && (
          <p className={styles.errorMessage}>{error}</p>
        )}
      </div>

      <AnalysisReport analysis={analysis} onClear={clearAnalysis} />
    </div>
  )
}

function loadStoredAnalysis() {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage?.getItem(reportStorageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !['markdown', 'json'].includes(parsed.type) || !parsed.name) return null
    return parsed
  } catch {
    return null
  }
}

function storeAnalysis(analysis) {
  try {
    window.localStorage?.setItem(reportStorageKey, JSON.stringify(analysis))
  } catch {
    // Persistence is a convenience; importing the current file should still work.
  }
}
