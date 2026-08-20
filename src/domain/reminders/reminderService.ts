import { getReminderRepository } from '@/data/reminderRepository';
import type {
  Reminder,
  ReminderDraft,
  ReminderPatch,
} from '@/domain/reminders/types';
import { buildRuleSnapshot } from '@/domain/triggers/snapshot';
import { drainFiredEvents, syncRules } from '@/native/triggerEngine';

/**
 * Orchestration entre la base et le moteur natif.
 *
 * Règle unique mais absolue : **toute écriture en base est immédiatement
 * suivie d'une resynchronisation du moteur natif.** Un rappel enregistré mais
 * non synchronisé ne sonnerait jamais, sans qu'aucune erreur ne le signale —
 * c'est le mode de défaillance le plus dangereux de cette application.
 *
 * Passer par ce service plutôt que par le dépôt directement est donc la règle
 * pour toute mutation. Le dépôt reste accessible en lecture seule.
 */

async function pushSnapshot(): Promise<void> {
  const repository = await getReminderRepository();
  const enabled = await repository.listEnabled();
  await syncRules(buildRuleSnapshot(enabled));
}

export async function createReminder(draft: ReminderDraft): Promise<Reminder> {
  const repository = await getReminderRepository();
  const created = await repository.create(draft);
  await pushSnapshot();
  return created;
}

export async function updateReminder(
  id: string,
  patch: ReminderPatch,
): Promise<Reminder> {
  const repository = await getReminderRepository();
  const updated = await repository.update(id, patch);
  await pushSnapshot();
  return updated;
}

export async function duplicateReminder(id: string): Promise<Reminder> {
  const repository = await getReminderRepository();
  const copy = await repository.duplicate(id);
  await pushSnapshot();
  return copy;
}

export async function deleteReminder(id: string): Promise<void> {
  const repository = await getReminderRepository();
  await repository.remove(id);
  await pushSnapshot();
}

/**
 * Applique les déclenchements survenus hors ligne.
 *
 * À appeler au démarrage de l'application. Le natif a déjà notifié
 * l'utilisateur et, le cas échéant, retiré la règle de son propre miroir ; il
 * reste à répercuter le comportement post-déclenchement dans la base.
 */
export async function applyPendingFiredEvents(): Promise<number> {
  const events = await drainFiredEvents();
  if (events.length === 0) {
    return 0;
  }

  const repository = await getReminderRepository();

  for (const event of events) {
    const reminder = await repository.get(event.reminderId);
    if (!reminder) {
      continue;
    }

    if (reminder.afterFire === 'delete') {
      await repository.remove(event.reminderId);
    } else {
      await repository.markFired(event.reminderId, event.firedAt);
    }
  }

  // Le miroir natif est reconstruit après coup : il doit refléter les
  // suppressions que l'on vient d'appliquer.
  await pushSnapshot();
  return events.length;
}

/**
 * Resynchronise le moteur natif depuis la base.
 *
 * Appelée au démarrage : elle rattrape toute désynchronisation due à un crash
 * survenu entre une écriture en base et sa synchronisation.
 */
export async function resyncTriggerEngine(): Promise<void> {
  await pushSnapshot();
}
