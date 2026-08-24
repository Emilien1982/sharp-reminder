import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Permissions de localisation.
 *
 * Android les scinde en deux, et c'est structurant : la localisation ordinaire
 * s'obtient par une invite classique, mais **la localisation en arrière-plan ne
 * peut pas être demandée dans la même invite depuis Android 11**. Le système
 * impose un second geste, par les réglages de l'application.
 *
 * Cette séparation compte parce que sans arrière-plan, les zones ne sont
 * surveillées que tant que l'application est ouverte — un rappel de lieu ne
 * sonnerait alors jamais utilement, sans qu'aucune erreur ne le signale. C'est
 * le même mode de défaillance muet que les notifications refusées, et il se
 * traite de la même façon : en l'affichant.
 *
 * iOS gère ses autorisations depuis le natif, au moment de surveiller la
 * première région : rien à faire ici.
 */

function isAndroid(): boolean {
  return Platform.OS === 'android';
}

/**
 * `Platform.Version` est typé `string | number` : c'est une chaîne sur iOS.
 * Le comparer sans ce filtre ne compile pas, et le forcer masquerait le fait
 * que la valeur n'a pas le même sens d'une plateforme à l'autre.
 */
function androidApiLevel(): number {
  return typeof Platform.Version === 'number' ? Platform.Version : 0;
}

/** Localisation ordinaire, demandée à la création d'un rappel de lieu. */
export async function ensureForegroundLocationPermission(): Promise<boolean> {
  if (!isAndroid()) {
    return true;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * La surveillance fonctionne-t-elle application fermée ?
 *
 * Simple lecture, sans invite : demander cette permission directement échoue
 * en silence sur Android 11+. L'interface s'en sert pour avertir et renvoyer
 * l'utilisateur vers les réglages.
 */
export async function hasBackgroundLocationPermission(): Promise<boolean> {
  if (!isAndroid()) {
    return true;
  }

  // Avant Android 10, l'arrière-plan est couvert par la permission ordinaire.
  if (androidApiLevel() < 29) {
    return PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
  }

  return PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
  );
}
