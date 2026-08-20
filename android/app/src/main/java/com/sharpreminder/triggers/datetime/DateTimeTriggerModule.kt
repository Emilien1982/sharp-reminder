package com.sharpreminder.triggers.datetime

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.sharpreminder.triggers.TriggerModule
import com.sharpreminder.triggers.model.TriggerCondition
import com.sharpreminder.triggers.model.TriggerCost
import com.sharpreminder.triggers.model.TriggerType

/**
 * Déclencheur date et heure, appuyé sur `AlarmManager`.
 *
 * Coût léger : aucune écoute permanente, le système réveille l'application au
 * moment voulu et rien ne tourne entre deux alarmes.
 *
 * `setExactAndAllowWhileIdle` est indispensable : les variantes inexactes
 * peuvent être reportées de plusieurs dizaines de minutes en mode Doze, ce qui
 * est inacceptable pour un rappel horaire.
 */
class DateTimeTriggerModule(private val context: Context) : TriggerModule {

    override val type = TriggerType.DATETIME
    override val cost = TriggerCost.LIGHT

    private val alarmManager: AlarmManager =
        context.getSystemService(AlarmManager::class.java)

    override fun start(conditions: List<TriggerCondition>) {
        // Toutes les alarmes sont reprogrammées à chaque synchronisation :
        // l'opération est idempotente puisque le code de requête dérive de
        // l'identifiant de la condition, et une reprogrammation complète ne
        // peut pas laisser d'alarme orpheline après une modification.
        stop()

        conditions
            .filterIsInstance<TriggerCondition.DateTime>()
            .forEach { condition -> schedule(condition) }
    }

    override fun stop() {
        knownRequestCodes().forEach { requestCode ->
            alarmManager.cancel(pendingIntent(requestCode, FLAG_REUSE))
        }
        clearKnownRequestCodes()
    }

    private fun schedule(condition: TriggerCondition.DateTime) {
        val triggerAtMillis = condition.at.toEpochMilli()

        // Une échéance déjà passée n'est pas programmée : le système
        // déclencherait immédiatement, faisant sonner à l'ouverture de
        // l'application un rappel dont l'heure est révolue.
        if (triggerAtMillis <= System.currentTimeMillis()) return

        val requestCode = condition.id.hashCode()
        rememberRequestCode(requestCode)

        val intent = pendingIntent(requestCode, FLAG_REUSE)

        if (canScheduleExact()) {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerAtMillis,
                intent,
            )
        } else {
            // Repli si l'utilisateur a révoqué l'autorisation d'alarme exacte :
            // mieux vaut un rappel imprécis qu'aucun rappel.
            alarmManager.setAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerAtMillis,
                intent,
            )
        }
    }

    private fun canScheduleExact(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            alarmManager.canScheduleExactAlarms()
        } else {
            true
        }

    private fun pendingIntent(requestCode: Int, flags: Int): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            requestCode,
            Intent(context, AlarmReceiver::class.java),
            flags,
        )

    // --- Suivi des alarmes programmées --------------------------------------
    //
    // `AlarmManager` n'expose aucun moyen d'énumérer les alarmes en attente :
    // pour pouvoir les annuler, il faut avoir mémorisé soi-même leurs codes de
    // requête.

    private val preferences =
        context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    private fun knownRequestCodes(): Set<Int> =
        preferences.getStringSet(KEY_REQUEST_CODES, emptySet())
            .orEmpty()
            .mapNotNull { it.toIntOrNull() }
            .toSet()

    private fun rememberRequestCode(requestCode: Int) {
        val updated = knownRequestCodes().map { it.toString() }.toMutableSet()
        updated += requestCode.toString()
        preferences.edit().putStringSet(KEY_REQUEST_CODES, updated).apply()
    }

    private fun clearKnownRequestCodes() {
        preferences.edit().remove(KEY_REQUEST_CODES).apply()
    }

    private companion object {
        const val PREFERENCES_NAME = "sharp_reminder_alarms"
        const val KEY_REQUEST_CODES = "request_codes"

        /**
         * `FLAG_NO_CREATE` est volontairement absent : on veut pouvoir créer
         * l'intent aussi bien pour programmer que pour annuler, et
         * `FLAG_UPDATE_CURRENT` garantit qu'une reprogrammation remplace bien
         * l'alarme précédente au lieu d'en ajouter une seconde.
         */
        const val FLAG_REUSE =
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    }
}
