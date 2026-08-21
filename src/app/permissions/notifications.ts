import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Demande la permission de notification.
 *
 * Depuis Android 13, une notification publiée sans cette permission est
 * silencieusement ignorée : le rappel se déclenche mais reste invisible. On la
 * demande donc au moment où l'utilisateur enregistre un rappel, conformément
 * au principe de permission contextuelle (règle 4 de CLAUDE.md) — et non dans
 * un onboarding qui listerait tout à l'avance.
 *
 * iOS demande cette autorisation depuis le natif, au moment de programmer la
 * première notification : rien à faire ici.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 33) {
    return true;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}
