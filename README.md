# 🌿 Species Predictor

Extraction de données de présence d'espèces depuis **iNaturalist**, analyse statistique et synthèse prédictive par biotope grâce à **Ollama** en local.

![CI](https://github.com/raoufamarakorba-art/species-predictor-ollama/actions/workflows/ci.yml/badge.svg)

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
| **Prédictions IA** | Probabilité de présence × biotope via Ollama |
| **Conservation** | Analyse de tendance + recommandations |

---

## Prérequis

- **Node.js** ≥ 18
- **npm** ≥ 9
- **Python** ≥ 3.10
- **Ollama** installé localement : [ollama.com](https://ollama.com/)
- Un modèle Ollama téléchargé, par exemple `mistral`

---

## Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/raoufamarakorba-art/species-predictor-ollama.git
cd species-predictor-ollama
```

### 2. Configurer les variables d'environnement

```bash
cp .env.example .env
# Éditez .env si vous voulez changer OLLAMA_URL, OLLAMA_MODEL ou le port
```

### 3. Préparer Ollama

Sur Windows, vous pouvez installer Ollama avec `winget` :

```powershell
winget install --id Ollama.Ollama --source winget
```

Après installation, ouvrez un nouveau terminal PowerShell pour récupérer le PATH. Si `ollama` n'est pas encore reconnu dans le terminal courant, utilisez le chemin complet :

```powershell
& "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" pull mistral
```

Commande standard une fois le PATH disponible :

```bash
ollama pull mistral
ollama serve
```

Gardez `ollama serve` ouvert dans un terminal séparé si Ollama n'est pas déjà lancé en arrière-plan.

### 4. Installer toutes les dépendances

```bash
npm run install:all
```

### 5. Lancer en développement

```bash
npm run dev
```

- **Frontend** → http://localhost:5173
- **Backend API** → http://localhost:8000

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
│       │   ├── Predictions.jsx    # Panel prédictions IA
│       │   └── ObservationsList.jsx
│       ├── services/
│       │   ├── inaturalist.js     # Appels API iNaturalist + stats
│       │   └── api.js             # Appels backend (prédictions)
│       ├── hooks/
│       │   └── useSpeciesData.js  # Hook principal (état global)
│       └── App.jsx
│
├── server/                        # Backend FastAPI
│   ├── app/
│   │   ├── main.py                # Point d'entrée FastAPI
│   │   ├── config.py              # Configuration .env
│   │   ├── routers/
│   │   │   ├── predict.py         # Endpoint Ollama
│   │   │   └── inaturalist.py     # Proxy iNaturalist
│   │   └── services/
│   │       └── ollama.py          # Client Ollama
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
│  SearchBar → useSpeciesData hook → Charts / Predictions  │
└───────────────────┬──────────────────────────────────────┘
                    │ /api/*
┌───────────────────▼──────────────────────────────────────┐
│                    Serveur FastAPI (Python)               │
│  /api/inaturalist  ──proxy──►  api.inaturalist.org        │
│  /api/predict      ──────────►  Ollama local              │
└──────────────────────────────────────────────────────────┘
```

Le serveur joue le rôle de proxy pour deux raisons :
1. **Cohérence réseau** : le client appelle toujours `/api/*`, sans dépendre directement des APIs externes
2. **Rate limiting** : protection contre les appels IA en rafale vers Ollama

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
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=mistral
OLLAMA_TIMEOUT_SECONDS=300
OLLAMA_NUM_PREDICT=1200
NODE_ENV=production
ALLOWED_ORIGIN=https://votre-domaine.com
PORT=8000
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

Les prédictions générées par le LLM (Ollama/Mistral) sont des **synthèses qualitatives indicatives**, non des modèles statistiques validés. Elles ne sont pas reproductibles au sens scientifique et ne peuvent pas être soumises telles quelles dans un article peer-reviewed.

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
- [ ] Remplacer les prédictions LLM par **MaxEnt** (Java, licence libre)
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
