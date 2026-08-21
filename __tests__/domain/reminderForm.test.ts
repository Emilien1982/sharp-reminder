import {
  addCondition,
  createDateTimeCondition,
  emptyForm,
  formFromReminder,
  formToDraft,
  removeCondition,
  replaceCondition,
  validateForm,
  type ReminderFormState,
} from '@/domain/reminders/reminderForm';
import type { Reminder } from '@/domain/reminders/types';

const NOW = new Date('2026-08-21T10:00:00.000Z');

const reminder: Reminder = {
  id: 'r-1',
  text: 'Sortir les poubelles',
  enabled: true,
  combinator: 'AND',
  conditions: [
    { id: 'c-1', type: 'datetime', at: '2026-08-22T19:00:00.000Z' },
    { id: 'c-2', type: 'wifi', ssid: 'Maison', direction: 'connect' },
  ],
  afterFire: 'keep',
  createdAt: '2026-08-19T10:00:00.000Z',
  updatedAt: '2026-08-19T10:00:00.000Z',
  lastFiredAt: null,
};

/** Formulaire valide minimal, base des cas d'erreur ci-dessous. */
function validForm(): ReminderFormState {
  return {
    ...emptyForm(),
    text: 'Arroser les plantes',
    conditions: [
      { id: 'c-1', type: 'datetime', at: '2026-08-21T11:00:00.000Z' },
    ],
  };
}

describe('formFromReminder / formToDraft', () => {
  it('conserve les champs éditables lors d’un aller-retour', () => {
    const draft = formToDraft(formFromReminder(reminder));

    expect(draft).toEqual({
      text: reminder.text,
      enabled: reminder.enabled,
      combinator: reminder.combinator,
      conditions: reminder.conditions,
      afterFire: reminder.afterFire,
    });
  });

  it('copie les conditions au lieu de les partager', () => {
    const [fromForm] = formFromReminder(reminder).conditions;
    const [fromReminder] = reminder.conditions;

    // Même contenu, mais deux objets distincts : sans cela, modifier une
    // condition dans l'éditeur atteindrait le rappel affiché dans la liste, et
    // annuler l'édition laisserait un état corrompu.
    expect(fromForm).toEqual(fromReminder);
    expect(fromForm).not.toBe(fromReminder);
  });

  it('retire les espaces autour du texte', () => {
    const form = { ...validForm(), text: '  Arroser les plantes  ' };

    expect(formToDraft(form).text).toBe('Arroser les plantes');
  });
});

describe('createDateTimeCondition', () => {
  it('propose une heure plus tard, secondes remises à zéro', () => {
    const condition = createDateTimeCondition(
      new Date('2026-08-21T10:07:42.500Z'),
    );

    expect(condition.type).toBe('datetime');
    expect(condition.at).toBe('2026-08-21T11:07:00.000Z');
  });

  it('donne un identifiant distinct à chaque condition', () => {
    const first = createDateTimeCondition(NOW);
    const second = createDateTimeCondition(NOW);

    // Deux conditions partageant un identifiant rendraient le moteur natif
    // incapable de distinguer leurs déclenchements.
    expect(first.id).not.toBe(second.id);
  });
});

describe('addCondition / replaceCondition / removeCondition', () => {
  it('ajoute sans muter le formulaire reçu', () => {
    const form = emptyForm();
    const next = addCondition(form, createDateTimeCondition(NOW));

    expect(next.conditions).toHaveLength(1);
    expect(form.conditions).toHaveLength(0);
  });

  it('remplace la condition portant le même identifiant', () => {
    const next = replaceCondition(formFromReminder(reminder), {
      id: 'c-1',
      type: 'datetime',
      at: '2026-08-25T08:00:00.000Z',
    });

    expect(next.conditions[0]).toEqual({
      id: 'c-1',
      type: 'datetime',
      at: '2026-08-25T08:00:00.000Z',
    });
    expect(next.conditions[1]).toEqual(reminder.conditions[1]);
  });

  it('retire la condition désignée et laisse les autres', () => {
    const next = removeCondition(formFromReminder(reminder), 'c-1');

    expect(next.conditions).toHaveLength(1);
    expect(next.conditions[0]?.id).toBe('c-2');
  });
});

