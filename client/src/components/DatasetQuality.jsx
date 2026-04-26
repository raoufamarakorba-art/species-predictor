import styles from './DatasetQuality.module.css'

export default function DatasetQuality({ summary }) {
  if (!summary) return null

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Qualité des données</span>
        <span className={styles.badge}>{summary.coordinateCoverage}% coordonnées</span>
      </div>

      <div className={styles.grid}>
        <Metric label="Géoréférencées" value={summary.withCoordinates} />
        <Metric label="Sans coordonnées" value={summary.withoutCoordinates} />
        <Metric label="Doublons probables" value={summary.likelyDuplicates} />
        <Metric label="Période" value={summary.yearRange?.count || 0} sub={yearRange(summary)} />
      </div>

      {summary.recommendations?.length > 0 && (
        <div className={styles.recommendations}>
          {summary.recommendations.map(item => (
            <div key={item} className={styles.recommendation}>{item}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, sub }) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
      {sub && <div className={styles.metricSub}>{sub}</div>}
    </div>
  )
}

function yearRange(summary) {
  if (!summary.yearRange?.start) return 'aucune date'
  return `${summary.yearRange.start} - ${summary.yearRange.end}`
}
