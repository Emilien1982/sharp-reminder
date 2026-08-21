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
  /**
   * Éditeur de rappel. L'absence de `reminderId` signifie une création : c'est
   * le même écran qui sert aux deux usages, puisqu'ils manipulent exactement
   * les mêmes champs.
   */
  ReminderEditor: { reminderId?: string } | undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
