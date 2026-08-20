/**
 * Doublures des modules natifs.
 *
 * Jest exécute du JavaScript sur Node : aucun module natif n'y est disponible.
 * Les tests de cette base portent sur la logique pure (conversion de données,
 * évaluation des règles) ; les comportements natifs sont vérifiés sur appareil
 * réel, comme décrit dans le plan.
 */

jest.mock('@op-engineering/op-sqlite', () => ({
  open: jest.fn(() => ({
    execute: jest.fn(async () => ({ rows: [], rowsAffected: 0 })),
    close: jest.fn(),
  })),
}));

jest.mock('react-native-localize', () => ({
  findBestLanguageTag: jest.fn(() => ({
    languageTag: 'fr-FR',
    isRTL: false,
  })),
  getLocales: jest.fn(() => [
    {
      countryCode: 'FR',
      languageTag: 'fr-FR',
      languageCode: 'fr',
      isRTL: false,
    },
  ]),
}));

jest.mock('@/native/NativeTriggerEngine', () => ({
  __esModule: true,
  default: {
    syncRules: jest.fn(async () => undefined),
    getTriggerCosts: jest.fn(async () => '{"datetime":"light"}'),
    drainFiredEvents: jest.fn(async () => '[]'),
    getDiagnostics: jest.fn(
      async () =>
        '{"activeTriggerTypes":[],"ruleCount":0,"lastSignalAt":{},"notificationsAuthorized":true}',
    ),
  },
}));
