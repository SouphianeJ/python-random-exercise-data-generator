# Exercise Data Generator

Générateur déterministe de jeux de données pédagogiques (enseigne fictive de sneakers) pour des exercices Excel, pandas ou SQL : magasins, employés, articles, clients, ventes ligne à ligne et charges mensuelles par magasin.

Application Next.js + TypeScript. Le nom du dépôt vient du script Python d'origine (conservé en local dans `old_original_script/`, non versionné) ; le moteur actuel est entièrement TypeScript.

## Démarrage

```bash
npm install
npm run dev        # UI sur http://localhost:3000
npm test           # suite de tests (moteur + invariants statistiques)
npm run sample     # régénère les lots versionnés dans samples/
npm run subjects   # régénère l'examen Excel (sujet étudiant + corrigé enseignant)
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

## Générateur de sujets pilotable depuis l'interface

La page `/sujets` permet de produire un sujet noté **sans coder** : on choisit un *gabarit*, on règle les paramètres, on fait **proposer des seeds intéressants** (le serveur balaie une plage et classe les tirages par intérêt pédagogique), puis on télécharge **sujet / données / corrigé**.

Les gabarits sont déclarés dans `src/lib/subject-templates/` derrière un contrat commun `SubjectTemplate` (`buildConfig`, `evaluate`, `buildFiles`) et enregistrés dans `registry.ts` :

| Gabarit | Description |
| --- | --- |
| `comparaison` | Compare deux magasins du **même type** (paramètre `storeType` : Premium / Standard / Discount) via l'équation `CA = trafic × transformation × panier`. « 2 Premium » et « 2 Discount » sont le même gabarit, juste un paramètre. |
| `diagnostic-reseau` | Examen réseau « promotions vs turnover » (enveloppe `src/lib/subjects.ts`). |

API associée :
- `GET /api/subjects/templates` — métadonnées des gabarits (pour l'UI).
- `GET /api/subjects/seeds?template=…&storeType=…&from=1&to=60` — seeds candidats classés, avec aperçu (ratios, verdict d'hypothèses).
- `GET /api/subjects/build?template=…&seed=…&file=sujet|donnees|corrige` — télécharge un classeur.

## Étude de cas « deux magasins Premium »

`src/lib/premium-case.ts` est une seconde étude de cas notée (sur 20), indépendante, qui fait travailler **l'équation du commerce de détail** : `CA = trafic × taux de transformation × panier moyen`. Le scénario (seed figé) expose deux boutiques Premium de centre-ville de taille comparable mais au CA très différent ; l'élève décompose l'écart, vérifie que l'identité reconstruit le CA, puis teste deux hypothèses de pilotage :

- **H1** — l'écart vient d'abord d'un déficit de **fréquentation** (trafic), plus que de la performance commerciale (transformation, panier). *Confirmée par les données.*
- **H2** — « le petit magasin vend moins parce qu'il est plus petit ». *Réfutée* : l'écart persiste en CA/m² et CA/vendeur, donc sous-performance réelle.

`npm run premium` génère trois classeurs dans `samples/premium-comparison/` — tous recalculés depuis un même dataset, donc cohérents par construction :

| Fichier | Rôle |
| --- | --- |
| `premium_donnees.xlsx` | Données de travail (feuilles magasins, employes, ventes_exam, store_month_costs) |
| `premium_sujet.xlsx` | Énoncé noté (Consignes + Sujet, colonne réponse vide) |
| `premium_corrige.xlsx` | Corrigé enseignant (KPIs, réponses attendues par question, décomposition et verdict des hypothèses) |

## API

- `POST /api/generate` — body JSON = config, renvoie le dataset complet.
- `GET /api/export?file=ventes.csv&seed=32&...` — télécharge un fichier ; les datasets sont mis en cache par config (LRU).
- `GET /api/subjects` — classeur d'examen Excel (version étudiant, sans corrigé).

## Examen noté

`src/lib/subjects.ts` définit une étude de cas notée sur 20, à difficulté progressive (parties A→D : indicateurs de vente, performance des équipes, rentabilité, diagnostic RH/turnover et synthèse). Les énoncés ne référencent que des colonnes réellement exportées et indiquent quand une colonne (ex. `sale_total_ttc`, volontairement vide) doit être recalculée. `npm run subjects` produit `samples/sujets.xlsx` (à distribuer) et `samples/sujets-corrige.xlsx`, dont la feuille « Corrige enseignant » est **calculée depuis le dataset examen** (mêmes seed/config que `exam-underperforming-final`) : elle prouve que chaque question est solvable et montre que le magasin en turnover, malgré des remises et un marketing comparables aux autres, sous-performe par instabilité d'équipe (ancienneté faible, renouvellement élevé, CA par vendeur dégradé).

## Échantillons versionnés

`samples/representative-batch/` (config neutre) et `samples/exam-underperforming-final/` (scénario examen avec magasin Discount sous-performant) sont régénérés par `npm run sample` ; le script échoue si une anomalie de validation apparaît.
