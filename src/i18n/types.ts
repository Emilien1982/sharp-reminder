import type { fr } from '@/i18n/locales/fr';

/**
 * Forme d'un jeu de traductions, déduite du français.
 *
 * `DeepMutable` retire le `as const` du fichier de référence : sans cela,
 * les autres langues devraient reproduire les littéraux exacts du français
 * plutôt que d'accepter n'importe quelle chaîne.
 */
type DeepMutable<T> = {
  -readonly [K in keyof T]: T[K] extends string ? string : DeepMutable<T[K]>;
};

export type TranslationResources = DeepMutable<typeof fr>;
