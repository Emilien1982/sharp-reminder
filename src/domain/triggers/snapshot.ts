import type { Reminder } from '@/domain/reminders/types';
import { isExpired } from '@/domain/triggers/expiry';
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
  /**
   * L'utilisateur a-t-il autorisé les notifications ?
   *
   * Sans cette information, un refus rend l'application totalement muette
   * sans le moindre indice : les rappels se déclenchent, le moteur fonctionne,
   * et rien ne s'affiche. C'est le mode de défaillance le plus trompeur de
   * cette application, il doit être visible à l'écran.
   */
  notificationsAuthorized: boolean;
}

/**
 * Construit le snapshot à pousser au natif.
 *
 * Seuls les rappels **actifs, pourvus d'au moins une condition, et encore
 * capables de sonner** y figurent. C'est ce filtrage qui éteint automatiquement
 * les déclencheurs gourmands (§3 du brief) : un rappel qui en disparaît laisse
 * le registre natif constater que plus personne n'utilise le type concerné, et
 * arrêter l'écoute.
 *
 * Le natif ne reçoit plus le comportement post-déclenchement : il retire de son
 * miroir **toute** règle qui vient de sonner, et c'est ici qu'on décide si elle
 * y revient. Sans cette division, une règle conservée resonnait à chaque
 * transition tant que l'application n'avait pas redémarré.
 */
export function buildRuleSnapshot(
  reminders: readonly Reminder[],
  now: Date = new Date(),
): RuleSnapshot[] {
  return reminders
    .filter(
      reminder =>
        reminder.enabled &&
        reminder.conditions.length > 0 &&
        // Un rappel conservé qui a déjà sonné n'est plus transmis : il ne
        // sonnera donc plus. Le modifier le réarme, voir `needsRearm`.
        !(reminder.afterFire === 'keep' && reminder.lastFiredAt !== null) &&
        // Une plage refermée sans que rien ne se soit produit rend la règle
        // insatisfiable à jamais : la garder maintiendrait son géorepérage
        // armé pour rien.
        !isExpired(reminder, now),
    )
    .map(reminder => ({
      reminderId: reminder.id,
      notificationBody: reminder.text,
      combinator: reminder.combinator,
      conditions: reminder.conditions,
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
