package com.sharpreminder.triggers

import com.sharpreminder.triggers.model.RuleSnapshot

/**
 * Faut-il réétablir la ligne de base d'une règle ?
 *
 * La ligne de base mémorise si une règle était déjà satisfaite au moment où on
 * l'a connue, pour ne déclencher que sur une transition. Elle doit être remise
 * à jour dès que la règle **change de sens**, sans quoi une règle modifiée
 * reste jugée à l'aune de son ancienne version.
 *
 * Le cas qui a motivé ce fichier : un rappel « je suis au bureau à 13h28 » se
 * déclenche, sa base passe à `true`. L'utilisateur en change l'heure pour 19h.
 * Sans réinitialisation, la base reste `true`, la règle est déjà considérée
 * satisfaite, et le rappel **ne sonne plus jamais** tant que l'on ne quitte pas
 * la zone. Aucune erreur, aucun log — le mode de défaillance le plus dangereux
 * de cette application.
 *
 * Seuls les champs qui influent sur la satisfaction sont comparés : changer le
 * texte d'une notification ou le comportement après déclenchement ne doit pas
 * réarmer une règle que l'on vient d'évaluer.
 */
object Baseline {

    fun needsReset(previous: RuleSnapshot?, current: RuleSnapshot): Boolean =
        previous == null ||
            previous.conditions != current.conditions ||
            previous.combinator != current.combinator
}
