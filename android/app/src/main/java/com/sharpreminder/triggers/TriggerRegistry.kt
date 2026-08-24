package com.sharpreminder.triggers

import android.content.Context
import com.sharpreminder.triggers.datetime.DateTimeTriggerModule
import com.sharpreminder.triggers.location.LocationTriggerModule
import com.sharpreminder.triggers.model.RuleSnapshot
import com.sharpreminder.triggers.model.SignalSnapshot
import com.sharpreminder.triggers.model.TriggerType
import com.sharpreminder.triggers.model.triggerType

/**
 * Registre des modules de déclencheurs.
 *
 * Sa seule responsabilité : maintenir les écoutes système alignées sur ce que
 * les règles actives réclament réellement. Un type de déclencheur qu'aucune
 * règle n'utilise voit son écoute arrêtée — c'est ce mécanisme qui satisfait
 * l'exigence d'extinction automatique des déclencheurs gourmands (§3 du brief),
 * sans que le reste du code ait à s'en préoccuper.
 *
 * Ajouter un type de déclencheur consiste à l'ajouter à `modules`.
 */
class TriggerRegistry(context: Context) {

    private val modules: List<TriggerModule> = listOf(
        DateTimeTriggerModule(context),
        LocationTriggerModule(context),
        // Les modules Wi-Fi et Bluetooth viendront ici.
    )

    private val activeTypes = mutableSetOf<TriggerType>()

    /**
     * Aligne les écoutes sur les règles fournies.
     *
     * Appelée à chaque synchronisation, après chaque déclenchement susceptible
     * d'avoir supprimé une règle, et au démarrage du téléphone.
     */
    fun reconcile(rules: List<RuleSnapshot>) {
        val conditionsByType = rules
            .flatMap { it.conditions }
            .groupBy { it.triggerType }

        modules.forEach { module ->
            val conditions = conditionsByType[module.type].orEmpty()

            if (conditions.isEmpty()) {
                // Arrêt inconditionnel : le registre est reconstruit à chaque
                // appel — souvent depuis un BroadcastReceiver, dans un
                // processus qui vient d'être réveillé — et ne peut donc pas
                // savoir si l'écoute était active. Les implémentations de
                // `stop()` sont idempotentes pour cette raison.
                activeTypes -= module.type
                module.stop()
            } else {
                activeTypes += module.type
                module.start(conditions)
            }
        }
    }

    /** Arrête toutes les écoutes. */
    fun stopAll() {
        modules.forEach { it.stop() }
        activeTypes.clear()
    }

    /**
     * Complète l'état du monde avec ce qu'observe chaque module actif.
     *
     * Seuls les modules actifs contribuent : interroger une écoute arrêtée
     * reviendrait à rallumer le capteur qu'on vient d'éteindre.
     */
    fun buildSignal(base: SignalSnapshot): SignalSnapshot =
        modules
            .filter { it.type in activeTypes }
            .fold(base) { signal, module -> module.contributeToSignal(signal) }

    fun activeTypeNames(): List<String> = activeTypes.map { it.wireName }.sorted()

    fun costs(): Map<String, String> =
        modules.associate { it.type.wireName to it.cost.wireName }
}
