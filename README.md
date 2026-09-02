# Sharp Reminder

Application de rappels pour Android et iOS. Sa particularité : les rappels ne
se déclenchent pas seulement à une heure donnée, mais aussi en arrivant dans un
lieu, en se connectant à un réseau Wi-Fi, ou en appairant un appareil
Bluetooth — conditions combinables en ET ou en OU.

Tout est stocké localement. Pas de compte, pas de serveur, pas de télémétrie.

## État : projet arrêté

**Le développement s'arrête à la version 0.6.0**, et la raison tient en une
phrase : *les deux systèmes ne laissent pas construire les déclencheurs qui
auraient justifié cette application.*

| Déclencheur | Android | iOS |
|---|---|---|
| Date et heure | ✅ fiable, application tuée | ✅ fiable, application tuée |
| Géolocalisation | ✅ fiable, application tuée | ✅ fiable (20 zones maximum) |
| Wi-Fi | ⚠️ seulement l'application vivante | ❌ non implémenté |
| Bluetooth | non implémenté | non implémenté |

Les rappels se créent, se modifient, se dupliquent, s'activent et se combinent
en ET ou en OU. Ce qui existe fonctionne et est testé.

### Pourquoi l'arrêt

Le pari du projet était qu'un rappel déclenché par le **contexte** — un réseau,
un appareil, un lieu — vaudrait mieux qu'un rappel à heure fixe. Il supposait
que le système accepte de réveiller l'application quand ce contexte change.
Deux déclencheurs sur quatre le permettent. Les deux autres, non :

- **Wi-Fi.** `CONNECTIVITY_ACTION` n'est plus délivré aux récepteurs du
  manifeste depuis Android 8. La variante
  `registerNetworkCallback(NetworkRequest, PendingIntent)`, qui promet
  exactement ce réveil, **n'a délivré aucune diffusion** lors des essais sur
  Galaxy S21 / Android 15 — ni en arrière-plan, ni au premier plan, sans lever
  la moindre exception. Reste un `NetworkCallback` ordinaire, qui meurt avec le
  processus. Sur iOS, `NEHotspotNetwork.fetchCurrent` exige une capacité
  réservée à un compte développeur payant et ne répond de toute façon
  qu'application active.
- **Bluetooth.** Gratuit sur Android, mais sur iOS CoreBluetooth ne voit pas les
  appareils appairés classiques — casque, autoradio — c'est-à-dire précisément
  ceux sur lesquels on voudrait accrocher un rappel.

Il reste donc la date et le lieu : ce que proposent déjà toutes les
applications de rappels. **L'écart qui justifiait d'en écrire une nouvelle a
disparu**, non par manque de travail, mais parce que les plateformes l'ont
fermé. Continuer aurait produit un clone de plus.

Le code reste en ligne : l'architecture — moteur natif autonome, évaluateur
triplé gardé par des cas de test partagés, extinction automatique des capteurs
inutilisés — vaut d'être lue indépendamment de l'application qu'elle sert.

### Ce qui n'a pas été fait

Récurrence (« tous les samedis »), Bluetooth, Wi-Fi sur iOS, et la validation
terrain du Wi-Fi Android en conditions réelles.

## Démarrer

Prérequis : Node ≥ 22, JDK 17, Android SDK 36, Xcode 26 pour iOS.

```bash
npm install
npm run android        # appareil branché avec débogage USB activé
```

Pour iOS, installer d'abord les pods :

```bash
cd ios && bundle install && bundle exec pod install && cd ..
npm run ios
```

## Vérifier

```bash
npm run verify         # typecheck + lint + formatage + tests
```

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — architecture et règles de travail
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — conventions de commit et de version
- [`docs/adr/`](docs/adr/) — décisions d'architecture et leurs raisons
- [`docs/journal-claude-code.md`](docs/journal-claude-code.md) — journal du projet
