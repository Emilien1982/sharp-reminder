import type { Reminder } from '@/domain/reminders/types';
import { buildRuleSnapshot } from '@/domain/triggers/snapshot';

function rappel(surcharge: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r-1',
    text: 'Acheter du pain',
    enabled: true,
    combinator: 'OR',
    conditions: [{ id: 'c-1', type: 'datetime', at: '2026-08-29T10:00:00Z' }],
    afterFire: 'keep',
    createdAt: '2026-08-28T10:00:00.000Z',
    updatedAt: '2026-08-28T10:00:00.000Z',
    lastFiredAt: null,
    ...surcharge,
  };
}

describe('buildRuleSnapshot', () => {
  it('transmet un rappel actif jamais déclenché', () => {
    expect(buildRuleSnapshot([rappel()])).toHaveLength(1);
  });

  it('écarte un rappel désactivé', () => {
    expect(buildRuleSnapshot([rappel({ enabled: false })])).toEqual([]);
  });

  it('écarte un rappel sans condition', () => {
    // Il serait enregistré mais jamais évalué : muet sans que rien ne l'explique.
    expect(buildRuleSnapshot([rappel({ conditions: [] })])).toEqual([]);
  });

  describe('déclenchement unique', () => {
    it('écarte un rappel conservé qui a déjà sonné', () => {
      // C'est ce filtrage qui empêche un rappel de resonner à chaque passage,
      // et qui éteint du même coup son déclencheur.
      const epuise = rappel({
        afterFire: 'keep',
        lastFiredAt: '2026-08-29T11:00:00Z',
      });

      expect(buildRuleSnapshot([epuise])).toEqual([]);
    });

    it('transmet de nouveau un rappel dont la marque a été effacée', () => {
      // Le réarmement passe par `needsRearm`, qui remet `lastFiredAt` à null.
      expect(buildRuleSnapshot([rappel({ lastFiredAt: null })])).toHaveLength(
        1,
      );
    });

    it('transmet un rappel à suppression même s’il a déjà sonné', () => {
      // Cas théorique : le natif l'aurait déjà retiré de son miroir. Mais rien
      // ne doit dépendre de cet ordre — le filtrage ne vise que « conserver ».
      const supprime = rappel({
        afterFire: 'delete',
        lastFiredAt: '2026-08-29T11:00:00Z',
      });

      expect(buildRuleSnapshot([supprime])).toHaveLength(1);
    });
  });

  describe('plage expirée', () => {
    const NOW = new Date('2026-08-29T12:00:00.000Z');

    it('écarte un rappel dont la plage s’est refermée sans rien déclencher', () => {
      // Sans ce filtrage, son géorepérage resterait armé indéfiniment pour une
      // règle que l'évaluateur ne peut plus juger vraie.
      const perime = rappel({
        conditions: [
          {
            id: 'c-1',
            type: 'datetime',
            at: '2026-08-29T08:00:00.000Z',
            until: '2026-08-29T10:00:00.000Z',
          },
        ],
      });

      expect(buildRuleSnapshot([perime], NOW)).toEqual([]);
    });

    it('transmet encore un rappel dont la plage court toujours', () => {
      const enCours = rappel({
        conditions: [
          {
            id: 'c-1',
            type: 'datetime',
            at: '2026-08-29T10:00:00.000Z',
            until: '2026-08-29T18:00:00.000Z',
          },
        ],
      });

      expect(buildRuleSnapshot([enCours], NOW)).toHaveLength(1);
    });
  });
});
