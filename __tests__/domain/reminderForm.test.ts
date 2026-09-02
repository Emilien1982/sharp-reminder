import {
  addCondition,
  createDateTimeCondition,
  createLocationCondition,
  isPlaced,
  MIN_RADIUS_METERS,
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

describe('emptyForm', () => {
  it('conserve le rappel après déclenchement', () => {
    // Choix explicite de l'utilisateur : un rappel de lieu ou de créneau se
    // répète d'un jour à l'autre, le supprimer d'office obligerait à le
    // recréer à chaque fois.
    expect(emptyForm().afterFire).toBe('keep');
  });

  it('naît actif, sans condition, en OU', () => {
    const form = emptyForm();

    expect(form.enabled).toBe(true);
    expect(form.conditions).toEqual([]);
    expect(form.combinator).toBe('OR');
  });
});

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

describe('createLocationCondition', () => {
  it('naît non positionnée, avec un rayon par défaut', () => {
    const condition = createLocationCondition();

    expect(condition.type).toBe('location');
    expect(condition.direction).toBe('enter');
    expect(condition.radiusMeters).toBe(150);
    expect(isPlaced(condition)).toBe(false);
  });

  it('est considérée positionnée dès qu’une coordonnée bouge', () => {
    const condition = createLocationCondition();

    expect(isPlaced({ ...condition, latitude: 48.85 })).toBe(true);
    expect(isPlaced({ ...condition, longitude: 2.35 })).toBe(true);
  });

  it('donne un identifiant distinct à chaque lieu', () => {
    expect(createLocationCondition().id).not.toBe(createLocationCondition().id);
  });
});

describe('validateForm — fenêtre horaire', () => {
  function avecFenetre(at: string, until?: string): ReminderFormState {
    return {
      ...validForm(),
      conditions: [{ id: 'c-1', type: 'datetime', at, until }],
    };
  }

  it('accepte une fenêtre à venir', () => {
    expect(
      validateForm(
        avecFenetre('2026-08-21T14:00:00.000Z', '2026-08-21T18:00:00.000Z'),
        NOW,
      ),
    ).toEqual([]);
  });

  it('refuse une fenêtre seule dont le début est déjà passé', () => {
    // La fin est à venir, mais c'est l'OUVERTURE qui déclenche, et elle est
    // révolue : aucune alarme ne se programme dans le passé, et `syncRules`
    // pose la ligne de base à « déjà satisfaite ». Le rappel s'afficherait
    // actif et resterait muet — le défaut que ce contrôle existe pour éviter.
    expect(
      validateForm(
        avecFenetre('2026-08-21T08:00:00.000Z', '2026-08-21T18:00:00.000Z'),
        NOW,
      ),
    ).toEqual([{ code: 'windowAlreadyOpen', conditionId: 'c-1' }]);
  });

  it('accepte une fenêtre déjà ouverte si un lieu peut encore basculer', () => {
    // « Je passe devant le magasin, et la plage a commencé il y a deux
    // heures » : en ET, l'entrée dans la zone reste une transition à venir.
    const forme: ReminderFormState = {
      ...validForm(),
      combinator: 'AND',
      conditions: [
        {
          id: 'c-1',
          type: 'datetime',
          at: '2026-08-21T08:00:00.000Z',
          until: '2026-08-21T18:00:00.000Z',
        },
        {
          id: 'c-2',
          type: 'location',
          latitude: 48.63,
          longitude: 6.3,
          radiusMeters: 150,
          direction: 'enter',
        },
      ],
    };

    expect(validateForm(forme, NOW)).toEqual([]);
  });

  it('refuse une fenêtre déjà ouverte en OU, malgré un lieu', () => {
    // En OU la fenêtre suffit à satisfaire la règle : elle est vraie dès
    // l'enregistrement, donc plus rien ne basculera jamais.
    const forme: ReminderFormState = {
      ...validForm(),
      combinator: 'OR',
      conditions: [
        {
          id: 'c-1',
          type: 'datetime',
          at: '2026-08-21T08:00:00.000Z',
          until: '2026-08-21T18:00:00.000Z',
        },
        {
          id: 'c-2',
          type: 'location',
          latitude: 48.63,
          longitude: 6.3,
          radiusMeters: 150,
          direction: 'enter',
        },
      ],
    };

    expect(validateForm(forme, NOW)).toContainEqual({
      code: 'windowAlreadyOpen',
      conditionId: 'c-1',
    });
  });

  it('laisse rouvrir un rappel dont la fenêtre s’est ouverte entre-temps', () => {
    // Condition enregistrée et non touchée : refuser ici rendrait le rappel
    // impossible à corriger, exactement le piège de la phase 4.
    const forme = avecFenetre(
      '2026-08-21T08:00:00.000Z',
      '2026-08-21T18:00:00.000Z',
    );

    expect(validateForm(forme, NOW, forme)).toEqual([]);
  });

  it('refuse une fenêtre déjà refermée', () => {
    expect(
      validateForm(
        avecFenetre('2026-08-21T06:00:00.000Z', '2026-08-21T08:00:00.000Z'),
        NOW,
      ),
    ).toEqual([{ code: 'windowClosed', conditionId: 'c-1' }]);
  });

  it('refuse une fenêtre inversée', () => {
    expect(
      validateForm(
        avecFenetre('2026-08-21T18:00:00.000Z', '2026-08-21T14:00:00.000Z'),
        NOW,
      ),
    ).toEqual([{ code: 'windowInverted', conditionId: 'c-1' }]);
  });

  it('refuse une fenêtre de durée nulle', () => {
    const instant = '2026-08-21T14:00:00.000Z';

    expect(validateForm(avecFenetre(instant, instant), NOW)).toEqual([
      { code: 'windowInverted', conditionId: 'c-1' },
    ]);
  });

  it('signale l’inversion même sur une condition inchangée', () => {
    // Contrairement à une fenêtre passée, une fenêtre inversée ne peut venir
    // que d'une erreur : la laisser passer serait garder un rappel mort.
    const forme = avecFenetre(
      '2026-08-21T18:00:00.000Z',
      '2026-08-21T14:00:00.000Z',
    );

    expect(validateForm(forme, NOW, forme)).toContainEqual({
      code: 'windowInverted',
      conditionId: 'c-1',
    });
  });

  it('refuse une fenêtre refermée dont on vient de déplacer la FIN', () => {
    // Défaut réel : `estInchangee` ne comparait que `at`. Déplacer la seule
    // borne de fin faisait passer la condition pour intacte, et un rappel
    // définitivement mort s'enregistrait sans avertissement.
    const avant = avecFenetre(
      '2026-08-21T08:00:00.000Z',
      '2026-08-21T18:00:00.000Z',
    );
    const apres = avecFenetre(
      '2026-08-21T08:00:00.000Z',
      '2026-08-21T09:00:00.000Z',
    );

    expect(validateForm(apres, NOW, avant)).toContainEqual({
      code: 'windowClosed',
      conditionId: 'c-1',
    });
  });

  it('tolère une fenêtre refermée que l’utilisateur n’a pas touchée', () => {
    const forme = avecFenetre(
      '2026-08-21T06:00:00.000Z',
      '2026-08-21T08:00:00.000Z',
    );

    expect(validateForm(forme, NOW, forme)).toEqual([]);
  });

  it('sans borne haute, la règle de date passée s’applique toujours', () => {
    expect(validateForm(avecFenetre('2026-08-21T09:00:00.000Z'), NOW)).toEqual([
      { code: 'dateTimeInPast', conditionId: 'c-1' },
    ]);
  });
});

describe('validateForm — lieu', () => {
  function avecLieu(
    surcharge: Partial<ReturnType<typeof createLocationCondition>>,
  ): ReminderFormState {
    return {
      ...validForm(),
      conditions: [
        { ...createLocationCondition(), id: 'c-lieu', ...surcharge },
      ],
    };
  }

  it('refuse un lieu jamais positionné', () => {
    // Sans ce refus, la condition partirait au natif avec des coordonnées
    // dans le golfe de Guinée : le rappel ne sonnerait jamais, sans erreur.
    expect(validateForm(avecLieu({}), NOW)).toEqual([
      { code: 'locationNotPlaced', conditionId: 'c-lieu' },
    ]);
  });

  it('accepte un lieu positionné au rayon par défaut', () => {
    expect(
      validateForm(avecLieu({ latitude: 48.8566, longitude: 2.3522 }), NOW),
    ).toEqual([]);
  });

  it('refuse un rayon sous le seuil de fiabilité', () => {
    expect(
      validateForm(
        avecLieu({
          latitude: 48.8566,
          longitude: 2.3522,
          radiusMeters: MIN_RADIUS_METERS - 1,
        }),
        NOW,
      ),
    ).toEqual([{ code: 'radiusTooSmall', conditionId: 'c-lieu' }]);
  });

  it('accepte exactement le rayon minimal', () => {
    expect(
      validateForm(
        avecLieu({
          latitude: 48.8566,
          longitude: 2.3522,
          radiusMeters: MIN_RADIUS_METERS,
        }),
        NOW,
      ),
    ).toEqual([]);
  });

  it('signale le lieu non placé avant le rayon, une erreur à la fois', () => {
    // Reprocher les deux d'un coup pour une condition qu'on n'a pas encore
    // placée serait du bruit : le rayon n'a pas de sens sans lieu.
    expect(validateForm(avecLieu({ radiusMeters: 10 }), NOW)).toEqual([
      { code: 'locationNotPlaced', conditionId: 'c-lieu' },
    ]);
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

  it('ne valide pas encore le Bluetooth, pas constructible', () => {
    const form: ReminderFormState = {
      ...validForm(),
      conditions: [
        {
          id: 'c-2',
          type: 'bluetooth',
          deviceId: '00:11:22:33:44:55',
          deviceName: 'Casque',
          direction: 'connect',
        },
      ],
    };

    expect(validateForm(form, NOW)).toEqual([]);
  });

  describe('condition Wi-Fi', () => {
    function avecSsid(ssid: string): ReminderFormState {
      return {
        ...validForm(),
        conditions: [{ id: 'c-2', type: 'wifi', ssid, direction: 'connect' }],
      };
    }

    it('accepte un réseau désigné', () => {
      expect(validateForm(avecSsid('Livebox-1A2B'), NOW)).toEqual([]);
    });

    it('refuse un SSID vide', () => {
      // Rien ne pourrait satisfaire cette condition : le rappel paraîtrait
      // armé sans l'être.
      expect(validateForm(avecSsid(''), NOW)).toEqual([
        { code: 'ssidRequired', conditionId: 'c-2' },
      ]);
    });

    it('refuse un SSID réduit à des espaces', () => {
      expect(validateForm(avecSsid('   '), NOW)).toEqual([
        { code: 'ssidRequired', conditionId: 'c-2' },
      ]);
    });
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
