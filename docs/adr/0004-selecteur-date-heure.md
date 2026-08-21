# 0004 — Sélecteur date/heure : dépendance native plutôt que saisie texte

- **Statut** : Acceptée
- **Date** : 21 août 2026
- **Contexte** : phase 3, écran de création et d'édition des rappels

## Problème

L'écran d'édition doit permettre de choisir une date et une heure. Le projet
n'embarquait jusqu'ici aucun composant de saisie : le panneau de test
fabriquait des rappels « dans 1 minute » par calcul, sans que l'utilisateur
n'ait jamais rien saisi.

Le déclencheur date/heure est la fonction la plus utilisée d'une application de
rappels. La qualité de cette saisie n'est donc pas un détail d'interface.

## Décision

Ajouter `@react-native-community/datetimepicker` (v9.1.0) et l'encapsuler dans
`src/app/components/DateTimeConditionEditor.tsx`.

## Options écartées

**Saisie texte pure JavaScript** (`JJ/MM/AAAA` et `HH:MM` dans des
`TextInput`). Aucune dépendance native, aucun rebuild, aucun risque de
plomberie Xcode — un argument sérieux après les trois échecs de compilation iOS
de la phase 2. Écartée parce qu'elle transfère à notre code ce que les deux
systèmes font déjà correctement : format 24 h ou AM/PM selon le réglage de
l'appareil, noms de mois localisés, années bissextiles, fuseau. Ce sont
précisément les cas où un défaut passe inaperçu jusqu'à ce qu'un rappel sonne
au mauvais moment.

**Roues de sélection maison** en `FlatList`. Pas de dépendance, rendu
maîtrisé, mais un rendu qui n'est celui d'aucune des deux plateformes, et un
volume de code d'interface à maintenir sans rapport avec la valeur apportée.

## Ce qu'on accepte en la retenant

- **Un rebuild natif des deux plateformes**, `pod install` compris. Le mode
  *bare* laisse cette plomberie à notre charge — coût déjà chiffré en phase 2.
- **Une divergence d'API à absorber** : Android n'a pas de mode `datetime` et
  s'ouvre en impératif (`DateTimePickerAndroid.open()`), iOS se rend comme un
  composant inline. `DateTimeConditionEditor` existe pour que cette différence
  ne remonte pas dans l'écran d'édition.
- **Une doublure Jest**, puisque le module natif est inchargeable sous Node.
- **Une dépendance de plus à suivre** lors des montées de version de React
  Native.

## Conséquence pour la suite

Les phases 4 à 6 ajouteront des éditeurs Wi-Fi, Bluetooth et géolocalisation.
Le motif est posé : un composant par type de condition, choisi par le `switch`
de `ConditionEditor.tsx`, lui-même fermé par `assertNeverCondition`. Une
dépendance native supplémentaire (une carte, par exemple) suivra la même
logique d'encapsulation.