describe('validateForm', () => {
  it('n’a rien à signaler sur un formulaire valide', () => {
    expect(validateForm(validForm(), NOW)).toEqual([]);
  });

  it('refuse un texte vide ou réduit à des espaces', () => {
    expect(validateForm({ ...validForm(), text: '' }, NOW)).toContainEqual({
      code: 'textRequired',
    });
    expect(validateForm({ ...validForm(), text: '   ' }, NOW)).toContainEqual({
      code: 'textRequired',
    });
  });

  it('refuse un rappel sans condition', () => {
    // Sans condition, `buildRuleSnapshot` l'écarte : il serait enregistré mais
    // jamais transmis au moteur, donc définitivement muet.
    expect(
      validateForm({ ...validForm(), conditions: [] }, NOW),
    ).toContainEqual({ code: 'conditionRequired' });
  });

  it('refuse une date passée, en désignant la condition fautive', () => {
    const form: ReminderFormState = {
      ...validForm(),
      conditions: [
        { id: 'c-passée', type: 'datetime', at: '2026-08-21T09:59:59.000Z' },
      ],
    };

    expect(validateForm(form, NOW)).toEqual([
      { code: 'dateTimeInPast', conditionId: 'c-passée' },
    ]);
  });

  it('refuse une date égale à l’instant présent', () => {
    // Le cas limite compte : une alarme programmée à l'instant même est déjà
    // dépassée quand le natif la reçoit.
    const form: ReminderFormState = {
      ...validForm(),
      conditions: [{ id: 'c-1', type: 'datetime', at: NOW.toISOString() }],
    };

    expect(validateForm(form, NOW)).toContainEqual({
      code: 'dateTimeInPast',
      conditionId: 'c-1',
    });
  });

  it('accepte une date future d’une seule seconde', () => {
    const form: ReminderFormState = {
      ...validForm(),
      conditions: [
        { id: 'c-1', type: 'datetime', at: '2026-08-21T10:00:01.000Z' },
      ],
    };

    expect(validateForm(form, NOW)).toEqual([]);
  });

  it('ne valide pas encore les types non constructibles', () => {
    const form: ReminderFormState = {
      ...validForm(),
      conditions: [{ id: 'c-2', type: 'wifi', ssid: '', direction: 'connect' }],
    };

    expect(validateForm(form, NOW)).toEqual([]);
  });

  describe('date passée déjà enregistrée', () => {
    const passee: ReminderFormState = {
      ...validForm(),
      conditions: [
        { id: 'c-1', type: 'datetime', at: '2026-08-20T18:41:00.000Z' },
      ],
    };

    it('accepte une date passée que l’utilisateur n’a pas touchée', () => {
      // Cas courant : un rappel `afterFire: 'keep'` déjà déclenché. Refuser
      // l'enregistrement rendrait impossible la correction de son texte.
      expect(validateForm(passee, NOW, passee)).toEqual([]);
    });

    it('refuse une date passée que l’utilisateur vient de choisir', () => {
      const modifiee: ReminderFormState = {
        ...passee,
        conditions: [
          { id: 'c-1', type: 'datetime', at: '2026-08-19T08:00:00.000Z' },
        ],
      };

      expect(validateForm(modifiee, NOW, passee)).toContainEqual({
        code: 'dateTimeInPast',
        conditionId: 'c-1',
      });
    });

    it('refuse une condition passée ajoutée à un rappel existant', () => {
      const augmentee: ReminderFormState = {
        ...passee,
        conditions: [
          ...passee.conditions,
          { id: 'c-neuve', type: 'datetime', at: '2026-08-19T08:00:00.000Z' },
        ],
      };

      expect(validateForm(augmentee, NOW, passee)).toEqual([
        { code: 'dateTimeInPast', conditionId: 'c-neuve' },
      ]);
    });

    it('refuse toujours une date passée en création', () => {
      expect(validateForm(passee, NOW)).toContainEqual({
        code: 'dateTimeInPast',
        conditionId: 'c-1',
      });
    });
  });

  it('cumule les erreurs indépendantes', () => {
    expect(validateForm({ ...emptyForm(), text: '' }, NOW)).toEqual([
      { code: 'textRequired' },
      { code: 'conditionRequired' },
    ]);
  });
});
