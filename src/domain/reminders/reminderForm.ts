import { newId } from '@/domain/id';
import type {
  AfterFireBehaviour,
  Reminder,
  ReminderDraft,
} from '@/domain/reminders/types';
import type {
  Combinator,
  DateTimeCondition,
  LocationCondition,
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
  | 'dateTimeInPast'
  /**
   * En deçà d'une centaine de mètres, le géorepérage des deux systèmes devient
   * peu fiable : franchissements manqués ou répétés selon la qualité du signal.
   * L'utilisateur attribuerait ces ratés à l'application.
   */
  | 'radiusTooSmall'
  /**
   * Le lieu n'a jamais été positionné. Voir `UNPLACED` ci-dessous.
   */
  | 'locationNotPlaced'
  /** Fenêtre inversée : elle ne s'ouvrirait jamais. */
  | 'windowInverted'
  /**
   * Fenêtre déjà refermée. Même famille de défaut que `dateTimeInPast` : le
   * rappel paraîtrait armé et ne sonnerait jamais.
   */
  | 'windowClosed'
  /**
   * Fenêtre déjà ouverte à l'enregistrement, sans autre signal pour faire
   * basculer l'expression.
   *
   * Troisième membre de la même famille, et le plus retors : la fenêtre est
   * bien à venir *par sa fin*, mais elle ne peut plus **s'ouvrir**. Or c'est
   * l'ouverture qui déclenche. Ni `AlarmManager` ni
   * `UNCalendarNotificationTrigger` n'acceptent une échéance passée, et
   * `syncRules` pose la ligne de base à « déjà satisfaite » : plus aucune
   * transition ne surviendra. Le rappel s'afficherait actif et resterait muet.
   */
  | 'windowAlreadyOpen';

export interface ReminderFormError {
  code: ReminderFormErrorCode;
  /** Renseigné quand l'erreur porte sur une condition précise. */
  conditionId?: string;
}

/** Décalage par défaut d'une nouvelle condition date/heure. */
const DEFAULT_OFFSET_MS = 60 * 60 * 1000;

/** Rayon proposé par défaut, en mètres. */
export const DEFAULT_RADIUS_METERS = 150;

/** En deçà, le géorepérage n'est pas fiable. Voir `radiusTooSmall`. */
export const MIN_RADIUS_METERS = 100;

/**
 * Coordonnées d'un lieu pas encore positionné.
 *
 * Une condition de lieu doit exister dans le formulaire avant que la carte
 * n'ait pu rapporter une position — l'épingle se place au premier point GPS,
 * ou par un appui de l'utilisateur. `TriggerCondition` n'a pas de champ
 * « positionné », et lui en ajouter un obligerait à répercuter le changement
 * en Kotlin et en Swift pour un état purement transitoire de l'interface.
 *
 * D'où cette sentinelle explicite, refusée à l'enregistrement. Le point (0, 0)
 * se trouve dans le golfe de Guinée : aucun rappel légitime ne s'y trouve, et
 * le cas est couvert par un test.
 */
const UNPLACED = { latitude: 0, longitude: 0 } as const;

export function emptyForm(): ReminderFormState {
  return {
    text: '',
    enabled: true,
    // Sans effet tant qu'il n'y a qu'une condition, mais OU est le choix le
    // moins surprenant quand une seconde s'ajoute : le rappel se déclenche dès
    // qu'un signal survient, plutôt que de ne jamais sonner.
    combinator: 'OR',
    conditions: [],
    // Conservé par défaut : un rappel de lieu ou de créneau se répète
    // naturellement d'un jour à l'autre, et supprimer d'office obligerait à le
    // recréer. La suppression reste un choix explicite, rappel par rappel.
    afterFire: 'keep',
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

/**
 * Nouvelle condition de lieu, non encore positionnée.
 *
 * L'interface place l'épingle dès qu'une position est connue ; tant que ce
 * n'est pas fait, `validateForm` refuse l'enregistrement plutôt que d'écrire
 * un rappel qui ne se déclencherait jamais.
 */
export function createLocationCondition(): LocationCondition {
  return {
    id: newId(),
    type: 'location',
    latitude: UNPLACED.latitude,
    longitude: UNPLACED.longitude,
    radiusMeters: DEFAULT_RADIUS_METERS,
    // « En arrivant » est le cas dominant et le moins surprenant : une
    // condition de sortie est déjà vraie quand on n'est pas sur place.
    direction: 'enter',
  };
}

export function isPlaced(condition: LocationCondition): boolean {
  return (
    condition.latitude !== UNPLACED.latitude ||
    condition.longitude !== UNPLACED.longitude
  );
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
        previous.at === condition.at &&
        // ⚠️ `until` compte autant que `at`. L'oublier rendait une fenêtre
        // « non touchée » alors qu'on venait d'en déplacer la fin : la règle
        // du créneau déjà refermé était sautée, et un rappel mort
        // s'enregistrait sans le moindre avertissement.
        previous.until === condition.until,
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

  // Une fenêtre déjà ouverte ne peut plus faire basculer une expression que le
  // moteur juge donc satisfaite dès l'enregistrement. Une seule situation la
  // rachète : en ET, un signal d'une autre nature reste capable de basculer
  // plus tard — « je suis encore au magasin, et la plage a commencé ». En OU,
  // la fenêtre suffit déjà à satisfaire la règle, donc rien ne basculera.
  const autreSignalPeutBasculer =
    form.combinator === 'AND' &&
    form.conditions.some(condition => condition.type !== 'datetime');

  for (const condition of form.conditions) {
    switch (condition.type) {
      case 'datetime': {
        const inchangee = estInchangee(original, condition);
        const debut = new Date(condition.at).getTime();
        const fin =
          condition.until === undefined
            ? undefined
            : new Date(condition.until).getTime();

        if (fin !== undefined && fin <= debut) {
          // Signalé même sur une condition inchangée : une fenêtre inversée
          // n'est jamais légitime, elle ne peut provenir que d'une erreur.
          errors.push({ code: 'windowInverted', conditionId: condition.id });
        } else if (!inchangee) {
          // Les trois règles suivantes ne s'appliquent qu'à ce que
          // l'utilisateur vient de choisir : une condition enregistrée qu'il
          // n'a pas touchée ne doit jamais rendre son rappel impossible à
          // rouvrir — le piège de la phase 4.
          if (fin !== undefined && fin <= now.getTime()) {
            errors.push({ code: 'windowClosed', conditionId: condition.id });
          } else if (debut <= now.getTime()) {
            if (fin === undefined) {
              errors.push({
                code: 'dateTimeInPast',
                conditionId: condition.id,
              });
            } else if (!autreSignalPeutBasculer) {
              errors.push({
                code: 'windowAlreadyOpen',
                conditionId: condition.id,
              });
            }
          }
        }
        break;
      }

      case 'location':
        if (!isPlaced(condition)) {
          errors.push({
            code: 'locationNotPlaced',
            conditionId: condition.id,
          });
        } else if (condition.radiusMeters < MIN_RADIUS_METERS) {
          errors.push({ code: 'radiusTooSmall', conditionId: condition.id });
        }
        break;

      // Rien à valider tant que ces types ne sont pas constructibles depuis
      // l'interface. Le `default` ci-dessous garantit qu'aucun nouveau type ne
      // pourra être ajouté sans qu'on passe ici.
      case 'wifi':
      case 'bluetooth':
        break;

      default:
        assertNeverCondition(condition);
    }
  }

  return errors;
}
