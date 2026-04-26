import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import styles from './Charts.module.css'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
)

const PALETTE = ['#1D9E75','#378ADD','#BA7517','#D85A30','#7F77DD','#D4537E','#639922','#1D9E75']

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
    y: { grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { font: { size: 11 } } },
  },
}

export default function Charts({ stats }) {
  if (!stats) return null

  const seasonalData = {
    labels: stats.monthLabels,
    datasets: [{
      data: stats.monthCounts,
      backgroundColor: stats.monthCounts.map((_, i) =>
        i === stats.peakMonth ? '#1D9E75' : 'rgba(29,158,117,0.3)'
      ),
      borderRadius: 4,
      borderSkipped: false,
    }],
  }

  const trendData = {
    labels: stats.sortedYears,
    datasets: [{
      data: stats.sortedYears.map(y => stats.yearMap[y]),
      borderColor: '#378ADD',
      backgroundColor: 'rgba(55,138,221,0.08)',
      borderWidth: 2,
      pointRadius: 4,
      pointBackgroundColor: '#378ADD',
      fill: true,
      tension: 0.35,
    }],
  }

  const habitatData = {
    labels: stats.topPlaces.map(p => p[0]),
    datasets: [{
      data: stats.topPlaces.map(p => p[1]),
      backgroundColor: PALETTE,
      borderRadius: 4,
      borderSkipped: false,
    }],
  }

  const habitatHeight = Math.max(200, stats.topPlaces.length * 44 + 60)

  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <div className={styles.card}>
          <h3 className={styles.title}>Phénologie mensuelle</h3>
          <div style={{ position: 'relative', height: 200 }}>
            <Bar
              data={seasonalData}
              options={baseOptions}
              aria-label="Observations par mois"
            />
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.title}>Tendance annuelle</h3>
          <div style={{ position: 'relative', height: 200 }}>
            <Line
              data={trendData}
              options={{
                ...baseOptions,
                scales: {
                  ...baseOptions.scales,
                  x: { ...baseOptions.scales.x, ticks: { font: { size: 10 }, maxTicksLimit: 10 } },
                },
              }}
              aria-label="Observations par an"
            />
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.title}>Répartition géographique</h3>
        <div style={{ position: 'relative', height: habitatHeight }}>
          <Bar
            data={habitatData}
            options={{
              ...baseOptions,
              indexAxis: 'y',
              scales: {
                x: baseOptions.scales.y,
                y: { ...baseOptions.scales.x, ticks: { font: { size: 11 } } },
              },
            }}
            aria-label="Répartition par localité"
          />
        </div>
      </div>
    </div>
  )
}
