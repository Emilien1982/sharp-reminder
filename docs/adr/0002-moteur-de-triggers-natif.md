# 0002 — Le moteur de déclencheurs vit dans le natif

**Statut** : Acceptée — 2026-08-19

## Contexte

Un rappel doit se déclencher même quand l'application est fermée. C'est la
promesse fondamentale du produit : un rappel qui n'arrive pas est pire
qu'inutile.

## Le piège évité

L'architecture intuitive consiste à faire écouter le natif et à lui faire
remonter les signaux au JavaScript, qui évalue les règles et poste la
notification.

**Elle ne fonctionne pas.** Application tuée ou téléphone en Doze, il n'existe
aucun runtime JavaScript pour recevoir l'événement. Sur iOS, un réveil en
arrière-plan n'accorde que quelques secondes — largement insuffisant pour
démarrer un moteur JS. Cette architecture donnerait une app qui marche
parfaitement en développement, l'app étant au premier plan, et qui échoue
silencieusement chez l'utilisateur.

## Décision

Le natif évalue et notifie **seul**. Le JavaScript n'est qu'une interface de
configuration.

```
JS                                Natif
SQLite (source de vérité) ─push─▶ RuleSnapshotStore (miroir lecture seule)
                                  TriggerRegistry → un module par type
                          ◀drain─ Evaluator (AND/OR) · Notifier
```

- À chaque écriture en base, le JS pousse au natif un snapshot JSON des
  **rappels actifs uniquement**. Le natif le persiste (`SharedPreferences` sur
  Android, `UserDefaults` sur iOS).
- Le natif empile les déclenchements dans une file que le JS vide au prochain
  lancement, pour appliquer le comportement post-déclenchement.
- `TriggerRegistry` calcule l'union des types utilisés par les rappels actifs
  et démarre ou arrête les écoutes en conséquence — ce qui satisfait
  mécaniquement l'exigence d'extinction des déclencheurs gourmands.

## Conséquences

- **L'évaluateur AND/OR existe en trois exemplaires** : TypeScript pour
  l'aperçu dans l'interface, Kotlin, Swift. C'est le principal risque de cette
  architecture : trois implémentations peuvent diverger sans que rien ne le
  signale.
  *Atténuation* : un jeu de cas unique dans
  `shared/fixtures/evaluator-cases.json`, consommé par Jest, JUnit et XCTest.
  Un cas ajouté est vérifié sur les trois plateformes d'un coup.
- Le format de règle reste volontairement plat — une liste de conditions et un
  seul combinateur — pour que la logique à tripler reste triviale. Pas
  d'imbrication de groupes en V1.
- Le coût énergétique d'un type de déclencheur est **fourni par le natif** et
  non codé en dur en TypeScript : le Bluetooth appairé est gratuit sur Android
  (broadcast système) et coûteux sur iOS (scan BLE).
