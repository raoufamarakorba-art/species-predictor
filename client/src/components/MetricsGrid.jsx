import styles from './MetricsGrid.module.css'

const TREND_ICON = { increasing: '↑', decreasing: '↓', stable: '→' }
const TREND_COLOR = { increasing: 'success', decreasing: 'danger', stable: 'muted' }

export default function MetricsGrid({ stats }) {
  if (!stats) return null

  const trend = stats.trend || 'stable'

  return (
    <div className={styles.grid}>
      <Card label="Observations" value={stats.total} sub="grade recherche" />
      <Card label="Localités" value={stats.uniquePlaces} sub="sites distincts" />
      <Card label="Années" value={stats.totalYears} sub={stats.sortedYears[0] ? `${stats.sortedYears[0]} – ${stats.sortedYears[stats.sortedYears.length - 1]}` : '—'} />
      <Card label="Pic phénologique" value={stats.peakMonthLabel} sub={`mois le + actif`} />
      <Card label="Moy. annuelle" value={stats.avgPerYear} sub="obs / an" />
      <Card
        label="Tendance"
        value={`${TREND_ICON[trend]} ${trend === 'increasing' ? 'Progresse' : trend === 'decreasing' ? 'Déclin' : 'Stable'}`}
        valueColor={TREND_COLOR[trend]}
        sub="sur la période"
      />
    </div>
  )
}

function Card({ label, value, sub, valueColor = 'default' }) {
  return (
    <div className={styles.card}>
      <div className={styles.label}>{label}</div>
      <div className={`${styles.value} ${styles[valueColor]}`}>{value}</div>
      {sub && <div className={styles.sub}>{sub}</div>}
    </div>
  )
}
