package com.sharpreminder.triggers.wifi

import android.annotation.SuppressLint
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.wifi.WifiInfo
import android.net.wifi.WifiManager

/**
 * Ce que l'on sait du réseau Wi-Fi, avec ses trois issues distinctes.
 *
 * `Masquee` n'est pas un détail : Android renvoie `<unknown ssid>` quand la
 * permission de localisation manque ou que le service de position est coupé.
 * Confondre ce cas avec « pas de Wi-Fi » rendrait vraie une condition
 * « je ne suis pas connecté à X » alors qu'on y est peut-être — et l'écran
 * d'édition n'aurait rien à dire à l'utilisateur pour le sortir de là.
 */
sealed interface WifiReading {
    data class Connectee(val ssid: String) : WifiReading
    data object Absente : WifiReading
    data object Masquee : WifiReading
}

/**
 * Lecture du SSID courant.
 *
 * Deux sources, essayées dans cet ordre, pour une raison détaillée dans `of`.
 */
object WifiSsidReader {

    /** Réseau actif, sans réseau précis en tête. */
    fun current(context: Context): WifiReading {
        val manager = context.getSystemService(ConnectivityManager::class.java)
            ?: return WifiReading.Absente
        return of(context, manager.activeNetwork)
    }

    /** Réseau désigné, tel que reçu dans l'intent du système. */
    fun of(context: Context, network: Network?): WifiReading {
        val manager = context.getSystemService(ConnectivityManager::class.java)
            ?: return WifiReading.Absente
        val capabilities = network?.let { manager.getNetworkCapabilities(it) }
            ?: return WifiReading.Absente

        if (!capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
            return WifiReading.Absente
        }

        // ⚠️ Deux sources, et la première ment souvent.
        //
        // Depuis Android 12, le `WifiInfo` obtenu par `getNetworkCapabilities()`
        // est **expurgé** de ses champs sensibles à la localisation : le SSID y
        // vaut « <unknown ssid> » même avec toutes les permissions accordées et
        // le service de position allumé. Il n'est complet que délivré à un
        // `NetworkCallback` vivant — donc jamais dans un récepteur réveillé pour
        // l'occasion, ni ici.
        //
        // Constaté sur le Galaxy S21 : l'éditeur affichait « le système refuse
        // de donner le nom du réseau » alors que rien ne manquait. Le
        // `WifiManager`, pourtant déprécié, répond lui correctement.
        val direct = interpret((capabilities.transportInfo as? WifiInfo)?.ssid)
        if (direct is WifiReading.Connectee) return direct

        return interpret(legacySsid(context))
    }

    @Suppress("DEPRECATION")
    @SuppressLint("MissingPermission") // ACCESS_WIFI_STATE, déclarée au manifeste.
    private fun legacySsid(context: Context): String? =
        context.getSystemService(WifiManager::class.java)?.connectionInfo?.ssid

    /**
     * Deux pièges, et ils se paient au même prix : une comparaison de SSID qui
     * n'aboutit jamais, donc un rappel qui paraît armé sans l'être.
     *
     * 1. `WifiInfo.getSSID()` entoure le nom de guillemets quand il est en
     *    UTF-8. Les laisser ferait échouer toute comparaison avec ce que
     *    l'utilisateur a saisi.
     * 2. Il renvoie `<unknown ssid>` quand la permission manque — une chaîne
     *    ordinaire, qu'aucun type ne distingue d'un vrai nom de réseau.
     */
    private fun interpret(brut: String?): WifiReading {
        if (brut == null || brut == WifiManager.UNKNOWN_SSID) return WifiReading.Masquee

        val nettoye = brut.removeSurrounding("\"")
        return if (nettoye.isEmpty()) WifiReading.Masquee else WifiReading.Connectee(nettoye)
    }
}
