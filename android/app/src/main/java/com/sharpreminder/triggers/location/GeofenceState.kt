package com.sharpreminder.triggers.location

import android.content.Context

/**
 * Zones actuellement occupées.
 *
 * Ce fichier existe à cause d'une limite fondamentale des API de géorepérage :
 * **elles ne livrent que des franchissements, jamais un état**. Le système
 * annonce « tu viens d'entrer dans la zone X », il ne répond jamais à « suis-je
 * dans la zone X ? ». Or l'évaluateur travaille exclusivement sur des états —
 * c'est ce qui rend le ET possible entre plusieurs conditions.
 *
 * Le module tient donc lui-même le registre des zones occupées, exactement
 * comme `DateTimeTriggerModule` mémorise ses codes de requête faute de pouvoir
 * énumérer les alarmes en attente.
 *
 * Partagé entre le module et `GeofenceReceiver`, qui s'exécute dans un
 * processus pouvant venir d'être réveillé : d'où `SharedPreferences`,
 * disponible sans initialisation.
 */
class GeofenceState(context: Context) {

    private val preferences = context.applicationContext
        .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    fun insideConditionIds(): Set<String> =
        preferences.getStringSet(KEY_INSIDE, emptySet()).orEmpty().toSet()

    fun markInside(conditionIds: Collection<String>) {
        replaceInside(insideConditionIds() + conditionIds)
    }

    fun markOutside(conditionIds: Collection<String>) {
        replaceInside(insideConditionIds() - conditionIds.toSet())
    }

    /**
     * Remplace l'ensemble complet.
     *
     * `putStringSet` exige une copie : `SharedPreferences` conserve la
     * référence fournie, et muter l'ensemble d'origine corromprait
     * silencieusement ce qui est persisté.
     */
    fun replaceInside(conditionIds: Set<String>) {
        preferences.edit().putStringSet(KEY_INSIDE, conditionIds.toSet()).apply()
    }

    // --- Zones enregistrées --------------------------------------------------

    /**
     * Zones actuellement confiées au système.
     *
     * Sert à distinguer une zone **nouvelle** d'une zone simplement
     * réenregistrée. Sans cette distinction, chaque franchissement relancerait
     * l'amorce de l'état initial, qui écraserait avec une position
     * potentiellement ancienne l'information fraîche que le franchissement
     * venait d'apporter.
     */
    fun knownConditionIds(): Set<String> =
        preferences.getStringSet(KEY_KNOWN, emptySet()).orEmpty().toSet()

    fun replaceKnown(conditionIds: Set<String>) {
        preferences.edit().putStringSet(KEY_KNOWN, conditionIds.toSet()).apply()
    }

    fun clear() {
        preferences.edit().remove(KEY_INSIDE).remove(KEY_KNOWN).apply()
    }

    private companion object {
        const val PREFERENCES_NAME = "sharp_reminder_geofences"
        const val KEY_INSIDE = "inside_condition_ids"
        const val KEY_KNOWN = "known_condition_ids"
    }
}
