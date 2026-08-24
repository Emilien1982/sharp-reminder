# Sharp Reminder

Application de rappels pour Android et iOS. Sa particularité : les rappels ne
se déclenchent pas seulement à une heure donnée, mais aussi en arrivant dans un
lieu, en se connectant à un réseau Wi-Fi, ou en appairant un appareil
Bluetooth — conditions combinables en ET ou en OU.

Tout est stocké localement. Pas de compte, pas de serveur, pas de télémétrie.

## État

En développement. Voir `docs/journal-claude-code.md` pour l'avancement.

| Déclencheur | Android | iOS |
|---|---|---|
| Date et heure | ✅ | ✅ |
| Géolocalisation | ✅ | ✅ |
| Wi-Fi | à venir | à venir (best-effort, voir ci-dessous) |
| Bluetooth | à venir | à venir (best-effort) |

Les rappels se créent, se modifient, se dupliquent et s'activent depuis
l'application. Les trois déclencheurs restants viendront s'ajouter à la liste
de conditions existante, combinables en ET ou en OU.

Sur iOS, les déclencheurs Wi-Fi et Bluetooth sont limités par le système : Apple
n'autorise pas la surveillance de ces signaux en arrière-plan. Ils sont
réévalués au réveil de l'application. La géolocalisation et la date/heure ne
souffrent d'aucune limitation.

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
