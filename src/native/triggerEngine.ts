import NativeTriggerEngine from '@/native/NativeTriggerEngine';
import type {
  FiredEvent,
  RuleSnapshot,
  TriggerEngineDiagnostics,
} from '@/domain/triggers/snapshot';
import type { TriggerCost, TriggerType } from '@/domain/triggers/types';

/**
 * Enveloppe typée autour du module natif.
 *
 * Le module natif échange du JSON brut (voir la justification dans
 * `NativeTriggerEngine.ts`). Cette couche est le seul endroit du projet où ce
 * JSON est analysé : le reste de l'application ne manipule que des objets
 * typés.
 */

export async function syncRules(snapshot: RuleSnapshot[]): Promise<void> {
  await NativeTriggerEngine.syncRules(JSON.stringify(snapshot));
}

export async function getTriggerCosts(): Promise<
  Partial<Record<TriggerType, TriggerCost>>
> {
  const raw = await NativeTriggerEngine.getTriggerCosts();
  return JSON.parse(raw) as Partial<Record<TriggerType, TriggerCost>>;
}

/**
 * Récupère et vide la file des déclenchements survenus pendant que
 * l'application ne tournait pas.
 */
export async function drainFiredEvents(): Promise<FiredEvent[]> {
  const raw = await NativeTriggerEngine.drainFiredEvents();
  return JSON.parse(raw) as FiredEvent[];
}

export async function getDiagnostics(): Promise<TriggerEngineDiagnostics> {
  const raw = await NativeTriggerEngine.getDiagnostics();
  return JSON.parse(raw) as TriggerEngineDiagnostics;
}
