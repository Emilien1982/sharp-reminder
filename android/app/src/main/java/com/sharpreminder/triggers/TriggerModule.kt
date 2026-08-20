package com.sharpreminder.triggers

import com.sharpreminder.triggers.model.SignalSnapshot
import com.sharpreminder.triggers.model.TriggerCondition
import com.sharpreminder.triggers.model.TriggerCost
import com.sharpreminder.triggers.model.TriggerType

/**
 * Contrat d'un type de déclencheur.
 *
 * Chaque type est un module autonome portant sa propre écoute système, son
 * coût énergétique et son cycle de vie. Ajouter un déclencheur (météo, cycle
 * lunaire…) consiste à implémenter cette interface et à l'enregistrer dans
 * `TriggerRegistry` — sans toucher au reste du moteur.
 */
interface TriggerModule {
    val type: TriggerType

    /** Coût sur cette plateforme. Voir `TriggerCost`. */
    val cost: TriggerCost

    /**
     * Démarre l'écoute. Appelé dès qu'au moins une règle active utilise ce
     * type, avec l'ensemble des conditions concernées.
     */
    fun start(conditions: List<TriggerCondition>)

    /**
     * Arrête l'écoute. Appelé dès que plus aucune règle active n'utilise ce
     * type — c'est ce qui satisfait l'exigence d'extinction automatique des
     * déclencheurs gourmands (§3 du brief).
     */
    fun stop()

    /**
     * Complète l'état du monde avec ce que ce module observe.
     *
     * Renvoie une copie enrichie plutôt que de muter : les modules peuvent
     * ainsi être composés dans n'importe quel ordre sans effet de bord.
     */
    fun contributeToSignal(signal: SignalSnapshot): SignalSnapshot = signal
}
