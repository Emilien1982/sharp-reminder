/**
 * Déclaration des routes.
 *
 * `RootStackParamList` est l'unique source de vérité de la navigation : elle
 * type à la fois les écrans, leurs paramètres et les appels à `navigate`.
 * Naviguer vers une route inexistante, ou oublier un paramètre, devient une
 * erreur de compilation.
 */
export type RootStackParamList = {
  RemindersList: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
