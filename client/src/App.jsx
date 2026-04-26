import { Suspense, lazy, useState } from 'react'
import SearchBar from './components/SearchBar.jsx'
import SpeciesInfo from './components/SpeciesInfo.jsx'
import MetricsGrid from './components/MetricsGrid.jsx'
import Charts from './components/Charts.jsx'
import DataExports from './components/DataExports.jsx'
import DatasetQuality from './components/DatasetQuality.jsx'
import ChatGPTAnalysis from './components/ChatGPTAnalysis.jsx'
import ReportImportMode from './components/ReportImportMode.jsx'
import ObservationsList from './components/ObservationsList.jsx'
import { useSpeciesData } from './hooks/useSpeciesData.js'
import styles from './App.module.css'

const OccurrenceMap = lazy(() => import('./components/OccurrenceMap.jsx'))

const TABS = [
  { id: 'data',    label: 'Données & carte' },
  { id: 'chatgpt', label: 'Analyse ChatGPT' },
  { id: 'obs',     label: 'Observations' },
]

const MODES = [
  { id: 'search', label: 'Recherche iNaturalist' },
  { id: 'report', label: 'Rapport Markdown' },
]

export default function App() {
  const [mode, setMode] = useState('search')
  const [activeTab, setActiveTab] = useState('data')
  const { observations, taxon, stats, datasetSummary, loading, error, search } = useSpeciesData()

  const hasData = observations.length > 0
  const lastSearch = taxon?.name || ''

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>◉</span>
          <div>
            <h1 className={styles.brandName}>Species Predictor</h1>
            <p className={styles.brandSub}>iNaturalist · Analyse statistique · Export ChatGPT</p>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.modeSwitch} aria-label="Mode d'analyse">
          {MODES.map(item => (
            <button
              key={item.id}
              className={`${styles.modeBtn} ${mode === item.id ? styles.activeModeBtn : ''}`}
              onClick={() => setMode(item.id)}
              aria-pressed={mode === item.id}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        {mode === 'report' ? (
          <ReportImportMode />
        ) : (
          <>
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

                {activeTab === 'chatgpt' && (
                  <div className={styles.tabContent}>
                    <ChatGPTAnalysis
                      observations={observations}
                      taxon={taxon}
                      stats={stats}
                      datasetSummary={datasetSummary}
                      speciesName={lastSearch}
                    />
                  </div>
                )}

                {activeTab === 'obs' && (
                  <div className={styles.tabContent}>
                    <ObservationsList observations={observations} total={stats?.total} />
                  </div>
                )}
              </>
            )}

            {!hasData && !loading && !error && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>◎</div>
                <p>Recherchez une espèce, une famille ou un taxon pour commencer l&apos;analyse</p>
                <div className={styles.examples}>
                  {['Lynx lynx','Ciconia ciconia','Quercus ilex','Canis lupus'].map(s => (
                    <button key={s} className={styles.exampleBtn} onClick={() => search({ speciesName: s })}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
