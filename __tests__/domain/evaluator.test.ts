import {
  areConditionsSatisfied,
  shouldFire,
} from '@/domain/triggers/evaluator';
import type { SignalSnapshot } from '@/domain/triggers/signal';
import type { Combinator, TriggerCondition } from '@/domain/triggers/types';
import fixtures from '@shared/fixtures/evaluator-cases.json';

/**
 * Ces tests consomment `shared/fixtures/evaluator-cases.json`, également lu par
 * les suites JUnit (Kotlin) et XCTest (Swift). Un cas ajouté au fichier est
 * donc vérifié sur les trois implémentations de l'évaluateur.
 *
 * Le JSON est typé de façon permissive à la lecture : c'est un fichier de
 * données destiné à trois langages, il ne peut pas porter les types
 * TypeScript. La conversion est faite ici, en un seul endroit.
 */

interface SatisfactionCase {
  name: string;
  combinator: string;
  conditions: unknown[];
  signal: {
    now: string;
    wifiSsid: string | null;
    connectedBluetoothDeviceIds: string[];
    insideLocationConditionIds: string[];
  };
  expected: boolean;
}

interface RisingEdgeCase {
  name: string;
  previous: boolean;
  current: boolean;
  expected: boolean;
}

const satisfactionCases = fixtures.satisfactionCases as SatisfactionCase[];
const risingEdgeCases = fixtures.risingEdgeCases as RisingEdgeCase[];

describe('areConditionsSatisfied — cas partagés avec Kotlin et Swift', () => {
  it('le fichier de cas est bien chargé', () => {
    // Garde-fou : un chemin d'alias cassé donnerait un tableau vide, et tous
    // les tests passeraient sans rien vérifier.
    expect(satisfactionCases.length).toBeGreaterThan(20);
  });

  it.each(
    satisfactionCases.map(testCase => [testCase.name, testCase] as const),
  )('%s', (_name, testCase) => {
    const signal: SignalSnapshot = testCase.signal;

    const result = areConditionsSatisfied(
      testCase.conditions as TriggerCondition[],
      testCase.combinator as Combinator,
      signal,
    );

    expect(result).toBe(testCase.expected);
  });
});

describe('shouldFire — détection de la transition', () => {
  it.each(risingEdgeCases.map(testCase => [testCase.name, testCase] as const))(
    '%s',
    (_name, testCase) => {
      expect(shouldFire(testCase.previous, testCase.current)).toBe(
        testCase.expected,
      );
    },
  );
});

describe('exhaustivité', () => {
  it('rejette un type de condition inconnu au lieu de le considérer satisfait', () => {
    const unknownCondition = {
      id: 'x',
      type: 'meteo',
    } as unknown as TriggerCondition;

    expect(() =>
      areConditionsSatisfied([unknownCondition], 'OR', {
        now: '2026-08-20T12:00:00Z',
        wifiSsid: null,
        connectedBluetoothDeviceIds: [],
        insideLocationConditionIds: [],
      }),
    ).toThrow(/non géré/);
  });
});
