import type { Reminder, ReminderPatch } from '@/domain/reminders/types';

/**
 * Un rappel doit-il être réarmé ?
 *
 * Miroir JavaScript de `Baseline.needsReset` côté natif : ce sont les deux
 * moitiés d'une même règle. Le natif y remet sa ligne de base ; ici on efface
 * `lastFiredAt`, la marque qui empêche un rappel conservé de sonner à nouveau.
 *
 * Sans cette symétrie, un rappel épuisé que l'utilisateur reprogramme resterait
 * **définitivement muet** : le moteur natif le réarmerait, mais il ne lui
 * serait plus jamais envoyé.
 *
 * Seuls les champs qui influent sur la satisfaction sont comparés. Corriger une
 * faute de frappe dans le texte, ou changer le comportement après
 * déclenchement, ne doit pas remettre en jeu un rappel déjà honoré.
 */
export function needsRearm(previous: Reminder, patch: ReminderPatch): boolean {
  if (
    patch.combinator !== undefined &&
    patch.combinator !== previous.combinator
  ) {
    return true;
  }

  if (patch.conditions === undefined) {
    return false;
  }

  // Comparaison sur la forme sérialisée : les conditions sont des unions
  // discriminées aux champs variables, et c'est exactement sous cette forme
  // qu'elles traversent la frontière native.
  return (
    JSON.stringify(patch.conditions) !== JSON.stringify(previous.conditions)
  );
}
