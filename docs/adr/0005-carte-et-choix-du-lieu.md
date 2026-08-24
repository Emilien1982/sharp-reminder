# 0005 — Carte Google sur Android, Apple sur iOS

- **Statut** : Acceptée
- **Date** : 22 août 2026
- **Contexte** : phase 4, déclencheur de géolocalisation

## Problème

Un déclencheur de lieu suppose de choisir un lieu. Trois voies : saisie de
coordonnées, carte sans clé d'API, ou carte Google.

Le critère décisif est venu de l'utilisateur : pouvoir, à terme, désigner un
**magasin** — donc rechercher un commerce par son nom. Cette recherche est hors
périmètre V1, mais le choix de la carte détermine si elle restera possible.

## Décision

`react-native-maps`, avec Google Maps sur Android et Apple Maps sur iOS.

## Ce qui a été vérifié, plutôt que supposé

- `react-native-maps` **impose une clé Google sur Android**. Les tuiles
  OpenStreetMap ne sont utilisables que sur iOS ; côté Android la bibliothèque
  bloque, à la suite d'abus de charge passés.
- La **couverture OpenStreetMap des enseignes commerciales est inconstante**
  selon les régions, nettement plus pauvre que Google. Une carte sans clé
  condamnait donc l'objectif « désigner un magasin ».

## Options écartées

**Position actuelle et rayon, sans carte.** Aucune dépendance, aucun compte.
Écartée comme trop restrictive : impossible de viser un lieu où l'on ne se
trouve pas, alors que c'est le cas d'usage principal — préparer un rappel pour
un magasin depuis chez soi.

**Carte OpenStreetMap ou MapLibre.** Pas de clé à gérer, mais deux
implémentations de carte à écrire et maintenir, et une recherche d'enseignes
durablement inférieure.

## Ce qu'on accepte en la retenant

- **Un compte Google Cloud avec facturation active**, carte bancaire
  enregistrée, alors même que le Maps SDK for Android est gratuit et illimité.
- **Un secret à protéger dans un dépôt public.** Trois protections combinées :
  la clé vit dans `android/local.properties` que `.gitignore` couvre ; Gradle
  l'injecte au manifeste par substituant, donc aucun fichier versionné ne la
  contient ; et elle est restreinte côté Google au nom de paquet et à
  l'empreinte SHA-1 du certificat, ce qui la rend inutilisable ailleurs si elle
  fuite malgré tout.
- **La recherche d'enseignes sera facturée** le jour où elle sera implémentée
  (Places API), au-delà d'un quota mensuel modeste.

## Conséquence pour la suite

La recherche par nom reste possible sans reprendre l'architecture : le modèle
ne stocke que latitude, longitude et rayon. Changer de sélecteur ne touche
aucune couche en dessous de l'interface.
