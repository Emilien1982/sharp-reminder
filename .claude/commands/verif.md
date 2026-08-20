---
description: Lance toutes les vérifications du projet et corrige ce qui peut l'être
allowed-tools: Bash, Read, Edit
argument-hint: [js|android|ios|tout]
---

Lance les vérifications du projet et rends compte du résultat.

Portée demandée : **$ARGUMENTS** (par défaut : `js`).

| Portée | Commandes |
|---|---|
| `js` | `npm run verify` — typecheck, lint, format, Jest |
| `android` | `npm run verify` puis `npm run test:android` |
| `ios` | `npm run verify` puis `npm run test:ios` |
| `tout` | `npm run verify` puis `npm run test:native` |

## Règles

**Juge sur le résultat, jamais sur le message.** Ce projet a produit trois faux
positifs mémorables : un `BUILD SUCCESSFUL` de Gradle sans qu'aucun test ne
tourne, un `exit 0` de `react-native run-ios` sur un `xcodebuild` en erreur 65,
et un `grep` filtrant qui masquait un échec de Prettier. Donc :

- Utilise `commande && echo OK || echo ÉCHEC` plutôt que de filtrer la sortie.
- Après un build natif, vérifie que l'artefact existe réellement
  (`simctl get_app_container`, présence de l'APK).
- Après une suite native, lis le rapport (`app/build/test-results/**/*.xml`)
  et compte les tests exécutés : zéro test qui passe n'est pas un succès.
- Pour inspecter une classe Java compilée, utilise `javap`, jamais `strings`.

## En cas d'échec

- Corrige seul ce qui relève du formatage ou du lint.
- Pour une erreur de typage ou un test rouge : **diagnostique avant de
  corriger**, explique la cause en une phrase, puis propose la correction.
- Ne désactive jamais une règle de lint ni un test pour faire passer la
  vérification.
- Si un test échoue parce que le comportement a volontairement changé, mets à
  jour le test — et ajoute le cas correspondant à
  `shared/fixtures/evaluator-cases.json` s'il touche l'évaluateur.

Termine par une ligne par contrôle : ✅ ou ❌ avec le nombre de tests exécutés.
