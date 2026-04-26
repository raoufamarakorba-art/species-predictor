import { useRef, useState } from 'react'
import { AnalysisReport, acceptedAnalysisFiles, analysisFromFile } from './AnalysisReport.jsx'
import styles from './ChatGPTAnalysis.module.css'

export default function ReportImportMode() {
  const [analysis, setAnalysis] = useState(null)
  const fileInputRef = useRef(null)

  const importAnalysis = async event => {
    const file = event.target.files?.[0]
    if (!file) return

    setAnalysis(await analysisFromFile(file))
    event.target.value = ''
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

        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={() => fileInputRef.current?.click()}>
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
      </div>

      <AnalysisReport analysis={analysis} onClear={() => setAnalysis(null)} />
    </div>
  )
}
