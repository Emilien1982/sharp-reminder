import type { Reminder } from '@/domain/reminders/types';
import type { TriggerCondition } from '@/domain/triggers/types';
import { isExpired } from '@/domain/triggers/expiry';

const NOW = new Date('2026-08-29T12:00:00.000Z');

const fenetreFermee: TriggerCondition = {
  id: 'c-date',
  type: 'datetime',
  at: '2026-08-29T08:00:00.000Z',
  until: '2026-08-29T10:00:00.000Z',
};

const fenetreOuverte: TriggerCondition = {
  id: 'c-date-2',
  type: 'datetime',
  at: '2026-08-29T14:00:00.000Z',
  until: '2026-08-29T18:00:00.000Z',
};

const sansBorne: TriggerCondition = {
  id: 'c-date-3',
  type: 'datetime',
  at: '2026-08-29T08:00:00.000Z',
};

const lieu: TriggerCondition = {
  id: 'c-lieu',
  type: 'location',
  latitude: 48.63,
  longitude: 6.3,
  radiusMeters: 150,
  direction: 'enter',
};

function regle(
  combinator: Reminder['combinator'],
  conditions: TriggerCondition[],
): Pick<Reminder, 'combinator' | 'conditions'> {
  return { combinator, conditions };
}

describe('isExpired', () => {
  it('déclare expirée une fenêtre seule déjà refermée', () => {
    expect(isExpired(regle('OR', [fenetreFermee]), NOW)).toBe(true);
  });

  it('laisse vivre une fenêtre encore à venir', () => {
    expect(isExpired(regle('OR', [fenetreOuverte]), NOW)).toBe(false);
  });

  it('n’expire jamais une condition sans borne haute', () => {
    // Le format antérieur à la phase 5 : « à partir de » reste vrai pour
    // toujours, il ne peut pas se périmer.
    expect(isExpired(regle('OR', [sansBorne]), NOW)).toBe(false);
  });

  it('condamne une règle en ET dès qu’une seule fenêtre s’est refermée', () => {
    // Le lieu a beau rester franchissable, l'expression ne peut plus être
    // vraie : garder cette règle maintiendrait son géorepérage armé pour rien.
    expect(isExpired(regle('AND', [fenetreFermee, lieu]), NOW)).toBe(true);
  });

  it('épargne une règle en OU tant qu’un autre signal peut la satisfaire', () => {
    expect(isExpired(regle('OR', [fenetreFermee, lieu]), NOW)).toBe(false);
  });

  it('condamne une règle en OU dont toutes les fenêtres sont refermées', () => {
    expect(
      isExpired(
        regle('OR', [fenetreFermee, { ...fenetreFermee, id: 'c-bis' }]),
        NOW,
      ),
    ).toBe(true);
  });

  it('ne déclare pas expirée une règle sans condition', () => {
    // Elle est incomplète, pas périmée : `buildRuleSnapshot` l'écarte déjà
    // pour une autre raison, et confondre les deux brouillerait le message.
    expect(isExpired(regle('AND', []), NOW)).toBe(false);
  });

  it('exclut la borne haute, comme l’évaluateur', () => {
    // À l'instant exact de `until`, la fenêtre est refermée des deux côtés :
    // une divergence ici ferait vivre une règle que le moteur juge fausse.
    const finExacte = new Date('2026-08-29T10:00:00.000Z');

    expect(isExpired(regle('OR', [fenetreFermee]), finExacte)).toBe(true);
  });
});
