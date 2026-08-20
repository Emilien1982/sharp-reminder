---
description: Lance toutes les vérifications du projet et corrige ce qui peut l'être
allowed-tools: Bash, Read, Edit
---

Lance les vérifications du projet et rends compte du résultat.

1. `npm run verify` (typecheck + lint + format + tests Jest)
2. Si des tests natifs Android existent, `cd android && ./gradlew test`

En cas d'échec :

- Corrige ce qui relève du formatage ou du lint automatiquement.
- Pour une erreur de typage ou un test rouge, **diagnostique avant de corriger** :
  explique la cause en une phrase, puis propose la correction. Ne désactive
  jamais une règle de lint ni un test pour faire passer la vérification.
- Si un test échoue pour une raison légitime (comportement volontairement
  modifié), mets à jour le test, pas le code.

Termine par un résumé en une ligne par contrôle : ✅ ou ❌ avec le nombre
d'erreurs.
