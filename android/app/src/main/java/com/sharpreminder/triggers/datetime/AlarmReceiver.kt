package com.sharpreminder.triggers.datetime

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.sharpreminder.triggers.TriggerEngine
import com.sharpreminder.triggers.model.TriggerType

/**
 * Réception d'une alarme programmée.
 *
 * Ne déclenche pas directement le rappel concerné : demande une évaluation
 * **globale**. Une règle combinée en ET peut en effet basculer à cause de
 * l'écoulement du temps alors que sa condition horaire n'est pas la seule.
 * Laisser l'évaluateur trancher évite de dupliquer sa logique ici.
 */
class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        TriggerEngine.evaluateAll(context, TriggerType.DATETIME.wireName)
    }
}
