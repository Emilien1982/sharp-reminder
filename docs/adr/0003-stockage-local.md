# 0003 — SQLite, conditions stockées en JSON

**Statut** : Acceptée — 2026-08-19

## Contexte

Stockage 100 % local, aucun compte, aucun serveur. Les données doivent rester
structurées proprement et exportables, en prévision d'une synchronisation
future via le cloud personnel de l'utilisateur. Aucun système de migration
n'est exigé en V1.

## Décision

**SQLite** via `@op-engineering/op-sqlite`, une seule table `reminders`, et les
conditions de déclenchement sérialisées en **JSON dans une colonne**.

## Pourquoi pas une table normalisée

`TriggerCondition` est une union discriminée aux champs hétérogènes : une
condition Wi-Fi porte un SSID, une condition géographique porte latitude,
longitude et rayon. Ces types n'ont aucun champ en commun hors l'identifiant.

Les normaliser imposerait soit une table large et creuse — une colonne par
champ de chaque type, la plupart toujours nulles — soit un modèle
entité-attribut-valeur. Les deux dégradent la lisibilité sans bénéfice réel :
l'application manipule quelques dizaines de rappels, et SQLite sait interroger
le JSON via `json_extract` si un besoin de filtrage par type apparaît.

Le type TypeScript reste ainsi l'**unique source de vérité** du format, ce qui
compte d'autant plus que ce même format part vers le natif.

## Conséquences

- Impossible de contraindre la forme d'une condition au niveau SQL. La
  validation repose sur le typage TypeScript à l'écriture. Le jour où un import
  de sauvegarde existera, une validation à la lecture deviendra nécessaire —
  c'est signalé dans `parseConditions`.
- Une table `schema_meta` enregistre `schema_version = 1` dès la V1. Aucun
  mécanisme de migration n'est écrit, mais un futur mécanisme saura d'où partir
  au lieu de devoir deviner l'état des bases existantes.
- L'ajout de tags ou de dossiers se fera par une table liée, sans toucher au
  format des conditions. `PRAGMA foreign_keys = ON` est déjà activé pour que ce
  jour-là l'intégrité référentielle fonctionne sans changement de comportement.
- La conversion ligne ↔ objet est isolée dans `src/data/reminderMapping.ts`
  afin d'être testable sans base de données.
