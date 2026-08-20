import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { findBestLanguageTag } from 'react-native-localize';

import { en } from '@/i18n/locales/en';
import { fr } from '@/i18n/locales/fr';
import type { TranslationResources } from '@/i18n/types';

/** Langues proposées. L'ajout d'une langue se fait uniquement ici. */
export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const FALLBACK_LANGUAGE: SupportedLanguage = 'fr';

const resources: Record<
  SupportedLanguage,
  { translation: TranslationResources }
> = {
  fr: { translation: fr },
  en: { translation: en },
};

/**
 * Langue à utiliser, déduite des préférences système.
 *
 * `findBestLanguageTag` respecte l'ordre des langues configurées sur le
 * téléphone, et non le seul réglage principal : un utilisateur ayant
 * l'allemand en premier et le français en second obtiendra le français
 * plutôt que le repli.
 */
export function detectLanguage(): SupportedLanguage {
  const best = findBestLanguageTag([...SUPPORTED_LANGUAGES]);
  const candidate = best?.languageTag.split('-')[0];

  return (
    SUPPORTED_LANGUAGES.find(language => language === candidate) ??
    FALLBACK_LANGUAGE
  );
}

export async function initialiseI18n(): Promise<void> {
  await i18n.use(initReactI18next).init({
    resources,
    lng: detectLanguage(),
    fallbackLng: FALLBACK_LANGUAGE,
    // React échappe déjà les valeurs interpolées : la double échappation
    // d'i18next produirait des entités HTML visibles à l'écran.
    interpolation: { escapeValue: false },
  });
}

export default i18n;
