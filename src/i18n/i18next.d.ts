import type { TranslationResources } from '@/i18n/types';

/**
 * Typage des clés de traduction.
 *
 * L'augmentation cible le module `i18next` et non `react-i18next` : depuis
 * i18next v23, c'est lui qui porte `CustomTypeOptions`, et react-i18next se
 * contente d'en dériver ses propres types. Déclarer l'augmentation sur
 * `react-i18next` compile sans erreur mais n'a aucun effet — le typage des
 * clés reste alors permissif, ce qui est le pire des deux mondes.
 *
 * Effet obtenu : `t('reminders.listTitle')` est vérifié à la compilation, et
 * une clé mal orthographiée devient une erreur TypeScript au lieu d'une
 * chaîne brute affichée à l'écran.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: TranslationResources;
    };
  }
}
