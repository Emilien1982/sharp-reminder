import { newId } from '@/domain/id';

describe('newId', () => {
  it('produit un identifiant au format UUID v4', () => {
    expect(newId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('ne produit pas deux fois le même identifiant', () => {
    const identifiers = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(identifiers.size).toBe(1000);
  });
});
