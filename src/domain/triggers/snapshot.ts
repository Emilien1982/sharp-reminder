import type { Reminder } from '@/domain/reminders/types';
import type { TriggerCondition, TriggerType } from '@/domain/triggers/types';

/**
 * Format transmis au moteur natif.
 *
 * Volontairement plus pauvre que `Reminder` : le natif n'a besoin ni des dates
 * de création, ni du texte d'édition, seulement de quoi évaluer et notifier.
 * Réduire la surface partagée limite le nombre de changements qui obligeront à
 * toucher au Kotlin et au Swift.
 */
export interface RuleSnapshot {
  reminderId: string;
  /** Texte affiché dans la notification. */
  notificationBody: string;
  combinator: 'AND' | 'OR';
  conditions: TriggerCondition[];
  /** Le natif supprime-t-il la règle après déclenchement ? */
  deleteAfterFire: boolean;
}

/** Déclenchement remonté par le natif au prochain lancement. */
export interface FiredEvent {
  reminderId: string;
  /** Instant du déclenchement, ISO 8601. */
  firedAt: string;
  /** Identifiant de la condition qui a fait basculer l'expression. */
  triggeringConditionId: string;
}

/** État interne du moteur, pour l'écran de diagnostic. */
export interface TriggerEngineDiagnostics {
  /** Types dont l'écoute est actuellement active. */
  activeTriggerTypes: TriggerType[];
  ruleCount: number;
  /** Dernier signal reçu par type, ISO 8601. */
  lastSignalAt: Partial<Record<TriggerType, string>>;
}

/**
 * Construit le snapshot à pousser au natif.
 *
 * Seuls les rappels **actifs et pourvus d'au moins une condition** y figurent.
 * C'est ce filtrage qui éteint automatiquement les déclencheurs gourmands
 * (§3 du brief) : un rappel désactivé disparaît du snapshot, le registre natif
 * constate que plus personne n'utilise le type concerné et arrête l'écoute.
 */
export function buildRuleSnapshot(
  reminders: readonly Reminder[],
): RuleSnapshot[] {
  return reminders
    .filter(reminder => reminder.enabled && reminder.conditions.length > 0)
    .map(reminder => ({
      reminderId: reminder.id,
      notificationBody: reminder.text,
      combinator: reminder.combinator,
      conditions: reminder.conditions,
      deleteAfterFire: reminder.afterFire === 'delete',
    }));
}

/** Types de déclencheurs effectivement utilisés par un snapshot. */
export function usedTriggerTypes(
  snapshot: readonly RuleSnapshot[],
): TriggerType[] {
  const types = new Set<TriggerType>();
  for (const rule of snapshot) {
    for (const condition of rule.conditions) {
      types.add(condition.type);
    }
  }
  return [...types];
}
