# Campagne Recette Generator

Outil web statique pour preparer et executer des campagnes de recette fonctionnelle.
Le projet fournit deux interfaces complementaires :

- preparation des cas de test avec **gestion des etapes individuelles et images**
- execution de campagne avec qualification OK/KO/NA et **affichage des etapes avec images**

## Vue d ensemble

Le workflow recommande est le suivant :

1. Ouvrir `index.html` pour choisir l outil.
2. Ouvrir `generateur-cahier-recette.html` (**Générateur Cas Test**) pour construire ou importer les cas de test.
   - Ajouter etapes individuellement
   - **Uploader des images par etape** (drag-drop, clic, ou Ctrl+V)
   - Exporter en CSV pour Jira Xray ou en Excel pour la campagne de recette
3. Ouvrir `cahier-recette.html` (**Campagne de Recette**) pour importer les cas et executer la campagne.
   - **Voir les etapes avec cercles bleus numerotes et images associees**
   - Ajouter preuves d execution et qualifications
   - Exporter les resultats en Excel ou DOC
4. Ouvrir `jira-ticket-generator.html` (**Générateur Excel Jira**) pour preparer un import Jira en masse.
   - Generer un fichier Excel pret a l import direct dans Jira

Le projet ne necessite pas de backend : tout fonctionne dans le navigateur (stockage local via localStorage).

## Fichiers du projet

```text
cahier-recette_generator/
|- cahier-recette.html
|- index.html
|- generateur-cahier-recette.html
|- jira-ticket-generator.html
|- jira-import-test-template.csv
|- jira-import-user-story-template.csv
|- ppi_cahier.md
|- xper_cahier.md
|- README.md
|- css/
|  `- styles.css
`- js/
  |- create-jira-excel.js
   |- md-generator.js
  |- jira-ticket-generator.js
   `- recette-generator.js
