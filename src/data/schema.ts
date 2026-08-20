/**
 * Schéma SQLite.
 *
 * Choix de conception — les conditions sont stockées en JSON dans une colonne,
 * pas dans une table normalisée. Motif : `TriggerCondition` est une union
 * discriminée aux champs hétérogènes (une condition wifi n'a rien en commun
 * avec une condition géographique). La normaliser imposerait soit une table
 * large et creuse, soit un modèle entité-attribut-valeur — deux formes qui
 * dégradent la lisibilité sans bénéfice ici : l'application manipule quelques
 * dizaines de rappels, et SQLite sait interroger le JSON (`json_extract`) si
 * un besoin de filtrage par type apparaît. Le type TypeScript reste ainsi
 * l'unique source de vérité du format.
 *
 * Voir docs/adr/0003-stockage-local.md.
 */

/**
 * Version du schéma, persistée dans `schema_meta`.
 *
 * La V1 n'embarque pas de système de migration (§6 du brief), mais enregistre
 * sa version dès le départ : un futur mécanisme de migration saura ainsi d'où
 * partir, sans avoir à deviner l'état des bases existantes.
 */
export const SCHEMA_VERSION = 1;

export const DDL = [
  `CREATE TABLE IF NOT EXISTS schema_meta (
     key   TEXT PRIMARY KEY NOT NULL,
     value TEXT NOT NULL
   );`,

  `CREATE TABLE IF NOT EXISTS reminders (
     id            TEXT PRIMARY KEY NOT NULL,
     text          TEXT NOT NULL,
     enabled       INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
     combinator    TEXT NOT NULL CHECK (combinator IN ('AND', 'OR')),
     conditions    TEXT NOT NULL,
     after_fire    TEXT NOT NULL CHECK (after_fire IN ('delete', 'keep')),
     created_at    TEXT NOT NULL,
     updated_at    TEXT NOT NULL,
     last_fired_at TEXT
   );`,

  // Le snapshot envoyé au natif ne contient que les rappels actifs : cet index
  // sert la requête la plus fréquente de l'application.
  `CREATE INDEX IF NOT EXISTS idx_reminders_enabled ON reminders (enabled);`,
] as const;

export const DATABASE_NAME = 'sharp-reminder.sqlite';
