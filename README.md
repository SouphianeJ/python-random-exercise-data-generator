# Exercise Data Generator

Générateur déterministe de jeux de données pédagogiques (enseigne fictive de sneakers) pour des exercices Excel, pandas ou SQL : magasins, employés, articles, clients, ventes ligne à ligne et charges mensuelles par magasin.

Application Next.js + TypeScript. Le nom du dépôt vient du script Python d'origine (conservé en local dans `old_original_script/`, non versionné) ; le moteur actuel est entièrement TypeScript.

## Démarrage

```bash
npm install
npm run dev        # UI sur http://localhost:3000
npm test           # suite de tests (moteur + invariants statistiques)
npm run sample     # régénère les lots versionnés dans samples/
npm run subjects   # régénère le classeur de sujets Excel
```

## Ce que produit le générateur

Pour une configuration donnée (seed, année, nombre de magasins/produits/clients, plan de performance), le moteur génère un dataset complet et cohérent :

| Export | Contenu |
| --- | --- |
| `magasins.csv` | Profils magasins (zone, type, trafic, estimations cohérentes entre elles) |
| `employes.csv` | Vendeurs avec profils comportementaux, dates d'embauche **et de départ** |
| `articles.csv` | Catalogue chaussures + accessoires |
| `clients.csv` | Clients avec profils d'achat et solde de points fidélité de fin d'année |
| `ventes.csv` / `ventes_filtre.csv` | Une ligne par ligne de ticket (version complète / allégée) |
| `ventes_exam.csv` | Une ligne par ticket, colonnes produit répétées, totaux à compléter par l'étudiant |
| `store_month_costs.csv` | Charges mensuelles par magasin — 12 mois exactement, paie proratisée par présence |
| `canonical.json` | Dataset complet (entités + plan de volume + résumé + validation) |

Chaque table existe aussi en `.xlsx`. La sémantique de chaque champ est documentée dans [docs/lexique-champs.txt](docs/lexique-champs.txt).

## Principes du moteur

- **Déterminisme** : même config ⇒ même dataset, à l'octet près (RNG seedé maison).
- **Cohérence vérifiée** : chaque génération passe des règles de validation (clés étrangères, ventes dans la fenêtre embauche/départ, invariant points fidélité = remise ×10, 12 mois de charges par magasin) ; le compteur d'anomalies est exposé dans l'UI et `summary.json`.
- **Personas** : vendeurs (Requin → Stagiaire) et clients (sneakerhead, chasseur de promos…) ont des comportements statistiquement différenciés, couverts par les tests de patterns.
- **Plan de performance** : on peut imposer un statut par magasin (`superperformant` → `critique_turnover`). Les magasins en turnover ont une équipe renouvelée en cours d'année (prédécesseurs partis, successeurs embauchés) et finissent réellement déficitaires.
- **Constantes économiques** centralisées dans `src/lib/generator/economics.ts` (TVA, valeur du point fidélité, taux patronaux, marketing).

## API

- `POST /api/generate` — body JSON = config, renvoie le dataset complet.
- `GET /api/export?file=ventes.csv&seed=32&...` — télécharge un fichier ; les datasets sont mis en cache par config (LRU).
- `GET /api/subjects` — classeur de sujets Excel.

## Échantillons versionnés

`samples/representative-batch/` (config neutre) et `samples/exam-underperforming-final/` (scénario examen avec magasin Discount sous-performant) sont régénérés par `npm run sample` ; le script échoue si une anomalie de validation apparaît.
