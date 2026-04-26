import { Suspense, lazy, useState } from 'react'
import SearchBar from './components/SearchBar.jsx'
import SpeciesInfo from './components/SpeciesInfo.jsx'
import MetricsGrid from './components/MetricsGrid.jsx'
import Charts from './components/Charts.jsx'
import DataExports from './components/DataExports.jsx'
import DatasetQuality from './components/DatasetQuality.jsx'
import Predictions from './components/Predictions.jsx'
import ObservationsList from './components/ObservationsList.jsx'
import OllamaStatus from './components/OllamaStatus.jsx'
import { useSpeciesData } from './hooks/useSpeciesData.js'
import styles from './App.module.css'

const OccurrenceMap = lazy(() => import('./components/OccurrenceMap.jsx'))

const TABS = [
  { id: 'data',    label: 'Données & carte' },
  { id: 'predict', label: 'Prédictions IA' },
  { id: 'obs',     label: 'Observations' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('data')
  const { observations, taxon, stats, datasetSummary, prediction, loading, loadingPredict,
          error, errorPredict, search } = useSpeciesData()

  const hasData = observations.length > 0
  const lastSearch = taxon?.name || ''

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>◉</span>
          <div>
            <h1 className={styles.brandName}>Species Predictor</h1>
            <p className={styles.brandSub}>iNaturalist · Analyse statistique · IA Ollama</p>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <OllamaStatus />
        <SearchBar onSearch={search} loading={loading} />

        {error && (
          <div className={styles.errorBanner}>{error}</div>
        )}

        {loading && (
          <div className={styles.loadingBanner}>
            <span className={styles.loadingDot} />
            Récupération des données iNaturalist…
          </div>
        )}

        {hasData && (
          <>
            <SpeciesInfo taxon={taxon} speciesName={lastSearch} />

            <div className={styles.tabs}>
              {TABS.map(t => (
                <button
                  key={t.id}
                  className={`${styles.tab} ${activeTab === t.id ? styles.activeTab : ''}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                  {t.id === 'predict' && loadingPredict && (
                    <span className={styles.tabSpinner} />
                  )}
                </button>
              ))}
            </div>

            {activeTab === 'data' && (
              <>
                <DataExports observations={observations} speciesName={lastSearch} />
                <MetricsGrid stats={stats} />
                <DatasetQuality summary={datasetSummary} />
                <Suspense fallback={<div className={styles.loadingBanner}>Chargement de la carte…</div>}>
                  <OccurrenceMap observations={observations} />
                </Suspense>
                <Charts stats={stats} />
              </>
            )}

            {activeTab === 'predict' && (
              <div className={styles.tabContent}>
                <Predictions
                  prediction={prediction}
                  loading={loadingPredict}
                  error={errorPredict}
                />
              </div>
            )}

            {activeTab === 'obs' && (
              <div className={styles.tabContent}>
                <ObservationsList observations={observations} />
              </div>
            )}
          </>
        )}

        {!hasData && !loading && !error && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>◎</div>
            <p>Recherchez une espèce pour commencer l&apos;analyse</p>
            <div className={styles.examples}>
              {['Lynx lynx','Ciconia ciconia','Quercus ilex','Canis lupus'].map(s => (
                <button key={s} className={styles.exampleBtn} onClick={() => search({ speciesName: s })}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
