import styles from './ObservationsList.module.css'

export default function ObservationsList({ observations, total }) {
  if (!observations?.length) return null
  const totalLabel = total && total > observations.length
    ? `${observations.length} affichées sur ${total}`
    : `${observations.length} affichées`

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.title}>Observations récentes</span>
        <span className={styles.count}>{totalLabel}</span>
      </div>
      <div className={styles.list}>
        {observations.slice(0, 50).map(o => {
          const img = o.photos?.[0]?.url?.replace('square', 'thumb')
          const date = o.observed_on || o.created_at?.slice(0, 10) || '?'
          const place = o.place_guess || 'Lieu inconnu'
          const user = o.user?.login
          const grade = o.quality_grade

          return (
            <a
              key={o.id}
              href={`https://www.inaturalist.org/observations/${o.id}`}
              target="_blank"
              rel="noreferrer"
              className={styles.item}
            >
              {img ? (
                <img src={img} alt="" className={styles.thumb} onError={e => e.target.style.display='none'} />
              ) : (
                <div className={styles.thumbEmpty} />
              )}
              <div className={styles.body}>
                <div className={styles.place}>{place.slice(0, 60)}</div>
                <div className={styles.meta}>
                  {date}
                  {user && <span> · @{user}</span>}
                  {grade && <span className={`${styles.grade} ${styles[grade]}`}>{grade}</span>}
                </div>
              </div>
              <span className={styles.arrow}>→</span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
