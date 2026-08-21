# Sharp Reminder — instructions projet

App de rappels Android + iOS dont la valeur différenciante est la richesse des
**déclencheurs** : date/heure, Wi-Fi, Bluetooth, géolocalisation, combinables en
AND ou OR. 100 % local, aucun backend, aucune télémétrie.

## Commandes

```bash
npm run verify        # typecheck + lint + format + Jest — avant tout commit
npm run test:native   # JUnit (Kotlin) + XCTest (Swift)
npm run android       # build et lance sur l'appareil branché
npm run ios           # build et lance sur le simulateur
```

Après tout ajout de fichier natif iOS (nouveau déclencheur, par exemple) :

```bash
cd ios && bundle exec ruby scripts/sync-xcode-project.rb
```

Le projet iOS référence ses fichiers explicitement : un fichier Swift non
déclaré n'est pas compilé, et un chemin erroné ne se voit qu'après plusieurs
minutes de build. Le script est idempotent et vérifie que chaque source pointe
vers un fichier existant.

## Environnement de test

| | |
|---|---|
| Android | Galaxy S21 (`SM-G991B`), Android 15 / API 35, arm64, branché en USB |
| iOS | Simulateur iPhone 17 Pro, iOS 26.5 |
| Durée de build | Android ≈ 3 min ; iOS ≈ 10 min à froid, ≈ 2 min ensuite |
| Outillage | Tout en arm64 natif : JDK 17 (`/opt/homebrew/opt/openjdk@17`), Node, CocoaPods |

L'écran du téléphone Android se verrouille vite : une capture d'écran prise
pendant qu'il est verrouillé ne montre pas l'application, et l'écran cesse de
se rendre — ce n'est pas une panne.

L'écran de liste affiche en pied de page l'état réel du moteur natif (nombre
de règles, écoutes actives). Ce n'est pas un reste du panneau de test retiré en
phase 3 : sans backend ni télémétrie, c'est le seul moyen de constater qu'une
écoute s'éteint quand on désactive un rappel.

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

### Le déclencheur date/heure diffère volontairement entre les deux plateformes

Ce n'est pas une incohérence, c'est l'usage du meilleur outil de chaque système :

- **Android** réveille l'application via `AlarmManager.setExactAndAllowWhileIdle`,
  qui évalue puis notifie. Nécessaire, car rien d'autre ne permet de vérifier
  les autres conditions d'une règle combinée.
- **iOS** confie la notification au système via `UNCalendarNotificationTrigger`.
  Elle est délivrée à l'heure dite sans réveiller la moindre ligne de code,
  application tuée — plus fiable que tout ce qu'on pourrait bâtir.

Conséquence : une règle en **ET** combinant une date et un autre signal ne peut
pas être confiée au système iOS, qui notifierait sans vérifier le reste. Ces
règles sont évaluées au retour au premier plan. `RuleSnapshotStore` marque les
règles confiées au système (`osScheduledRuleIds`) afin que la réévaluation
suivante ne publie pas une seconde notification pour un rappel déjà délivré.

## Hors périmètre V1

NFC, recherche de lieux par enseigne, météo, cycle lunaire, appel entrant, son
ambiant, roaming. Pas de tags ni dossiers, pas de mode sombre, pas de widget,
pas de pièce jointe, pas d'actions rapides de notification, pas de migration de
schéma, pas de sync cloud, pas de publication sur les stores.

L'architecture doit les accueillir sans les implémenter.
