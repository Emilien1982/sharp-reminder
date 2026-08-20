module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // `void maPromesse()` est la façon explicite de signaler une promesse
    // volontairement non attendue (dans un useEffect, par exemple). Interdire
    // la forme pousserait à écrire du code moins clair, pas plus sûr.
    'no-void': ['warn', { allowAsStatement: true }],
  },
  overrides: [
    {
      // Les fichiers de traduction sont de longues listes de chaînes : les
      // contraintes de longueur de ligne n'y apportent rien.
      files: ['src/i18n/locales/*.ts'],
      rules: { 'max-len': 'off' },
    },
  ],
};
