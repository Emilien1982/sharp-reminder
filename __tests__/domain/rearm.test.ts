import { needsRearm } from '@/domain/reminders/rearm';
import type { Reminder } from '@/domain/reminders/types';

const rappel: Reminder = {
  id: 'r-1',
  text: 'Acheter du pain',
  enabled: true,
  combinator: 'AND',
  conditions: [
    { id: 'c-1', type: 'datetime', at: '2026-08-29T10:00:00.000Z' },
    {
      id: 'c-2',
      type: 'location',
      latitude: 48.63,
      longitude: 6.3,
      radiusMeters: 150,
      direction: 'enter',
    },
  ],
  afterFire: 'keep',
  createdAt: '2026-08-28T10:00:00.000Z',
  updatedAt: '2026-08-28T10:00:00.000Z',
  lastFiredAt: '2026-08-29T11:00:00.000Z',
};

describe('needsRearm', () => {
  it('ne réarme pas une modification de texte', () => {
    // Corriger une faute de frappe ne doit pas remettre en jeu un rappel
    // déjà honoré.
    expect(needsRearm(rappel, { text: 'Acheter du pain complet' })).toBe(false);
  });

  it('ne réarme pas un changement de comportement après déclenchement', () => {
    expect(needsRearm(rappel, { afterFire: 'delete' })).toBe(false);
  });

  it('ne réarme pas une bascule actif/inactif', () => {
    expect(needsRearm(rappel, { enabled: false })).toBe(false);
  });

  it('réarme un changement de combinateur', () => {
    expect(needsRearm(rappel, { combinator: 'OR' })).toBe(true);
  });

  it('ne réarme pas un combinateur réécrit à l’identique', () => {
    expect(needsRearm(rappel, { combinator: 'AND' })).toBe(false);
  });

  it('réarme un changement d’heure', () => {
    const conditions = [
      { ...rappel.conditions[0]!, at: '2026-08-30T10:00:00.000Z' },
      rappel.conditions[1]!,
    ];

    expect(needsRearm(rappel, { conditions })).toBe(true);
  });

  it('réarme un déplacement du lieu', () => {
    const conditions = [
      rappel.conditions[0]!,
      { ...rappel.conditions[1]!, latitude: 48.7 },
    ];

    expect(needsRearm(rappel, { conditions })).toBe(true);
  });

  it('réarme le retrait d’une condition', () => {
    expect(needsRearm(rappel, { conditions: [rappel.conditions[0]!] })).toBe(
      true,
    );
  });

  it('ne réarme pas des conditions réécrites à l’identique', () => {
    // Enregistrer sans rien toucher ne doit pas faire resonner un rappel.
    expect(needsRearm(rappel, { conditions: [...rappel.conditions] })).toBe(
      false,
    );
  });
});
