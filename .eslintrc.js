module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // `void maPromesse()` est la façon explicite de signaler une promesse
    // volontairement non attendue (dans un useEffect, par exemple). Interdire
    // la forme pousserait à écrire du code moins clair, pas plus sûr.
    'no-void': ['warn', { allowAsStatement: true }],
    // React Navigation impose de fournir `headerLeft` et `headerRight` sous
    // forme de fonction rendue : il n'existe aucune écriture sans composant
    // créé dans une prop. `allowAsProps` est l'option prévue par la règle
    // elle-même pour ce cas — et non un contournement : le danger visé
    // (remontage d'un sous-arbre porteur d'état) ne concerne pas des boutons
    // d'en-tête sans état.
    'react/no-unstable-nested-components': ['warn', { allowAsProps: true }],
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
