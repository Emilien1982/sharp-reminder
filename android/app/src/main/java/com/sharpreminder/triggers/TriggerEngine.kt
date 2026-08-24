package com.sharpreminder.triggers

import android.content.Context
import com.sharpreminder.triggers.model.FiredEvent
import com.sharpreminder.triggers.model.RuleSnapshot
import com.sharpreminder.triggers.model.SignalSnapshot
import java.time.Instant

/**
 * Orchestration du moteur natif.
 *
 * Point d'entrée unique appelé depuis trois endroits : la synchronisation
 * déclenchée par le JavaScript, les récepteurs de signaux système, et le
 * redémarrage du téléphone. Le JavaScript n'a jamais besoin d'être vivant.
 *
 * Les méthodes sont synchronisées : plusieurs `BroadcastReceiver` peuvent être
 * réveillés simultanément, et deux évaluations concurrentes pourraient publier
 * deux fois la même notification.
 */
object TriggerEngine {

    /**
     * Remplace le jeu de règles et réaligne les écoutes.
     *
     * Les règles nouvellement connues reçoivent une **ligne de base** : leur
     * satisfaction actuelle est enregistrée sans déclencher. Sans cela, un
     * rappel « préviens-moi quand je quitte la maison » sonnerait dès sa
     * création, la condition étant déjà vraie si l'on est dehors.
     */
    @Synchronized
    fun syncRules(context: Context, rawJson: String) {
        val store = RuleSnapshotStore(context)
        val registry = TriggerRegistry(context)

        // Lues AVANT l'écrasement : la comparaison entre l'ancienne et la
        // nouvelle version d'une règle est ce qui permet de détecter qu'elle a
        // changé de sens.
        val anciennes = store.loadRules().associateBy { it.reminderId }

        store.saveRules(rawJson)
        val rules = store.loadRules()
        registry.reconcile(rules)

        val signal = currentSignal(registry)
        val previous = store.previousSatisfaction().toMutableMap()

        rules.forEach { rule ->
            if (Baseline.needsReset(anciennes[rule.reminderId], rule)) {
                previous[rule.reminderId] = isSatisfied(rule, signal)
            }
        }

        // Les états des règles disparues sont oubliés, sans quoi le stockage
        // grossirait indéfiniment au fil des suppressions.
        previous.keys.retainAll(rules.map { it.reminderId }.toSet())
        store.savePreviousSatisfaction(previous)
    }

    /**
     * Évalue toutes les règles et publie les notifications dues.
     *
     * Appelée à chaque signal reçu. Volontairement globale plutôt que ciblée
     * sur la règle concernée : une règle en ET peut basculer à cause d'un
     * signal qui ne lui appartient pas directement.
     */
    @Synchronized
    fun evaluateAll(context: Context, signalTypeWireName: String? = null) {
        val store = RuleSnapshotStore(context)
        val registry = TriggerRegistry(context)
        val notifier = Notifier(context)

        val rules = store.loadRules()
        registry.reconcile(rules)

        val now = Instant.now()
        signalTypeWireName?.let { store.recordSignal(it, now.toString()) }

        val signal = currentSignal(registry, now)
        val previous = store.previousSatisfaction().toMutableMap()
        var rulesRemoved = false

        rules.forEach { rule ->
            val currentlySatisfied = isSatisfied(rule, signal)
            val previouslySatisfied = previous[rule.reminderId] ?: false

            if (Evaluator.shouldFire(previouslySatisfied, currentlySatisfied)) {
                // Le résultat est lu, pas ignoré : sans cela, une
                // notification refusée par le système laissait le rappel
                // « déclenché » en base sans que rien n'apparaisse à l'écran —
                // impossible à distinguer d'un déclencheur défaillant.
                if (!notifier.notify(rule.reminderId, rule.notificationBody)) {
                    android.util.Log.e(
                        Notifier.TAG,
                        "Rappel ${rule.reminderId} déclenché mais NON affiché",
                    )
                }

                store.enqueueFiredEvent(
                    FiredEvent(
                        reminderId = rule.reminderId,
                        firedAt = now.toString(),
                        triggeringConditionId = triggeringConditionId(rule, signal),
                    ),
                )

                if (rule.deleteAfterFire) {
                    store.removeRule(rule.reminderId)
                    previous.remove(rule.reminderId)
                    rulesRemoved = true
                    return@forEach
                }
            }

            previous[rule.reminderId] = currentlySatisfied
        }

        store.savePreviousSatisfaction(previous)

        // Une suppression peut avoir libéré le dernier usage d'un type de
        // déclencheur : on réaligne pour éteindre l'écoute devenue inutile.
        if (rulesRemoved) {
            registry.reconcile(store.loadRules())
        }
    }

    private fun currentSignal(
        registry: TriggerRegistry,
        now: Instant = Instant.now(),
    ): SignalSnapshot = registry.buildSignal(SignalSnapshot.empty(now))

    private fun isSatisfied(rule: RuleSnapshot, signal: SignalSnapshot): Boolean =
        Evaluator.areConditionsSatisfied(rule.conditions, rule.combinator, signal)

    /**
     * Condition à créditer du déclenchement, pour l'écran de diagnostic.
     *
     * En OU, la première condition satisfaite est la cause directe. En ET,
     * toutes le sont : on retient également la première, l'information n'ayant
     * qu'une valeur indicative.
     */
    private fun triggeringConditionId(rule: RuleSnapshot, signal: SignalSnapshot): String =
        rule.conditions
            .firstOrNull { Evaluator.isConditionSatisfied(it, signal) }
            ?.id
            .orEmpty()
}
