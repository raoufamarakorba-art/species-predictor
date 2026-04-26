import { useState, useEffect } from 'react'
import { checkOllamaStatus } from '../services/api.js'
import styles from './OllamaStatus.module.css'

const API_UNAVAILABLE = {
  ollamaRunning: false,
  error: 'Serveur FastAPI inaccessible – lancez npm run dev',
}

export default function OllamaStatus() {
  const [status, setStatus] = useState(null)
  const [checking, setChecking] = useState(true)

  const check = async () => {
    setChecking(true)
    try {
      const s = await checkOllamaStatus()
      setStatus(s)
    } catch {
      setStatus(API_UNAVAILABLE)
    }
    setChecking(false)
  }

  useEffect(() => {
    let cancelled = false

    checkOllamaStatus()
      .then(s => {
        if (!cancelled) setStatus(s)
      })
      .catch(() => {
        if (!cancelled) setStatus(API_UNAVAILABLE)
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (checking) return (
    <div className={styles.bar}>
      <span className={styles.dot} style={{ background: 'var(--color-border-strong)' }} />
      Vérification d&apos;Ollama…
    </div>
  )

  if (!status) return null

  if (!status.ollamaRunning) return (
    <div className={`${styles.bar} ${styles.error}`}>
      <span className={`${styles.dot} ${styles.red}`} />
      <span>
        Ollama non démarré —&nbsp;
        <code className={styles.cmd}>ollama serve</code>
        &nbsp;dans un terminal
      </span>
      <button className={styles.retryBtn} onClick={check}>Réessayer</button>
    </div>
  )

  if (!status.modelReady) return (
    <div className={`${styles.bar} ${styles.warn}`}>
      <span className={`${styles.dot} ${styles.orange}`} />
      <span>
        Modèle <code className={styles.cmd}>{status.configuredModel}</code> non téléchargé —&nbsp;
        <code className={styles.cmd}>ollama pull {status.configuredModel}</code>
      </span>
      <button className={styles.retryBtn} onClick={check}>Réessayer</button>
    </div>
  )

  return (
    <div className={`${styles.bar} ${styles.ok}`}>
      <span className={`${styles.dot} ${styles.green}`} />
      Ollama prêt · modèle <strong>{status.configuredModel}</strong>
    </div>
  )
}
