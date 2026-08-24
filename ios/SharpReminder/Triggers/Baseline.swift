import Foundation

/// Faut-il réétablir la ligne de base d'une règle ? Miroir de `Baseline.kt`.
///
/// La ligne de base mémorise si une règle était déjà satisfaite au moment où on
/// l'a connue, pour ne déclencher que sur une transition. Elle doit être remise
/// à jour dès que la règle **change de sens**, sans quoi une règle modifiée
/// reste jugée à l'aune de son ancienne version.
///
/// Défaut réellement rencontré : un rappel « je suis au bureau à 13h28 » se
/// déclenche, sa base passe à `true`. On en change l'heure. Sans
/// réinitialisation, la règle est toujours considérée satisfaite et **ne sonne
/// plus jamais** tant qu'on ne quitte pas la zone — sans erreur ni journal.
///
/// Seuls les champs qui influent sur la satisfaction sont comparés : corriger
/// le texte d'une notification ne doit pas réarmer une règle déjà évaluée.
enum Baseline {

    static func needsReset(previous: RuleSnapshot?, current: RuleSnapshot) -> Bool {
        guard let previous else { return true }
        return previous.conditions != current.conditions
            || previous.combinator != current.combinator
    }
}
