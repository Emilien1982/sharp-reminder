import {
  parseConditions,
  rowToReminder,
  serialiseConditions,
  type ReminderRow,
} from '@/data/reminderMapping';
import type { TriggerCondition } from '@/domain/triggers/types';

const validRow: ReminderRow = {
  id: 'r-1',
  text: 'Sortir les poubelles',
  enabled: 1,
  combinator: 'OR',
  conditions: JSON.stringify([
    { id: 'c-1', type: 'datetime', at: '2026-08-20T19:00:00+02:00' },
  ]),
  after_fire: 'keep',
  created_at: '2026-08-19T10:00:00.000Z',
  updated_at: '2026-08-19T10:00:00.000Z',
  last_fired_at: null,
};

describe('rowToReminder', () => {
  it('convertit une ligne complète', () => {
    const reminder = rowToReminder(validRow);

    expect(reminder).toEqual({
      id: 'r-1',
      text: 'Sortir les poubelles',
      enabled: true,
      combinator: 'OR',
      conditions: [
        { id: 'c-1', type: 'datetime', at: '2026-08-20T19:00:00+02:00' },
      ],
      afterFire: 'keep',
      createdAt: '2026-08-19T10:00:00.000Z',
      updatedAt: '2026-08-19T10:00:00.000Z',
      lastFiredAt: null,
    });
  });

  it('traduit la colonne entière `enabled` en booléen', () => {
    expect(rowToReminder({ ...validRow, enabled: 1 }).enabled).toBe(true);
    expect(rowToReminder({ ...validRow, enabled: 0 }).enabled).toBe(false);
  });

  it('accepte une date de dernier déclenchement absente', () => {
    expect(
      rowToReminder({ ...validRow, last_fired_at: null }).lastFiredAt,
    ).toBeNull();
    expect(
      rowToReminder({ ...validRow, last_fired_at: '2026-08-19T12:00:00.000Z' })
        .lastFiredAt,
    ).toBe('2026-08-19T12:00:00.000Z');
  });

  it('rejette un combinateur inconnu plutôt que de le laisser passer', () => {
    expect(() => rowToReminder({ ...validRow, combinator: 'XOR' })).toThrow(
      /Combinateur inconnu/,
    );
  });

  it('rejette un comportement post-déclenchement inconnu', () => {
    expect(() => rowToReminder({ ...validRow, after_fire: 'archive' })).toThrow(
      /post-déclenchement inconnu/,
    );
  });

  it('rejette une colonne texte manquante', () => {
    expect(() => rowToReminder({ ...validRow, text: null })).toThrow(
      /Colonne "text" invalide/,
    );
  });
});

describe('sérialisation des conditions', () => {
  it('effectue un aller-retour sans perte sur les quatre types', () => {
    const conditions: TriggerCondition[] = [
      { id: 'c-1', type: 'datetime', at: '2026-08-20T19:00:00+02:00' },
      { id: 'c-2', type: 'wifi', ssid: 'Maison', direction: 'connect' },
      {
        id: 'c-3',
        type: 'bluetooth',
        deviceId: 'AA:BB:CC:DD:EE:FF',
        deviceName: 'Casque',
        direction: 'disconnect',
      },
      {
        id: 'c-4',
        type: 'location',
        latitude: 48.6921,
        longitude: 6.1844,
        radiusMeters: 150,
        direction: 'enter',
      },
    ];

    expect(parseConditions(serialiseConditions(conditions))).toEqual(
      conditions,
    );
  });

  it('rejette un JSON qui ne serait pas un tableau', () => {
    expect(() => parseConditions('{"type":"datetime"}')).toThrow(
      /tableau JSON attendu/,
    );
  });
});
