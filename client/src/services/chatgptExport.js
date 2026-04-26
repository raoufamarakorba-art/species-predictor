function compactObject(value) {
  return JSON.parse(JSON.stringify(value ?? null))
}

export function buildChatGPTMetadata({ observations, taxon, stats, datasetSummary, speciesName }) {
  const coordinateCount = observations.filter(observation => observation.geojson?.coordinates?.length >= 2).length

  return {
    generatedAt: new Date().toISOString(),
    workflow: 'chatgpt-data-analysis',
    source: 'iNaturalist via Species Predictor',
    query: {
      taxonName: taxon?.name || speciesName || null,
      preferredCommonName: taxon?.preferred_common_name || null,
      taxonId: taxon?.id || null,
      rank: taxon?.rank || null,
    },
    dataset: {
      loadedObservations: observations.length,
      totalObservations: stats?.total ?? observations.length,
      georeferencedObservations: coordinateCount,
      yearRange: stats?.sortedYears?.length
        ? {
            start: stats.sortedYears[0],
            end: stats.sortedYears[stats.sortedYears.length - 1],
            count: stats.sortedYears.length,
          }
        : null,
      topPlaces: stats?.topPlaces || [],
      quality: compactObject(datasetSummary),
    },
    expectedOutputs: [
      'Synthèse écologique prudente',
      'Analyse phénologique',
      'Analyse spatiale',
      'Limites et biais du jeu de données',
      'Graphiques utiles si pertinents',
      'Recommandations pour une analyse SDM reproductible',
    ],
  }
}

export function buildChatGPTPrompt({ metadata }) {
  const taxonName = metadata.query.taxonName || 'le taxon exporté'
  const total = metadata.dataset.totalObservations
  const loaded = metadata.dataset.loadedObservations

  return `# Analyse exploratoire iNaturalist

Tu vas analyser un export issu de l'application Species Predictor.

## Fichiers fournis

- observations.csv: observations iNaturalist chargées dans l'application
- occurrences.geojson: points géoréférencés exploitables sur carte
- metadata.json: contexte de recherche, taxon, résumé qualité et statistiques locales

## Contexte

- Taxon: ${taxonName}
- Rang: ${metadata.query.rank || 'inconnu'}
- Observations iNaturalist totales: ${total}
- Observations chargées dans le CSV: ${loaded}
- Observations géoréférencées: ${metadata.dataset.georeferencedObservations}

## Travail demandé

1. Vérifie la structure du CSV et du GeoJSON.
2. Résume la qualité du jeu de données: dates, coordonnées, doublons probables, biais d'observateur et biais géographique.
3. Analyse la phénologie à partir de observed_on.
4. Analyse la répartition spatiale à partir des coordonnées et de place_guess.
5. Propose des graphiques utiles et génère-les si l'environnement Data Analysis le permet.
6. Formule des hypothèses écologiques prudentes, sans présenter de prédiction comme résultat validé.
7. Donne les prochaines étapes pour une analyse SDM reproductible: nettoyage, pseudo-absences, variables environnementales, validation.

## Contraintes

- Ne pas inventer des observations absentes des fichiers.
- Distinguer clairement observation, hypothèse et recommandation.
- Mentionner les limites des données citoyennes iNaturalist.
- Si le CSV est un échantillon limité, rappeler que le total iNaturalist peut être supérieur au nombre de lignes chargées.

## Format de sortie souhaité

Rends d'abord un rapport Markdown structuré avec:

- Résumé exécutif
- Qualité des données
- Phénologie
- Répartition spatiale
- Biais et limites
- Hypothèses écologiques
- Recommandations de nettoyage
- Prochaines étapes SDM

Ensuite, si je te le demande, fournis aussi un JSON synthétique avec les clés:

summary, dataQuality, phenology, spatialPattern, biases, ecologicalHypotheses, recommendations, sdmNextSteps.
`
}
