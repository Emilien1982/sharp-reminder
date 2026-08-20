package com.sharpreminder.triggers

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.sharpreminder.MainActivity
import com.sharpreminder.R

/**
 * Publication des notifications de rappel.
 *
 * V1 : notification simple, sans action rapide. `buildNotification` est
 * volontairement isolée pour que l'ajout futur d'actions « Fait » et
 * « Reporter » (§2 du brief) ne touche qu'un seul endroit.
 */
class Notifier(private val context: Context) {

    fun ensureChannel() {
        // minSdk 26 : les canaux existent toujours, aucune vérification de
        // version n'est nécessaire.
        val channel = NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = context.getString(R.string.notification_channel_description)
        }

        context.getSystemService(NotificationManager::class.java)
            .createNotificationChannel(channel)
    }

    /**
     * @return `true` si la notification a pu être publiée. Un `false` signale
     *   que l'utilisateur a refusé la permission de notification (API 33+) :
     *   le déclenchement reste enregistré dans la file pour que l'application
     *   puisse le signaler à son prochain lancement.
     */
    fun notify(reminderId: String, body: String): Boolean {
        ensureChannel()

        val openApp = PendingIntent.getActivity(
            context,
            reminderId.hashCode(),
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(context.getString(R.string.notification_title))
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(openApp)
            .build()

        return runCatching {
            NotificationManagerCompat.from(context)
                .notify(reminderId.hashCode(), notification)
            true
        }.getOrElse {
            // SecurityException si POST_NOTIFICATIONS n'est pas accordée.
            false
        }
    }

    private companion object {
        const val CHANNEL_ID = "sharp_reminder_triggers"
    }
}
