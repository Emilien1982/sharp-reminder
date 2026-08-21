/**
 * Mise en forme des dates pour l'affichage.
 *
 * Regroupé ici parce que la liste et l'éditeur doivent produire exactement le
 * même rendu : une date affichée différemment d'un écran à l'autre ferait
 * douter de ce qui est réellement enregistré.
 *
 * La locale est passée explicitement plutôt que laissée au défaut du système :
 * l'application peut tourner en français sur un téléphone configuré en
 * anglais, et l'inverse.
 */

export function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(iso: string, locale: string): string {
  return `${formatDate(iso, locale)} · ${formatTime(iso, locale)}`;
}