```

## Interfaces

### 1) Générateur Cas Test

Entree : `generateur-cahier-recette.html` + `js/md-generator.js`

Cet outil permet de creer et exporter les cas de test pour deux usages :
- **Export CSV** : pour import direct dans Jira Xray
- **Export Excel** : pour import dans la campagne de recette

Fonctionnalites principales :

- saisie manuelle des cas (ID, priorite, role, scenario, etapes avec images, attendu)
- import Excel/CSV avec detection d en-tetes tolerante (alias metier/Jira)
- **upload d images par etape** : drag-drop, clic fichier, ou Ctrl+V (paste)
  - Support complet des formats : PNG, JPEG, WebP, BMP
  - **Compression automatique** : JPEG 0.82 qualite, max 680px
- export Excel tabulaire (`.xlsx`) pour campagne de recette
- export CSV Jira (`;`) compatible import Jira Xray
- sections metier pre-remplies (objectif, perimetre, environnement, etc.)
- **gestion des etapes individuelles** : ajout/edition/suppression par etape
- statistiques live (total, P1, P2, P3)

Note : les priorites Jira `Haute/Moyenne/Basse` sont normalisees en `P1/P2/P3`.
Les images sont stockees en base64 dans le stepsArray pour persistence locale.

### 2) Execution de campagne

Entree : `cahier-recette.html` + `js/recette-generator.js`

Fonctionnalites principales :

- import des tests depuis Excel/CSV (avec etapes et images)
- affichage ameliore des etapes : **cercles bleus numerotes + titre + description + images**
- qualification par test : `OK`, `KO`, `NA` avec feedback visuel
- observation par test
- ajout de capture pour les KO (mode classique)
- filtres : recherche texte, priorite, resultat
- double affichage :
  - vue classique (liste de tests avec etapes formatees)
  - vue matrice (scenario x role)
- export des resultats :
  - **Word** (`.doc`) en mode portrait avec frames professionnels
  - **Excel** (`.xlsx`) avec images compressees

Ameliorations recentes :
- Etapes affichees avec cercle bleu numerote (40px, style primaire)
- Support complet des images d etapes depuis le generateur
- Affichage des images en dessous de la description d etape
- Zones de capture pour ajouter preuves d execution
- **DOC export optimise** : mise en page portrait, frames visibles sur tous les tests, espacement coherent, palette bleue
- **Buttons feedback** : indication visuelle claire pour les selections OK/KO/NA (:focus-visible)
- Format: [Cercle bleu: X] Etape X → Description → Image (si presente) → Zone capture

### 3) Générateur Excel Jira

Entree : `jira-ticket-generator.html` + `js/jira-ticket-generator.js`

Cet outil permet de generer un fichier Excel pret pour l import en masse dans Jira, permettant la creation rapide de tickets (User Stories, Anomalies, etc.).

Fonctionnalites principales :

- import du template CSV Jira existant (`jira-import-user-story-template.csv`)
- import en masse depuis un tableau Excel interne (colonnes metier: ID, Priorite, Role, Scenario, Etapes, Attendu)
- edition de tickets (Type, Resume, Description, Priorite, Assignee)
- generation d un fichier Excel (`.xlsx`) pret a l import Jira
- export CSV Jira en option (`;`)

## Formats supportes

### Import (generateur et executeur)

- `.xlsx`
- `.xls`
- `.csv`

Colonnes reconnues via alias (exemples) :

- ID : `id`, `identifiant`, `identificateur de cas de test`, `reference`
- Priorite : `priorite`, `priority`, `criticite`
- Role : `role`, `profil`, `acteur`
- Scenario : `scenario`, `resume`, `cas de test`, `libelle`
- Etapes : `etapes`, `action`, `steps`, `procedure`
- Attendu : `attendu`, `resultat attendu`, `expected`

### Export

Depuis le **Générateur Cas Test** :

- **Excel** (`.xlsx`) pour import dans la campagne de recette
- **CSV Jira** (`.csv`, separateur `;`) pour import direct dans Jira Xray

Depuis l **Execution de campagne** :

- **Word** (`.doc`, portrait) avec rapport formaté et preuves d execution
- **Excel** (`.xlsx`) en fonction de la vue active (classique ou matrice)

Depuis le **Générateur Excel Jira** :

- **Excel** (`.xlsx`) pret pour import en masse dans Jira
- **CSV** (`.csv`) optionnel

## Stockage local

Les donnees sont conservees dans le navigateur :

- generateur : `generateur-modele-md-v1`
- executeur : `generateur-cahier-recette-v1`

Format des donnees du generateur :
```json
{
  "meta": { "project": "...", "version": "...", "author": "..." },
  "business": { "objectif": "...", "perimetre": "..." },
  "rows": [
    {
      "id": "TC-001",
      "priority": "P1",
      "role": "Admin",
      "scenario": "Description du test",
      "steps": "Etape 1\nEtape 2\nEtape 3",
      "stepsArray": [
        { "text": "Etape 1", "image": null },
        { "text": "Etape 2", "image": "data:image/jpeg;base64,..." },
        { "text": "Etape 3", "image": null }
      ],
      "expected": "Resultat attendu"
    }
  ]
}
```

Format des donnees de l executeur :
```json
{
  "tests": [ ... ],
  "items": {
    "TC-001": { "result": "OK|KO|NA", "comment": "..." }
  },
  "meta": { "project": "...", "tester": "..." }
}
```

**Note importante** : Le champ `stepsArray` stocke les images en base64. Cela permet la persistence locale mais augmente la taille du localStorage. Conseil : exporter regulierement pour liberer l espace.

## Lancement

Aucune installation applicative n est requise.

- ouvrir `index.html` dans un navigateur moderne
- ou ouvrir directement `generateur-cahier-recette.html` si besoin
- ouvrir `cahier-recette.html` pour la phase d execution

Dependance front :

- SheetJS (charge via CDN dans les pages HTML)

## Script utilitaire (optionnel)

`js/create-jira-excel.js` permet de generer un fichier de modele Excel Jira.

Prerequis Node.js :

```bash
npm install xlsx
node js/create-jira-excel.js
```

Le script cree : `jira-import-template.xlsx`.

## Exemples inclus

- `xper_cahier.md`
- `ppi_cahier.md`
- `jira-import-test-template.csv`
- `jira-import-user-story-template.csv`

## Ameliorations recentes

### Support des images par etape (v1.2)
- **Generateur** :
  - Upload d images individuelles par etape (drag-drop, clic, Ctrl+V)
  - Compression automatique (JPEG 0.82 qualite, max 680px)
  - Persistence en base64 dans stepsArray
  
- **Executeur** :
  - Affichage des images d etapes creees dans le generateur
  - Design ameliore : cercles bleus numerotes (1, 2, 3...) + titre + description + image
  - Zones de capture pour ajouter preuves d execution
  - Support des deux formats : ancien (steps string) et nouveau (stepsArray)

### Redesign du rendu des etapes
- Cercles bleus numerotes (40px, couleur primaire #0284c7)
- Layout améliore : numero → titre "Etape X" → description → image
- Meilleure lisibilité et hierarchie visuelle

## Limitations connues

- donnees locales au navigateur (pas de collaboration multi-utilisateur)
- taille limitee par localStorage (risk si nombreuses images grandes)
- captures KO uniquement sur les navigateurs autorisant collage/chargement image local

## Roadmap possible

- import direct Markdown dans l executeur
- export PDF
- synchronisation via stockage distant
