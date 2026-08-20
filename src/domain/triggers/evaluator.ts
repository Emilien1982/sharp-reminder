import type { SignalSnapshot } from '@/domain/triggers/signal';
import {
  assertNeverCondition,
  type Combinator,
  type TriggerCondition,
} from '@/domain/triggers/types';

/**
 * Évaluation des règles de déclenchement.
 *
 * ⚠️ Cette logique existe en trois exemplaires — ici, en Kotlin et en Swift.
 * Toute règle ajoutée doit l'être dans `shared/fixtures/evaluator-cases.json`,
 * consommé par Jest, JUnit et XCTest : c'est le seul garde-fou contre une
 * divergence silencieuse entre plateformes.
 * Voir docs/adr/0002-moteur-de-triggers-natif.md.
 */

/**
 * Une condition est-elle satisfaite dans l'état courant ?
 *
 * Chaque condition est un prédicat sur l'état du monde, jamais un événement.
 * Un `switch` exhaustif garantit qu'ajouter un type de déclencheur casse la
 * compilation ici tant qu'il n'est pas traité.
 */
export function isConditionSatisfied(
  condition: TriggerCondition,
  signal: SignalSnapshot,
): boolean {
  switch (condition.type) {
    case 'datetime':
      // Comparaison sur l'instant absolu : `at` porte son décalage horaire,
      // une comparaison de chaînes serait fausse entre deux fuseaux.
      return Date.parse(signal.now) >= Date.parse(condition.at);

    case 'wifi':
      return condition.direction === 'connect'
        ? signal.wifiSsid === condition.ssid
        : signal.wifiSsid !== condition.ssid;

    case 'bluetooth': {
      const connected = signal.connectedBluetoothDeviceIds.includes(
        condition.deviceId,
      );
      return condition.direction === 'connect' ? connected : !connected;
    }

    case 'location': {
      const inside = signal.insideLocationConditionIds.includes(condition.id);
      return condition.direction === 'enter' ? inside : !inside;
    }

    default:
      return assertNeverCondition(condition);
  }
}

/**
 * L'ensemble des conditions d'un rappel est-il satisfait ?
 *
 * Un rappel sans condition ne se déclenche jamais : sans cette règle, un `AND`
 * sur liste vide renverrait `true` — c'est le comportement mathématique
 * correct, mais il ferait sonner un rappel vide à chaque signal reçu.
 */
export function areConditionsSatisfied(
  conditions: readonly TriggerCondition[],
  combinator: Combinator,
  signal: SignalSnapshot,
): boolean {
  if (conditions.length === 0) {
    return false;
  }

  return combinator === 'AND'
    ? conditions.every(condition => isConditionSatisfied(condition, signal))
    : conditions.some(condition => isConditionSatisfied(condition, signal));
}

/**
 * Faut-il déclencher le rappel ?
 *
 * Le déclenchement se produit sur la transition faux → vrai, jamais sur un
 * état durablement vrai — sans quoi un rappel « quand je suis à la maison »
 * sonnerait à chaque signal reçu tant qu'on y reste.
 *
 * `previouslySatisfied` est renseigné au moment où le rappel est armé, avec
 * l'état du monde à cet instant. C'est indispensable pour les conditions
 * négatives : « préviens-moi quand je quitte la maison » est déjà vrai si l'on
 * est dehors, et se déclencherait immédiatement à la création du rappel.
 */
export function shouldFire(
  previouslySatisfied: boolean,
  currentlySatisfied: boolean,
): boolean {
  return !previouslySatisfied && currentlySatisfied;
}
