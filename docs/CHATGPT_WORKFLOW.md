# Workflow ChatGPT Data Analysis

## Décision d'architecture

Species Predictor ne dépend plus d'un LLM local au démarrage. Le flux principal est maintenant :

1. collecter et nettoyer les données iNaturalist dans l'application ;
2. produire des exports déterministes ;
3. analyser ces exports dans ChatGPT Data Analysis ;
4. réimporter le rapport ou le JSON de synthèse dans l'interface.

Cette approche évite d'imposer Ollama, un GPU local, ou plusieurs terminaux. Elle garde l'application rapide sur un PC standard tout en permettant d'utiliser ChatGPT Pro pour l'analyse exploratoire.

## Fichiers exportés

L'onglet `Analyse ChatGPT` permet de produire :

- `*-observations.csv` : observations chargées depuis iNaturalist ;
- `*-observations.geojson` : points géoréférencés ;
- `*-observations.metadata.json` : taxon, rang, volumes, période, qualité des données ;
- `*-observations.prompt.md` : prompt prêt à utiliser dans ChatGPT.

## Usage recommandé

Dans ChatGPT Data Analysis :

1. créer une nouvelle conversation ;
2. importer le CSV, le GeoJSON, les métadonnées et le prompt ;
3. demander un rapport exploratoire ;
4. demander ensuite un JSON synthétique si le résultat doit être réimporté ;
5. importer le fichier Markdown, TXT ou JSON dans l'onglet `Analyse ChatGPT`.

## Limites

Les sorties ChatGPT restent des synthèses interprétatives. Elles ne remplacent pas :

- un nettoyage reproductible des coordonnées ;
- une analyse d'effort d'échantillonnage ;
- un modèle SDM validé ;
- une validation croisée spatiale ;
- des métriques comme AUC, TSS ou kappa.

## Décommissionnement Ollama

Le chemin Ollama a été retiré du runtime par défaut :

- plus de prérequis Ollama dans l'installation ;
- plus d'endpoint `/api/predict` ;
- plus de vérification du statut Ollama dans l'interface ;
- plus de génération IA automatique après une recherche.

Un futur provider IA pourra être réintroduit uniquement s'il reste optionnel et ne complique pas le démarrage local.
