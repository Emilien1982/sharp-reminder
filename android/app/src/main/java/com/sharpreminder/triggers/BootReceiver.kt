package com.sharpreminder.triggers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Réarmement après un redémarrage du téléphone.
 *
 * Android efface toutes les alarmes programmées au redémarrage, et les écoutes
 * système enregistrées par l'application disparaissent avec le processus. Sans
 * ce récepteur, un rappel créé avant l'extinction ne sonnerait jamais — le
 * défaut le plus grave possible pour cette application, et le plus difficile à
 * remarquer puisqu'il ne produit aucune erreur.
 *
 * Le miroir des règles étant persisté, il suffit de réaligner le registre.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            -> {
                val store = RuleSnapshotStore(context)
                TriggerRegistry(context).reconcile(store.loadRules())
            }
        }
    }
}
