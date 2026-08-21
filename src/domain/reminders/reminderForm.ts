import { newId } from '@/domain/id';
import type {
  AfterFireBehaviour,
  Reminder,
  ReminderDraft,
} from '@/domain/reminders/types';
import type {
  Combinator,
  DateTimeCondition,
  TriggerCondition,
} from '@/domain/triggers/types';
import { assertNeverCondition } from '@/domain/triggers/types';

/**
 * État et validation du formulaire de rappel.
 *
 * Volontairement pur : aucune dépendance à React ni au natif, comme
 * `src/data/reminderMapping.ts`. C'est ce qui rend la logique d'édition
 * testable par Jest sans monter le moindre composant.
 */

/** Ce que l'écran d'édition manipule. Superset éditable de `ReminderDraft`. */
export interface ReminderFormState {
  text: string;
  enabled: boolean;
  combinator: Combinator;
  conditions: TriggerCondition[];
  afterFire: AfterFireBehaviour;
}

export type ReminderFormErrorCode =
  /** Le texte est le corps de la notification : il ne peut pas être vide. */
  | 'textRequired'
  /**
   * `buildRuleSnapshot` écarte les rappels sans condition. Un tel rappel
   * serait enregistré en base mais jamais transmis au moteur : actif à
   * l'écran, muet en réalité.
   */
  | 'conditionRequired'
  /**
   * Une alarme programmée dans le passé n'est jamais délivrée. Sans ce
   * contrôle, le rappel paraîtrait armé sans l'être — le mode de défaillance
   * silencieux qui a coûté le plus cher en phase 2.
   */
  | 'dateTimeInPast';

export interface ReminderFormError {
  code: ReminderFormErrorCode;
  /** Renseigné quand l'erreur porte sur une condition précise. */
  conditionId?: string;
}

/** Décalage par défaut d'une nouvelle condition date/heure. */
const DEFAULT_OFFSET_MS = 60 * 60 * 1000;

export function emptyForm(): ReminderFormState {
  return {
    text: '',
    enabled: true,
    // Sans effet tant qu'il n'y a qu'une condition, mais OU est le choix le
    // moins surprenant quand une seconde s'ajoute : le rappel se déclenche dès
    // qu'un signal survient, plutôt que de ne jamais sonner.
    combinator: 'OR',
    conditions: [],
    afterFire: 'delete',
  };
}

export function formFromReminder(reminder: Reminder): ReminderFormState {
  return {
    text: reminder.text,
    enabled: reminder.enabled,
    combinator: reminder.combinator,
    conditions: reminder.conditions.map(condition => ({ ...condition })),
    afterFire: reminder.afterFire,
  };
}

export function formToDraft(form: ReminderFormState): ReminderDraft {
  return {
    text: form.text.trim(),
    enabled: form.enabled,
    combinator: form.combinator,
    conditions: form.conditions,
    afterFire: form.afterFire,
  };
}

/**
 * Nouvelle condition date/heure, par défaut une heure plus tard.
 *
 * Seul type constructible en phase 3. Les phases 4 à 6 ajouteront une fabrique
 * par type : Wi-Fi et Bluetooth exigent une valeur que seul le natif peut
 * fournir (SSID visible, appareil appairé), il n'y a donc pas de valeur par
 * défaut raisonnable à inventer ici.
 */
export function createDateTimeCondition(now: Date): DateTimeCondition {
  const at = new Date(now.getTime() + DEFAULT_OFFSET_MS);
  at.setSeconds(0, 0);

  return { id: newId(), type: 'datetime', at: at.toISOString() };
}

export function addCondition(
  form: ReminderFormState,
  condition: TriggerCondition,
): ReminderFormState {
  return { ...form, conditions: [...form.conditions, condition] };
}

/** Remplace une condition par sa version modifiée, repérée par son `id`. */
export function replaceCondition(
  form: ReminderFormState,
  condition: TriggerCondition,
): ReminderFormState {
  return {
    ...form,
    conditions: form.conditions.map(current =>
      current.id === condition.id ? condition : current,
    ),
  };
}

export function removeCondition(
  form: ReminderFormState,
  conditionId: string,
): ReminderFormState {
  return {
    ...form,
    conditions: form.conditions.filter(
      condition => condition.id !== conditionId,
    ),
  };
}

/**
 * La condition existait-elle déjà, à l'identique, dans le rappel enregistré ?
 *
 * Sert à ne pas reprocher à l'utilisateur une date qu'il n'a pas saisie. Un
 * rappel `afterFire: 'keep'` déjà déclenché porte une date passée en
 * permanence : sans cette distinction, il deviendrait impossible d'en corriger
 * le texte sans être forcé de déplacer aussi sa date.
 */
function estInchangee(
  original: ReminderFormState | undefined,
  condition: DateTimeCondition,
): boolean {
  return (
    original?.conditions.some(
      previous =>
        previous.id === condition.id &&
        previous.type === 'datetime' &&
        previous.at === condition.at,
    ) ?? false
  );
}

/**
 * Erreurs empêchant l'enregistrement. Liste vide = formulaire valide.
 *
 * `now` est un paramètre plutôt qu'un `new Date()` interne : un test qui
 * dépend de l'horloge réelle finit toujours par échouer un jour donné.
 *
 * `original` est le rappel tel qu'il est en base, absent lors d'une création.
 */
export function validateForm(
  form: ReminderFormState,
  now: Date,
  original?: ReminderFormState,
): ReminderFormError[] {
  const errors: ReminderFormError[] = [];

  if (form.text.trim().length === 0) {
    errors.push({ code: 'textRequired' });
  }

  if (form.conditions.length === 0) {
    errors.push({ code: 'conditionRequired' });
  }

  for (const condition of form.conditions) {
    switch (condition.type) {
      case 'datetime':
        if (
          new Date(condition.at).getTime() <= now.getTime() &&
          !estInchangee(original, condition)
        ) {
          errors.push({ code: 'dateTimeInPast', conditionId: condition.id });
        }
        break;

      // Rien à valider tant que ces types ne sont pas constructibles depuis
      // l'interface. Le `default` ci-dessous garantit qu'aucun nouveau type ne
      // pourra être ajouté sans qu'on passe ici.
      case 'wifi':
      case 'bluetooth':
      case 'location':
        break;

      default:
        assertNeverCondition(condition);
    }
  }

  return errors;
}
