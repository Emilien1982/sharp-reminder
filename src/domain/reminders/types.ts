import type { Combinator, TriggerCondition } from '@/domain/triggers/types';

/**
 * Comportement d'un rappel après son déclenchement (§2 du brief).
 * Configurable par rappel, pas globalement.
 */
export type AfterFireBehaviour =
  /** Rappel ponctuel : supprimé automatiquement une fois déclenché. */
  | 'delete'
  /** Rappel récurrent : conservé et réarmé. */
  | 'keep';

/**
 * Un rappel : un texte, et les conditions qui le font apparaître.
 *
 * V1 : contenu textuel uniquement — pas de checklist ni de pièce jointe.
 * L'organisation par tags ou dossiers n'est pas implémentée, mais le schéma
 * SQLite porte un numéro de version permettant de l'ajouter proprement
 * plus tard (voir src/data/schema.ts).
 */
export interface Reminder {
  id: string;
  /** Texte libre affiché dans la notification. */
  text: string;
  /**
   * Un rappel désactivé est conservé en base mais retiré du snapshot envoyé au
   * natif : ses listeners s'éteignent donc automatiquement (§3 du brief).
   */
  enabled: boolean;
  /** Combinaison entre les conditions. Sans effet si `conditions.length <= 1`. */
  combinator: Combinator;
  conditions: TriggerCondition[];
  afterFire: AfterFireBehaviour;
  /** Dates ISO 8601. */
  createdAt: string;
  updatedAt: string;
  /** `null` tant que le rappel ne s'est jamais déclenché. */
  lastFiredAt: string | null;
}

/** Champs fournis à la création ; le reste est calculé par le dépôt. */
export type ReminderDraft = Omit<
  Reminder,
  'id' | 'createdAt' | 'updatedAt' | 'lastFiredAt'
>;

/** Champs modifiables lors d'une édition. */
export type ReminderPatch = Partial<ReminderDraft>;
