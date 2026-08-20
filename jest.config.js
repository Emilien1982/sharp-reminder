module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Les alias sont déjà résolus par babel-plugin-module-resolver, mais Jest
  // résout certains chemins (mocks, couverture) avant Babel : la duplication
  // évite des échecs difficiles à diagnostiquer.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/i18n/locales/**',
  ],
};
