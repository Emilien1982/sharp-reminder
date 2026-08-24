package com.sharpreminder.triggers.location

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingEvent
import com.sharpreminder.triggers.TriggerEngine
import com.sharpreminder.triggers.model.TriggerType

/**
 * Réception d'un franchissement de zone.
 *
 * Met à jour l'état des zones occupées, puis demande une évaluation
 * **globale** — jamais ciblée sur les règles concernées. Une règle combinée en
 * ET peut basculer parce qu'une autre de ses conditions vient d'être remplie ;
 * laisser l'évaluateur trancher évite de dupliquer sa logique ici, pour la même
 * raison que dans `AlarmReceiver`.
 */
class GeofenceReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val event = GeofencingEvent.fromIntent(intent)

        if (event == null || event.hasError()) {
            // Journalisé plutôt qu'ignoré : une erreur de géorepérage signifie
            // des rappels qui ne sonneront pas, et rien d'autre ne le dirait.
            Log.e(
                LocationTriggerModule.TAG,
                "Événement de zone illisible : ${event?.errorCode ?: "intent vide"}",
            )
            return
        }

        val conditionIds = event.triggeringGeofences.orEmpty().map { it.requestId }
        if (conditionIds.isEmpty()) return

        val state = GeofenceState(context)

        when (event.geofenceTransition) {
            Geofence.GEOFENCE_TRANSITION_ENTER -> state.markInside(conditionIds)
            Geofence.GEOFENCE_TRANSITION_EXIT -> state.markOutside(conditionIds)
            else -> {
                // DWELL n'est pas demandé : le recevoir signalerait une
                // divergence entre ce qui est enregistré et ce qui arrive.
                Log.w(
                    LocationTriggerModule.TAG,
                    "Transition inattendue : ${event.geofenceTransition}",
                )
                return
            }
        }

        TriggerEngine.evaluateAll(context, TriggerType.LOCATION.wireName)
    }
}
