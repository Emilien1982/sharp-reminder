import type { Reminder } from '@/domain/reminders/types';
import type { TriggerCondition } from '@/domain/triggers/types';

/**
 * Un rappel a-t-il définitivement perdu toute chance de sonner ?
 *
 * Depuis qu'une condition de temps porte une borne haute, une règle peut
 * devenir **insatisfiable pour toujours** sans avoir jamais sonné : la plage
 * s'est refermée, personne n'est passé. Sans ce constat, la règle resterait
 * dans le miroir natif et son géorepérage resterait armé indéfiniment — le
 * contraire de l'extinction des capteurs gourmands que vise le §3 du brief.
 *
 * La lecture dépend du combinateur, et seulement de lui :
 * - en ET, une seule fenêtre refermée condamne l'expression entière ;
 * - en OU, il faut que toutes les conditions soient refermées, car n'importe
 *   quel autre signal — un lieu, un réseau — peut encore la satisfaire.
 *
 * Un rappel sans condition n'est pas « expiré » : il est incomplet, et
 * `buildRuleSnapshot` l'écarte déjà pour cette raison.
 */
export function isExpired(
  reminder: Pick<Reminder, 'combinator' | 'conditions'>,
  now: Date,
): boolean {
  if (reminder.conditions.length === 0) {
    return false;
  }

  const refermee = (condition: TriggerCondition): boolean =>
    condition.type === 'datetime' &&
    condition.until !== undefined &&
    Date.parse(condition.until) <= now.getTime();

  return reminder.combinator === 'AND'
    ? reminder.conditions.some(refermee)
    : reminder.conditions.every(refermee);
}
