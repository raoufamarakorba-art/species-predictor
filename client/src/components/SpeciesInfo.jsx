import styles from './SpeciesInfo.module.css'

export default function SpeciesInfo({ taxon, place, speciesName }) {
  if (!taxon && !speciesName) return null

  const name = taxon?.preferred_common_name || speciesName
  const sci = taxon?.name || speciesName
  const img = taxon?.default_photo?.medium_url || ''
  const rank = taxon?.rank
  const iconic = taxon?.iconic_taxon_name
  const id = taxon?.id

  return (
    <div className={styles.wrapper}>
      {img ? (
        <img src={img} alt={sci} className={styles.photo} onError={e => e.target.style.display = 'none'} />
      ) : (
        <div className={styles.photoPlaceholder}>?</div>
      )}
      <div className={styles.meta}>
        <h2 className={styles.name}>{name}</h2>
        <div className={styles.sci}>{sci}</div>
        <div className={styles.tags}>
          {rank && <span className={styles.tag}>{rank}</span>}
          {iconic && <span className={styles.tag}>{iconic}</span>}
          {place?.display_name && (
            <a
              href={`https://www.inaturalist.org/places/${place.id}`}
              target="_blank"
              rel="noreferrer"
              className={styles.placeLink}
            >
              {place.display_name}
            </a>
          )}
          {id && (
            <a
              href={`https://www.inaturalist.org/taxa/${id}`}
              target="_blank"
              rel="noreferrer"
              className={styles.link}
            >
              Voir sur iNaturalist ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
