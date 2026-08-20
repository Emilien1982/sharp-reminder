import { open, type DB } from '@op-engineering/op-sqlite';

import { DATABASE_NAME, DDL, SCHEMA_VERSION } from '@/data/schema';

let instance: DB | null = null;

/**
 * Ouvre la base et applique le schéma.
 *
 * Idempotent : le DDL n'utilise que des `CREATE ... IF NOT EXISTS`, et la
 * connexion est mise en cache. Appelable sans risque à chaque démarrage.
 */
export async function getDatabase(): Promise<DB> {
  if (instance) {
    return instance;
  }

  const db = open({ name: DATABASE_NAME });

  // `foreign_keys` est désactivé par défaut dans SQLite ; on l'active dès
  // maintenant pour que l'ajout futur de tables liées (tags, dossiers)
  // bénéficie de l'intégrité référentielle sans changement de comportement.
  await db.execute('PRAGMA foreign_keys = ON;');

  for (const statement of DDL) {
    await db.execute(statement);
  }

  await db.execute(
    `INSERT INTO schema_meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT (key) DO NOTHING;`,
    [String(SCHEMA_VERSION)],
  );

  instance = db;
  return db;
}

/** Ferme la connexion. Utilisé par les tests ; inutile en production. */
export async function closeDatabase(): Promise<void> {
  if (instance) {
    instance.close();
    instance = null;
  }
}
