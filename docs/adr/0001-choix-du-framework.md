# 0001 — React Native CLI plutôt que Expo, Flutter ou natif

**Statut** : Acceptée — 2026-08-19

## Contexte

L'app doit tourner sur Android et iOS, et son cœur consiste à surveiller des
signaux système en arrière-plan (Wi-Fi, Bluetooth, géolocalisation). Le
propriétaire du projet est développeur React Native.

Point essentiel : **quel que soit le framework choisi, les déclencheurs
s'écrivent en Kotlin et en Swift.** Aucun framework cross-platform n'offre
d'accès générique au `GeofencingClient` d'Android ou à `CoreBluetooth`. Le
choix ne porte donc que sur l'interface et sur la manière d'écrire les ponts
vers le natif.

## Options envisagées

| Option | Avantage | Ce qu'on perd |
|---|---|---|
| **React Native CLI (bare)** | Contrôle total sur `android/` et `ios/` | Beaucoup de code répétitif : chaque TurboModule s'écrit à la main |
| React Native + Expo Modules | API bien plus concise pour les modules natifs, typage TS généré | Une couche d'abstraction supplémentaire à comprendre |
| Flutter | Excellente UI | Dart à apprendre ; les Platform Channels n'apportent rien de plus que les TurboModules |
| Natif Kotlin + Swift | Meilleur contrôle de l'arrière-plan | Deux interfaces à écrire et maintenir |

## Décision

**React Native CLI en version bare.**

Le propriétaire du projet connaît React Native : il peut donc relire et juger
le code TypeScript produit, ce qui est la condition même de l'objectif
d'apprentissage. Le mode bare a été préféré à Expo pour garder les projets
`android/` et `ios/` entièrement visibles — quand l'essentiel du travail est
natif, une couche d'abstraction de plus masque précisément ce qu'on cherche à
comprendre.

## Conséquences

- Chaque déclencheur demande d'écrire un TurboModule à la main, deux fois.
  C'est le coût assumé du contrôle total.
- Les mises à jour de React Native devront être appliquées manuellement aux
  dossiers natifs, sans `expo prebuild` pour les régénérer.
- Version figée à **0.86.2** plutôt que 0.87.0, sortie huit jours plus tôt et
  sans correctif : les bibliothèques natives tierces (op-sqlite, MapLibre) ne
  l'ont pas encore rattrapée.
