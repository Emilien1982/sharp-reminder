package com.sharpreminder.triggers.wifi

import android.content.Context

/**
 * Réseau Wi-Fi auquel le téléphone est actuellement rattaché.
 *
 * Même raison d'être que `GeofenceState` : le système annonce des
 * **changements**, il ne répond pas à « sur quel réseau suis-je ? » depuis un
 * récepteur fraîchement réveillé. L'évaluateur, lui, ne travaille que sur des
 * états. Le module tient donc lui-même le registre.
 *
 * Partagé entre le module et `WifiReceiver`, dont le processus peut venir de
 * naître : d'où `SharedPreferences`, disponible sans initialisation.
 *
 * `null` signifie « pas de Wi-Fi », ce qui rend vraie une condition
 * « je ne suis pas connecté à X ». C'est délibéré et cohérent avec
 * l'évaluateur, qui compare `signal.wifiSsid` à `condition.ssid`.
 */
class WifiState(context: Context) {

    private val preferences = context.applicationContext
        .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    fun currentSsid(): String? = preferences.getString(KEY_SSID, null)

    fun setSsid(ssid: String?) {
        preferences.edit().apply {
            if (ssid == null) remove(KEY_SSID) else putString(KEY_SSID, ssid)
        }.apply()
    }

    private companion object {
        const val PREFERENCES_NAME = "sharp_reminder_wifi"
        const val KEY_SSID = "current_ssid"
    }
}
