import type { DB, Scalar } from '@op-engineering/op-sqlite';

import { getDatabase } from '@/data/database';
import { newId } from '@/domain/id';
import type {
  Reminder,
  ReminderDraft,
  ReminderPatch,
} from '@/domain/reminders/types';
import type { TriggerCondition } from '@/domain/triggers/types';

/**
 * Accès aux rappels.
 *
 * L'interface utilisateur ne voit jamais de SQL : elle passe exclusivement par
 * ce contrat. Cela permettra de changer de moteur de stockage, ou d'ajouter la
 * synchronisation cloud évoquée au §6 du brief, sans toucher aux écrans.
 */
export interface ReminderRepository {
  list(): Promise<Reminder[]>;
  /** Rappels actifs uniquement — c'est ce qui compose le snapshot natif. */
  listEnabled(): Promise<Reminder[]>;
  get(id: string): Promise<Reminder | null>;
  create(draft: ReminderDraft): Promise<Reminder>;
  update(id: string, patch: ReminderPatch): Promise<Reminder>;
  /** Duplication d'un rappel existant (§2 du brief, requis en V1). */
  duplicate(id: string): Promise<Reminder>;
  remove(id: string): Promise<void>;
  markFired(id: string, firedAt: string): Promise<void>;
}

type ReminderRow = Record<string, Scalar>;

function requireString(row: ReminderRow, column: string): string {
  const value = row[column];
  if (typeof value !== 'string') {
    throw new Error(
      `Colonne "${column}" invalide : chaîne attendue, reçu ${typeof value}.`,
    );
  }
  return value;
}

function optionalString(row: ReminderRow, column: string): string | null {
  const value = row[column];
  return typeof value === 'string' ? value : null;
}

function parseConditions(raw: string): TriggerCondition[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Colonne "conditions" invalide : tableau JSON attendu.');
  }
  // Le contenu provient exclusivement de `serialiseConditions`, jamais d'une
  // source externe : une validation champ par champ serait redondante en V1.
  // Elle deviendra nécessaire le jour où l'import de sauvegarde existera.
  return parsed as TriggerCondition[];
}

function toDomain(row: ReminderRow): Reminder {
  const combinator = requireString(row, 'combinator');
  const afterFire = requireString(row, 'after_fire');

  if (combinator !== 'AND' && combinator !== 'OR') {
    throw new Error(`Combinateur inconnu en base : "${combinator}".`);
  }
  if (afterFire !== 'delete' && afterFire !== 'keep') {
    throw new Error(`Comportement post-déclenchement inconnu : "${afterFire}".`);
  }

  return {
    id: requireString(row, 'id'),
    text: requireString(row, 'text'),
    enabled: row.enabled === 1,
    combinator,
    conditions: parseConditions(requireString(row, 'conditions')),
    afterFire,
    createdAt: requireString(row, 'created_at'),
    updatedAt: requireString(row, 'updated_at'),
    lastFiredAt: optionalString(row, 'last_fired_at'),
  };
}

function serialiseConditions(conditions: TriggerCondition[]): string {
  return JSON.stringify(conditions);
}

const SELECT_COLUMNS = `id, text, enabled, combinator, conditions, after_fire,
                        created_at, updated_at, last_fired_at`;

export function createReminderRepository(db: DB): ReminderRepository {
  async function get(id: string): Promise<Reminder | null> {
    const result = await db.execute(
      `SELECT ${SELECT_COLUMNS} FROM reminders WHERE id = ?;`,
      [id],
    );
    const row = result.rows[0];
    return row ? toDomain(row) : null;
  }

  async function requireReminder(id: string): Promise<Reminder> {
    const reminder = await get(id);
    if (!reminder) {
      throw new Error(`Rappel introuvable : ${id}`);
    }
    return reminder;
  }

  async function insert(reminder: Reminder): Promise<Reminder> {
    await db.execute(
      `INSERT INTO reminders
         (id, text, enabled, combinator, conditions, after_fire,
          created_at, updated_at, last_fired_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        reminder.id,
        reminder.text,
        reminder.enabled ? 1 : 0,
        reminder.combinator,
        serialiseConditions(reminder.conditions),
        reminder.afterFire,
        reminder.createdAt,
        reminder.updatedAt,
        reminder.lastFiredAt,
      ],
    );
    return reminder;
  }

  return {
    async list(): Promise<Reminder[]> {
      const result = await db.execute(
        `SELECT ${SELECT_COLUMNS} FROM reminders ORDER BY created_at DESC;`,
      );
      return result.rows.map(toDomain);
    },

    async listEnabled(): Promise<Reminder[]> {
      const result = await db.execute(
        `SELECT ${SELECT_COLUMNS} FROM reminders
         WHERE enabled = 1 ORDER BY created_at DESC;`,
      );
      return result.rows.map(toDomain);
    },

    get,

    async create(draft: ReminderDraft): Promise<Reminder> {
      const now = new Date().toISOString();
      return insert({
        ...draft,
        id: newId(),
        createdAt: now,
        updatedAt: now,
        lastFiredAt: null,
      });
    },

    async update(id: string, patch: ReminderPatch): Promise<Reminder> {
      const current = await requireReminder(id);
      const next: Reminder = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };

      await db.execute(
        `UPDATE reminders
            SET text = ?, enabled = ?, combinator = ?, conditions = ?,
                after_fire = ?, updated_at = ?
          WHERE id = ?;`,
        [
          next.text,
          next.enabled ? 1 : 0,
          next.combinator,
          serialiseConditions(next.conditions),
          next.afterFire,
          next.updatedAt,
          id,
        ],
      );

      return next;
    },

    async duplicate(id: string): Promise<Reminder> {
      const source = await requireReminder(id);
      const now = new Date().toISOString();

      return insert({
        ...source,
        id: newId(),
        // Les conditions reçoivent de nouveaux identifiants : sans cela, la
        // copie et l'original partageraient les mêmes, et le moteur natif ne
        // pourrait plus distinguer leurs déclencheurs.
        conditions: source.conditions.map(condition => ({
          ...condition,
          id: newId(),
        })),
        createdAt: now,
        updatedAt: now,
        lastFiredAt: null,
      });
    },

    async remove(id: string): Promise<void> {
      await db.execute('DELETE FROM reminders WHERE id = ?;', [id]);
    },

    async markFired(id: string, firedAt: string): Promise<void> {
      await db.execute(
        'UPDATE reminders SET last_fired_at = ?, updated_at = ? WHERE id = ?;',
        [firedAt, new Date().toISOString(), id],
      );
    },
  };
}

/** Dépôt branché sur la base de l'application. */
export async function getReminderRepository(): Promise<ReminderRepository> {
  return createReminderRepository(await getDatabase());
}
