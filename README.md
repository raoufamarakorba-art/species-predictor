# 🌿 Species Predictor

Exploration de données de présence d'espèces depuis **iNaturalist**, analyses statistiques locales, exports scientifiques et workflow **ChatGPT Data Analysis** par fichiers.

![CI](https://github.com/raoufamarakorba-art/species-predictor/actions/workflows/ci.yml/badge.svg)

---

## Fonctionnalités

| Module | Description |
|---|---|
| **Extraction iNaturalist** | Requête temps réel sur l'API publique iNaturalist (jusqu'à 200 obs.) |
| **Autocomplétion** | Suggestions de noms d'espèces en temps réel |
| **Phénologie** | Courbe saisonnière mensuelle des observations |
| **Tendance annuelle** | Graphique interactif de progression/déclin |
| **Répartition géo** | Top localités par nombre d'observations |
| **Carte occurrences** | Visualisation des points géoréférencés |
| **Exports données** | Export CSV complet et GeoJSON géographique |
| **Qualité dataset** | Couverture coordonnées, doublons probables, recommandations |
| **Base locale SQLite** | Stockage permanent, mise à jour et déduplication des occurrences |
| **Import multi-source** | Ajout de données iNaturalist, GBIF, terrain ou littérature en CSV/JSON |
| **Workflow ChatGPT** | Export prompt + métadonnées pour analyse externe dans ChatGPT Pro |
| **Import analyse** | Réintégration d'une synthèse Markdown ou JSON générée dans ChatGPT |
| **Préparation SDM** | Données et métadonnées prêtes pour analyses reproductibles |

---

## Prérequis

- **Node.js** ≥ 18
- **npm** ≥ 9
- **Python** ≥ 3.10
- Optionnel : un abonnement ChatGPT Plus/Pro/Team pour analyser les exports dans ChatGPT Data Analysis

---

## Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/raoufamarakorba-art/species-predictor.git
cd species-predictor
```

### 2. Configurer les variables d'environnement

```bash
cp .env.example .env
# Éditez .env si vous voulez changer le port, CORS ou le cache iNaturalist
```

### 3. Installer toutes les dépendances

```bash
npm run install:all
```

### 4. Lancer en développement

```bash
npm run dev
```

- **Frontend** → http://localhost:5173
- **Backend API** → http://127.0.0.1:8000

Un seul terminal suffit. Le script lance le frontend Vite et le backend FastAPI en parallèle.

---

## Structure du projet

```
species-predictor/
├── client/                        # Frontend React + Vite
│   ├── public/
│   └── src/
│       ├── components/            # Composants UI
│       │   ├── SearchBar.jsx      # Barre de recherche + autocomplétion
│       │   ├── SpeciesInfo.jsx    # En-tête espèce + photo
│       │   ├── MetricsGrid.jsx    # Cartes de métriques
│       │   ├── Charts.jsx         # Graphiques Chart.js
│       │   ├── ChatGPTAnalysis.jsx # Export/import analyse ChatGPT
│       │   └── ObservationsList.jsx
│       ├── services/
│       │   ├── inaturalist.js     # Appels API iNaturalist + stats
│       │   └── chatgptExport.js   # Génération prompt/métadonnées
│       ├── hooks/
│       │   └── useSpeciesData.js  # Hook principal (état global)
│       └── App.jsx
│
├── server/                        # Backend FastAPI
│   ├── app/
│   │   ├── main.py                # Point d'entrée FastAPI
│   │   ├── config.py              # Configuration .env
│   │   ├── routers/
│   │   │   ├── inaturalist.py     # Proxy iNaturalist
│   │   │   └── datasets.py        # Résumé qualité dataset
│   └── requirements.txt           # Dépendances Python
│
├── .github/workflows/ci.yml       # CI GitHub Actions
├── .vscode/                       # Config VS Code
├── .env.example                   # Template variables d'env
└── README.md
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Navigateur (React)                    │
│  SearchBar → useSpeciesData hook → Charts / ChatGPT pack │
└───────────────────┬──────────────────────────────────────┘
                    │ /api/*
┌───────────────────▼──────────────────────────────────────┐
│                    Serveur FastAPI (Python)               │
│  /api/inaturalist  ──proxy──►  api.inaturalist.org        │
│  /api/datasets     ─────────►  contrôles qualité + SQLite │
└──────────────────────────────────────────────────────────┘
                    │ fichiers exportés / base locale
┌───────────────────▼──────────────────────────────────────┐
│               data/species_predictor.sqlite3              │
│  sources + occurrences standardisées + provenance          │
└───────────────────┬──────────────────────────────────────┘
                    │
┌───────────────────▼──────────────────────────────────────┐
│                  ChatGPT Data Analysis                    │
│  observations.csv + occurrences.geojson + prompt.md       │
└──────────────────────────────────────────────────────────┘
```

Le serveur joue le rôle de proxy pour deux raisons :
1. **Cohérence réseau** : le client appelle toujours `/api/*`, sans dépendre directement des APIs externes
2. **Qualité des requêtes** : résolution fiable des taxons/lieux en IDs iNaturalist et cache côté backend

---

## Workflow ChatGPT

L'application n'appelle plus de modèle IA local. Elle prépare les données pour ChatGPT Data Analysis, que vous utilisez ensuite avec votre abonnement ChatGPT.

1. Recherchez un taxon et une zone, par exemple `Syrphidae d'Algérie`.
2. Téléchargez `CSV`, `GeoJSON`, `Métadonnées` et `Prompt ChatGPT`.
3. Importez ces fichiers dans une conversation ChatGPT avec Data Analysis.
4. Demandez l'analyse, les graphiques, les limites méthodologiques ou un rapport Markdown.
5. Importez le Markdown ou JSON généré dans l'onglet `Analyse ChatGPT`.

Ce choix évite de dépendre d'un GPU local, garde l'application rapide sur PC standard et sépare clairement les statistiques déterministes de l'interprétation assistée par IA.

Voir aussi : [docs/CHATGPT_WORKFLOW.md](docs/CHATGPT_WORKFLOW.md)

---

## Recherche par localité

Le champ `Localité` accepte un pays, une wilaya ou une ville iNaturalist. Pour l'Algérie, les formes pratiques suivantes sont normalisées :

- `Algérie - BBA` ou `BBA` → `Bordj Bou Arreridj`
- `Annaba` → wilaya/ville Annaba selon le lieu iNaturalist trouvé
- `Syrphidae d'Algérie` reste accepté dans le champ taxon

Quand un lieu est résolu, la requête utilise son `place_id` iNaturalist, ce qui évite de filtrer approximativement par texte.

---

## Base locale permanente

Le mode `Base locale` ajoute une persistance SQLite côté backend.

- Base par défaut : `data/species_predictor.sqlite3`
- Le dossier `data/` est ignoré par Git
- Variables possibles : `SPECIES_DATA_DIR` ou `SPECIES_DATABASE_PATH`
- Sources suivies : `iNaturalist`, `GBIF`, `Terrain`, `Article`, `Autre`
- Déduplication : identifiant de source quand il existe, puis empreinte `taxon + date + coordonnées`
- Provenance : une occurrence dédupliquée peut conserver plusieurs sources associées

Formats d'import acceptés dans l'interface :

- JSON iNaturalist ou objet `{ "observations": [...] }`
- GeoJSON `FeatureCollection`
- CSV/TSV avec colonnes iNaturalist (`scientific_name`, `observed_on`, `latitude`, `longitude`, `place_guess`)
- CSV/TSV Darwin Core (`scientificName`, `eventDate`, `decimalLatitude`, `decimalLongitude`, `locality`, `occurrenceID`, `basisOfRecord`)

Endpoints utiles :

| Endpoint | Description |
|---|---|
| `POST /api/datasets/import` | Importe et déduplique des observations |
| `GET /api/datasets/library` | Résumé de la base locale |
| `GET /api/datasets/occurrences` | Dernières occurrences stockées |
| `POST /api/datasets/summary` | Résumé qualité d'un jeu temporaire |

---

## Scripts disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Lance client + serveur en parallèle |
| `npm run dev:client` | Frontend seul (port 5173) |
| `npm run dev:server` | Backend seul (port 8000) |
| `npm run dev:server:reload` | Backend seul avec auto-reload Uvicorn |
| `npm run test:server` | Tests backend FastAPI |
| `npm run build` | Build production du frontend |
| `npm start` | Lance le serveur (production) |
| `npm run install:all` | Installe les dépendances Node et Python |

---

## Étendre le projet

### Ajouter une source de données
Créer un nouveau fichier `server/app/routers/gbif.py` pour intégrer le GBIF (Global Biodiversity Information Facility) :
```python
from fastapi import APIRouter

router = APIRouter(prefix="/api/gbif", tags=["gbif"])

@router.get("/occurrences")
async def occurrences():
    return {"results": []}
```

### Ajouter un modèle de prédiction
Le dossier `server/app/models/` peut accueillir des modèles ML plus sophistiqués (MaxEnt, BRT, Random Forest via Python/R).

### Carte interactive
La carte Leaflet est intégrée. Les prochaines améliorations utiles sont le clustering, le filtrage par année et l'export de l'emprise géographique.

---

## Déploiement

### Railway / Render

```bash
# Build frontend dans server/public/
npm run build

# Démarrer en production
NODE_ENV=production npm start
```

### Variables d'environnement en production
```
NODE_ENV=production
ALLOWED_ORIGIN=https://votre-domaine.com
PORT=8000
INATURALIST_CACHE_TTL_SECONDS=300
```

---

## Licence

MIT — Voir [LICENSE](LICENSE)

---

## Statut scientifique et feuille de route

### Outil exploratoire — pas encore publiable

Ce projet est conçu comme un **outil d'exploration et de visualisation** des données de présence d'espèces. Il est utile pour :

- Détecter rapidement des tendances phénologiques ou géographiques
- Formuler des hypothèses de recherche à partir des données citoyennes
- Préparer visuellement un jeu de données avant analyse approfondie
- Sensibiliser et communiquer autour de la biodiversité

Les analyses générées dans ChatGPT sont des **synthèses qualitatives assistées**, non des modèles statistiques validés. Elles peuvent aider à interpréter un jeu de données et préparer un rapport exploratoire, mais ne remplacent pas un modèle de distribution d'espèces reproductible.

---

### Évolutions vers un outil publiable

#### Niveau 1 — Données (faisable rapidement)
- [ ] Croiser iNaturalist avec **GBIF** et **BOLD Systems** pour augmenter le volume
- [ ] Filtrer les coordonnées douteuses avec `CoordCleaner` (package R)
- [ ] Corriger le biais d'observateur par raréfaction spatiale (grille 10×10 km)
- [ ] Intégrer les pseudo-absences pondérées par effort d'échantillonnage

#### Niveau 2 — Variables environnementales
- [ ] Ajouter les 19 variables bioclimatiques **WorldClim 2.1** (température, précipitations)
- [ ] Intégrer l'occupation du sol **CORINE Land Cover** (Europe) ou **GlobCover**
- [ ] Variables topographiques (altitude, pente, exposition) via **SRTM**

#### Niveau 3 — Modèles de distribution (SDM)
- [ ] Ajouter **MaxEnt** (Java, licence libre) comme modèle reproductible
- [ ] Implémenter `biomod2` (R) : BRT, Random Forest, GLM, GAM ensemblés
- [ ] API Python vers `sdm` ou `ENMeval` pour la calibration automatique

#### Niveau 4 — Validation statistique
- [ ] Métriques d'évaluation : **AUC-ROC**, **TSS** (True Skill Statistic), **kappa**
- [ ] Validation croisée spatiale **k-fold** (blocs géographiques indépendants)
- [ ] Analyse de l'incertitude par bootstrapping (n=100 runs)
- [ ] Tests de significativité : permutation du modèle nul

#### Niveau 5 — Reproductibilité & publication
- [ ] Export des paramètres de modèle et seed aléatoire fixé
- [ ] Notebooks Jupyter / R Markdown avec pipeline complet
- [ ] Archivage des données sur **Zenodo** avec DOI
- [ ] Conformité aux standards **GBIF Darwin Core** pour les métadonnées

---

### Références méthodologiques

- Elith, J. et al. (2006). Novel methods improve prediction of species' distributions from occurrence data. *Ecography*, 29, 129–151.
- Phillips, S.J. et al. (2017). Opening the black box: an open-source release of Maxent. *Ecography*, 40, 887–893.
- Thuiller, W. et al. (2009). BIOMOD – a platform for ensemble forecasting of species distributions. *Ecography*, 32, 369–373.
- Zizka, A. et al. (2019). CoordCleaner: Standardized cleaning of occurrence records from biological collection databases. *Methods in Ecology and Evolution*, 10, 744–751.

---

### Contribution

Les contributions sont les bienvenues, en particulier sur les niveaux 2 à 5.
Ouvrez une issue ou une pull request en décrivant la méthode que vous souhaitez implémenter.
