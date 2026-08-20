package com.sharpreminder.triggers

import android.content.Context
import com.sharpreminder.triggers.model.FiredEvent
import com.sharpreminder.triggers.model.RuleSnapshot
import org.json.JSONArray
import org.json.JSONObject

/**
 * Persistance locale du moteur natif.
 *
 * Le natif ne lit **jamais** la base SQLite de l'application : il travaille sur
 * un miroir en lecture seule, poussé par le JavaScript à chaque écriture. Ce
 * miroir doit survivre à la mort du processus et à un redémarrage du téléphone,
 * d'où `SharedPreferences` — suffisant pour quelques kilo-octets, et disponible
 * sans initialisation depuis un `BroadcastReceiver`.
 *
 * Trois éléments y sont conservés :
 * - les règles actives, telles que reçues ;
 * - l'état de satisfaction précédent de chaque règle, indispensable pour
 *   détecter une transition plutôt qu'un état ;
 * - la file des déclenchements survenus hors ligne, que le JavaScript viendra
 *   vider à son prochain démarrage.
 */
class RuleSnapshotStore(context: Context) {

    private val preferences =
        context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    // --- Règles -------------------------------------------------------------

    fun saveRules(rawJson: String) {
        preferences.edit().putString(KEY_RULES, rawJson).apply()
    }

    fun loadRules(): List<RuleSnapshot> {
        val raw = preferences.getString(KEY_RULES, null) ?: return emptyList()
        return runCatching { RuleSnapshot.listFromJson(raw) }.getOrElse {
            // Un miroir illisible ne doit pas empêcher l'application de
            // démarrer : on repart d'un jeu vide, que la prochaine
            // synchronisation JavaScript reconstruira intégralement.
            emptyList()
        }
    }

    /**
     * Retire une règle du miroir, après un déclenchement à suppression
     * automatique.
     *
     * Le filtrage opère sur le JSON brut plutôt que sur les objets désérialisés :
     * inutile de reconstruire un format que l'on possède déjà, et cela garantit
     * que ce qui est réécrit reste exactement lisible par `RuleSnapshot.fromJson`.
     */
    fun removeRule(reminderId: String) {
        val raw = preferences.getString(KEY_RULES, "[]") ?: "[]"
        val source = runCatching { JSONArray(raw) }.getOrElse { return }

        val kept = JSONArray()
        for (index in 0 until source.length()) {
            val rule = source.getJSONObject(index)
            if (rule.optString("reminderId") != reminderId) {
                kept.put(rule)
            }
        }

        saveRules(kept.toString())
    }

    // --- État de satisfaction précédent -------------------------------------

    fun previousSatisfaction(): Map<String, Boolean> {
        val raw = preferences.getString(KEY_SATISFACTION, null) ?: return emptyMap()
        return runCatching {
            val json = JSONObject(raw)
            json.keys().asSequence().associateWith { json.getBoolean(it) }
        }.getOrElse { emptyMap() }
    }

    fun savePreviousSatisfaction(states: Map<String, Boolean>) {
        val json = JSONObject()
        states.forEach { (reminderId, satisfied) -> json.put(reminderId, satisfied) }
        preferences.edit().putString(KEY_SATISFACTION, json.toString()).apply()
    }

    // --- File des déclenchements --------------------------------------------

    fun enqueueFiredEvent(event: FiredEvent) {
        val array = JSONArray(preferences.getString(KEY_FIRED, "[]") ?: "[]")
        array.put(event.toJson())
        preferences.edit().putString(KEY_FIRED, array.toString()).apply()
    }

    /** Renvoie la file et la vide dans la foulée. */
    fun drainFiredEvents(): String {
        val raw = preferences.getString(KEY_FIRED, "[]") ?: "[]"
        preferences.edit().putString(KEY_FIRED, "[]").apply()
        return raw
    }

    // --- Diagnostic ---------------------------------------------------------

    fun recordSignal(typeWireName: String, isoInstant: String) {
        val json = JSONObject(preferences.getString(KEY_LAST_SIGNALS, "{}") ?: "{}")
        json.put(typeWireName, isoInstant)
        preferences.edit().putString(KEY_LAST_SIGNALS, json.toString()).apply()
    }

    fun lastSignals(): JSONObject =
        JSONObject(preferences.getString(KEY_LAST_SIGNALS, "{}") ?: "{}")

    private companion object {
        const val PREFERENCES_NAME = "sharp_reminder_triggers"
        const val KEY_RULES = "rules"
        const val KEY_SATISFACTION = "previous_satisfaction"
        const val KEY_FIRED = "fired_events"
        const val KEY_LAST_SIGNALS = "last_signals"
    }
}
