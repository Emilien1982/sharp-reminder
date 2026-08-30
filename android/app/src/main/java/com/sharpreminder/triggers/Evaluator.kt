package com.sharpreminder.triggers

import com.sharpreminder.triggers.model.SignalSnapshot
import com.sharpreminder.triggers.model.TriggerCondition

/**
 * Évaluation des règles de déclenchement.
 *
 * ⚠️ Miroir exact de `src/domain/triggers/evaluator.ts` et de l'équivalent
 * Swift. Les trois implémentations sont vérifiées sur le même jeu de cas,
 * `shared/fixtures/evaluator-cases.json`. Ne jamais modifier cette logique
 * sans ajouter le cas correspondant à ce fichier.
 */
object Evaluator {

    enum class Combinator { AND, OR;
        companion object {
            fun fromWire(value: String) = when (value) {
                "AND" -> AND
                "OR" -> OR
                else -> throw IllegalArgumentException("Combinateur inconnu : $value")
            }
        }
    }

    /**
     * Une condition est-elle satisfaite dans l'état courant ?
     *
     * Chaque condition est un prédicat sur l'état du monde, jamais un
     * événement. Le `when` est exhaustif sur la hiérarchie scellée : ajouter un
     * type de déclencheur casse la compilation ici tant qu'il n'est pas traité.
     */
    fun isConditionSatisfied(
        condition: TriggerCondition,
        signal: SignalSnapshot,
    ): Boolean = when (condition) {
        is TriggerCondition.DateTime ->
            // `!isBefore` et non `isAfter` : l'instant exact d'ouverture
            // satisfait la condition, comme en TypeScript et en Swift.
            // La borne haute, elle, est exclue — choix symétrique.
            !signal.now.isBefore(condition.at) &&
                (condition.until == null || signal.now.isBefore(condition.until))

        is TriggerCondition.Wifi ->
            if (condition.onConnect) signal.wifiSsid == condition.ssid
            else signal.wifiSsid != condition.ssid

        is TriggerCondition.Bluetooth -> {
            val connected = signal.connectedBluetoothDeviceIds.contains(condition.deviceId)
            if (condition.onConnect) connected else !connected
        }

        is TriggerCondition.Location -> {
            val inside = signal.insideLocationConditionIds.contains(condition.id)
            if (condition.onEnter) inside else !inside
        }
    }

    /**
     * Un rappel sans condition ne se déclenche jamais : sans cette règle, un ET
     * sur liste vide renverrait `true` — correct mathématiquement, mais il
     * ferait sonner un rappel vide à chaque signal reçu.
     */
    fun areConditionsSatisfied(
        conditions: List<TriggerCondition>,
        combinator: Combinator,
        signal: SignalSnapshot,
    ): Boolean {
        if (conditions.isEmpty()) return false

        return when (combinator) {
            Combinator.AND -> conditions.all { isConditionSatisfied(it, signal) }
            Combinator.OR -> conditions.any { isConditionSatisfied(it, signal) }
        }
    }

    /**
     * Le déclenchement se produit sur la transition faux → vrai, jamais sur un
     * état durablement vrai.
     */
    fun shouldFire(previouslySatisfied: Boolean, currentlySatisfied: Boolean): Boolean =
        !previouslySatisfied && currentlySatisfied
}
