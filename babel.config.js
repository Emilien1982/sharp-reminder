module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Les alias doivent être déclarés deux fois : ici pour Metro (résolution
    // à l'exécution) et dans tsconfig.json pour TypeScript (résolution à la
    // compilation). Les deux listes doivent rester synchronisées.
    [
      'module-resolver',
      {
        root: ['./'],
        extensions: ['.ios.ts', '.android.ts', '.ts', '.ios.tsx', '.android.tsx', '.tsx', '.json'],
        alias: {
          '@': './src',
          '@shared': './shared',
        },
      },
    ],
  ],
};
