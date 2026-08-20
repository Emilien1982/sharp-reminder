import type { Scalar } from '@op-engineering/op-sqlite';

import type { Reminder } from '@/domain/reminders/types';
import type { TriggerCondition } from '@/domain/triggers/types';

/**
 * Conversion entre lignes SQLite et objets métier.
 *
 * Extrait du dépôt pour être testable sans base de données : c'est ici que se
 * logent les erreurs les plus coûteuses (un booléen mal converti, un JSON mal
 * relu) et les moins visibles à l'exécution.
 */

export type ReminderRow = Record<string, Scalar>;

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

export function parseConditions(raw: string): TriggerCondition[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Colonne "conditions" invalide : tableau JSON attendu.');
  }
  // Le contenu provient exclusivement de `serialiseConditions`, jamais d'une
  // source externe : une validation champ par champ serait redondante en V1.
  // Elle deviendra nécessaire le jour où l'import de sauvegarde existera.
  return parsed as TriggerCondition[];
}

export function serialiseConditions(conditions: TriggerCondition[]): string {
  return JSON.stringify(conditions);
}

export function rowToReminder(row: ReminderRow): Reminder {
  const combinator = requireString(row, 'combinator');
  const afterFire = requireString(row, 'after_fire');

  if (combinator !== 'AND' && combinator !== 'OR') {
    throw new Error(`Combinateur inconnu en base : "${combinator}".`);
  }
  if (afterFire !== 'delete' && afterFire !== 'keep') {
    throw new Error(
      `Comportement post-déclenchement inconnu : "${afterFire}".`,
    );
  }

  return {
    id: requireString(row, 'id'),
    text: requireString(row, 'text'),
    // SQLite n'a pas de type booléen : la colonne stocke 0 ou 1.
    enabled: row.enabled === 1,
    combinator,
    conditions: parseConditions(requireString(row, 'conditions')),
    afterFire,
    createdAt: requireString(row, 'created_at'),
    updatedAt: requireString(row, 'updated_at'),
    lastFiredAt: optionalString(row, 'last_fired_at'),
  };
}
