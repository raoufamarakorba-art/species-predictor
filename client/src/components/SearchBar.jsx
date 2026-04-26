import { useState, useRef, useCallback, useEffect } from 'react'
import { autocompleteTaxa } from '../services/inaturalist.js'
import styles from './SearchBar.module.css'

const BIOTOPES = [
  { value: '', label: 'Tous les biotopes' },
  { value: 'forest', label: 'Forêt' },
  { value: 'wetland', label: 'Zones humides' },
  { value: 'grassland', label: 'Prairies' },
  { value: 'marine', label: 'Marin' },
  { value: 'mountain', label: 'Montagne' },
  { value: 'urban', label: 'Urbain' },
  { value: 'desert', label: 'Désert' },
  { value: 'freshwater', label: 'Eau douce' },
]

export default function SearchBar({ onSearch, loading }) {
  const [species, setSpecies] = useState('')
  const [region, setRegion] = useState('')
  const [biotope, setBiotope] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef(null)
  const wrapRef = useRef(null)

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target))
        setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSpeciesChange = useCallback((val) => {
    setSpecies(val)
    clearTimeout(debounceRef.current)
    if (val.length < 2) { setSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      const results = await autocompleteTaxa(val)
      setSuggestions(results.slice(0, 7))
      setShowSuggestions(true)
    }, 280)
  }, [])

  const selectSuggestion = useCallback((taxon) => {
    setSpecies(taxon.name)
    setSuggestions([])
    setShowSuggestions(false)
  }, [])

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!species.trim()) return
    setShowSuggestions(false)
    onSearch({ speciesName: species.trim(), placeName: region.trim(), biotope })
  }

  return (
    <div className={styles.wrapper} ref={wrapRef}>
      <div className={styles.row}>
        <div className={styles.speciesWrap}>
          <input
            className={styles.input}
            type="text"
            placeholder="Taxon (ex: Syrphidae d'Algérie, Canis lupus…)"
            value={species}
            onChange={e => handleSpeciesChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            onFocus={() => suggestions.length && setShowSuggestions(true)}
            autoComplete="off"
            spellCheck="false"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className={styles.dropdown}>
              {suggestions.map(t => (
                <li key={t.id} onMouseDown={() => selectSuggestion(t)}>
                  <span className={styles.commonName}>{t.preferred_common_name || t.name}</span>
                  <span className={styles.sciName}>{t.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <input
          className={`${styles.input} ${styles.regionInput}`}
          type="text"
          placeholder="Région (ex: France, Algeria…)"
          value={region}
          onChange={e => setRegion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />

        <select
          className={styles.select}
          value={biotope}
          onChange={e => setBiotope(e.target.value)}
        >
          {BIOTOPES.map(b => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>

        <button
          className={styles.btn}
          onClick={handleSubmit}
          disabled={loading || !species.trim()}
        >
          {loading ? <span className={styles.spinner} /> : 'Analyser →'}
        </button>
      </div>
    </div>
  )
}
