import styles from './Predictions.module.css'

const BAR_COLORS = ['#1D9E75','#378ADD','#BA7517','#D85A30','#7F77DD','#D4537E','#639922']

const TREND_LABELS = {
  increasing: { label: '↑ En progression', cls: 'success' },
  decreasing: { label: '↓ En déclin', cls: 'danger' },
  stable: { label: '→ Stable', cls: 'neutral' },
}

const CONF_CLS = { 'Haute': 'high', 'Moyenne': 'med', 'Basse': 'low' }

export default function Predictions({ prediction, loading, error }) {
  if (loading) return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.aiLabel}>Analyse IA</span>
        <span className={styles.tag}>Ollama</span>
      </div>
      <div className={styles.skeleton}>
        <div className={styles.skBar} style={{ width: '80%' }} />
        <div className={styles.skBar} style={{ width: '60%' }} />
        <div className={styles.skBar} style={{ width: '70%' }} />
      </div>
    </div>
  )

  if (error) return (
    <div className={styles.panel}>
      <div className={styles.errorMsg}>{error}</div>
    </div>
  )

  if (!prediction) return null

  const trend = prediction.trend || 'stable'
  const trendInfo = TREND_LABELS[trend] || TREND_LABELS.stable

  return (
    <div className={styles.container}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.aiLabel}>Synthèse écologique</span>
          <span className={styles.tag}>Ollama</span>
        </div>
        <p className={styles.summary}>{prediction.summary}</p>
        <div className={styles.metaRow}>
          <span className={`${styles.badge} ${styles[trendInfo.cls]}`}>{trendInfo.label}</span>
          <span className={styles.trendExp}>{prediction.trendExplanation}</span>
        </div>
        {prediction.keyFactors?.length > 0 && (
          <div className={styles.factorsRow}>
            {prediction.keyFactors.map((f, i) => (
              <span key={i} className={styles.factorTag}>{f}</span>
            ))}
          </div>
        )}
      </div>

      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.aiLabel}>Probabilité de présence par biotope</span>
        </div>
        <div className={styles.predGrid}>
          {(prediction.predictions || []).map((p, i) => (
            <div key={i} className={styles.predCard}>
              <div className={styles.predHeader}>
                <span className={styles.biotopeName}>{p.biotope}</span>
                <span className={`${styles.confBadge} ${styles[CONF_CLS[p.confidence] || 'low']}`}>
                  {p.confidence}
                </span>
              </div>
              <div className={styles.barWrap}>
                <div
                  className={styles.bar}
                  style={{
                    width: `${p.probability}%`,
                    background: BAR_COLORS[i % BAR_COLORS.length],
                  }}
                />
              </div>
              <div className={styles.predMeta}>
                <span>{p.probability}% présence</span>
                <span>Abondance: {p.abundance}</span>
              </div>
              {p.season && <div className={styles.season}>{p.season}</div>}
              {p.notes && <p className={styles.notes}>{p.notes}</p>}
            </div>
          ))}
        </div>
      </div>

      {prediction.seasonality && (
        <div className={styles.panel}>
          <div className={styles.header}><span className={styles.aiLabel}>Phénologie</span></div>
          <p className={styles.summary}>{prediction.seasonality}</p>
        </div>
      )}

      {prediction.conservation && (
        <div className={styles.panel}>
          <div className={styles.header}><span className={styles.aiLabel}>Conservation</span></div>
          <p className={styles.summary}>{prediction.conservation}</p>
        </div>
      )}

      {prediction.dataQuality && (
        <div className={`${styles.panel} ${styles.quality}`}>
          <span className={styles.qualityLabel}>Qualité des données · </span>
          <span className={styles.qualityText}>{prediction.dataQuality}</span>
        </div>
      )}
    </div>
  )
}
