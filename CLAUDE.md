# Sharp Reminder — instructions projet

App de rappels Android + iOS dont la valeur différenciante est la richesse des
**déclencheurs** : date/heure, Wi-Fi, Bluetooth, géolocalisation, combinables en
AND ou OR. 100 % local, aucun backend, aucune télémétrie.

## Commandes

```bash
npm run verify        # typecheck + lint + format + tests — à lancer avant tout commit
npm run android       # build et lance sur l'appareil branché
npm test              # Jest seul
cd android && ./gradlew assembleDebug   # build Android sans Metro
```

## Architecture

Le point le plus important : **le moteur de déclencheurs vit dans le natif, pas
en JavaScript.** Quand l'application est tuée ou que le téléphone est en Doze,
il n'y a pas de runtime JS. Le natif doit donc pouvoir évaluer les règles et
poster une notification seul.

```
JS / TypeScript                  Natif (Kotlin ‖ Swift)
SQLite (source de vérité)        TriggerEngine (TurboModule)
UI, édition, i18n      ──push──▶   RuleSnapshotStore (miroir lecture seule)
                                   TriggerRegistry → modules par type
                       ◀─drain──   Evaluator (AND/OR) · Notifier
```

- Le JS pousse au natif un snapshot JSON des **rappels actifs uniquement** à
  chaque écriture en base. Le natif le persiste et n'a jamais besoin du JS.
- Le natif empile les déclenchements ; le JS vide cette file au lancement.
- SQLite reste l'unique source de vérité (export et sync futurs).

### Structure

| Dossier | Rôle |
|---|---|
| `src/domain/` | Modèles et logique pure. Aucune dépendance à React ni au natif. |
| `src/data/` | SQLite. `reminderMapping.ts` isole la conversion, pour qu'elle soit testable. |
| `src/app/` | Navigation et écrans. |
| `src/i18n/` | Traductions. Le français fait référence. |
| `src/native/` | Specs des TurboModules. |
| `shared/fixtures/` | Cas de test partagés entre Jest, JUnit et XCTest. |

## Règles de travail

1. **Android d'abord, toujours.** Pour chaque déclencheur : implémenter Android,
   s'arrêter, laisser l'utilisateur tester sur son téléphone physique, corriger,
   et seulement ensuite écrire le Swift. Ne jamais enchaîner sur iOS de sa
   propre initiative.
2. **L'évaluateur AND/OR existe en trois exemplaires** (TS, Kotlin, Swift). Toute
   règle logique ajoutée doit l'être dans `shared/fixtures/evaluator-cases.json`,
   consommé par les trois suites de tests. C'est le seul garde-fou contre une
   divergence silencieuse entre plateformes.
3. **Le coût d'un déclencheur est fourni par le natif**, jamais codé en dur en
   TypeScript : le Bluetooth appairé est gratuit sur Android (broadcast système)
   et coûteux sur iOS (scan BLE).
4. **Permissions demandées en contexte**, au moment où l'utilisateur crée son
   premier rappel du type concerné. Pas d'onboarding listant tout à l'avance.
5. **Commits en Conventional Commits, en français.** Voir `CONTRIBUTING.md`.
6. Documenter les décisions d'architecture dans `docs/adr/`.

## Limites iOS à ne pas oublier

Elles sont structurelles, pas contournables :

- **Wi-Fi** : `NEHotspotNetwork.fetchCurrent` ne fonctionne qu'app active. Aucun
  callback de changement de SSID en arrière-plan.
- **Bluetooth** : CoreBluetooth ne voit pas les appareils appairés classiques
  (casque, voiture). Contournement partiel via `AVAudioSession.routeChange`.
- **Géolocalisation** : fonctionne bien, mais **20 régions surveillées maximum**.

Sur iOS, Wi-Fi et Bluetooth sont donc *best-effort* : réévalués au réveil de
l'app. Cette limite doit être visible dans l'interface, pas masquée.

## Hors périmètre V1

NFC, recherche de lieux par enseigne, météo, cycle lunaire, appel entrant, son
ambiant, roaming. Pas de tags ni dossiers, pas de mode sombre, pas de widget,
pas de pièce jointe, pas d'actions rapides de notification, pas de migration de
schéma, pas de sync cloud, pas de publication sur les stores.

L'architecture doit les accueillir sans les implémenter.
