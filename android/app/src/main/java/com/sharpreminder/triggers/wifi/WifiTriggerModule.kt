package com.sharpreminder.triggers.wifi

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.util.Log
import com.sharpreminder.triggers.TriggerEngine
import com.sharpreminder.triggers.TriggerModule
import com.sharpreminder.triggers.model.SignalSnapshot
import com.sharpreminder.triggers.model.TriggerCondition
import com.sharpreminder.triggers.model.TriggerCost
import com.sharpreminder.triggers.model.TriggerType

/**
 * Déclencheur Wi-Fi, appuyé sur `ConnectivityManager`.
 *
 * Coût léger : aucun capteur n'est allumé pour nous. Le système connaît déjà
 * l'état du Wi-Fi et se contente de nous le diffuser — contrairement au
 * géorepérage, qui fait tourner la localisation.
 *
 * ⚠️ **Ce déclencheur ne fonctionne que l'application vivante. C'est une limite
 * de la plateforme, mesurée, et non un raccourci.**
 *
 * Trois voies existent, et aucune ne réveille un processus mort :
 *
 * - `CONNECTIVITY_ACTION` n'est plus délivré aux récepteurs déclarés au
 *   manifeste depuis Android 8 ;
 * - `registerNetworkCallback(NetworkRequest, PendingIntent)` promet exactement
 *   cela, et c'est ce que ce module utilisait d'abord. **Vérifié sur Galaxy S21
 *   / Android 15 : zéro diffusion reçue**, dans les deux sens, y compris
 *   l'application au premier plan et le processus vivant. `dumpsys
 *   connectivity` ne montrait aucune demande enregistrée, et
 *   `registerNetworkCallback` n'avait pourtant levé aucune exception. Un échec
 *   parfaitement muet ;
 * - un `NetworkCallback` ordinaire — celui retenu ici — fonctionne, et meurt
 *   avec le processus.
 *
 * Le Wi-Fi est donc *best-effort* sur Android comme sur iOS, contrairement à
 * la date et au lieu. C'est l'une des raisons pour lesquelles ce projet
 * s'arrête : voir le README.
 */
class WifiTriggerModule(private val context: Context) : TriggerModule {

    override val type = TriggerType.WIFI
    override val cost = TriggerCost.LIGHT

    private val connectivityManager: ConnectivityManager? =
        context.getSystemService(ConnectivityManager::class.java)

    private val state = WifiState(context)

    override fun start(conditions: List<TriggerCondition>) {
        if (conditions.none { it is TriggerCondition.Wifi }) return
        val manager = connectivityManager ?: return

        // Sans `NET_CAPABILITY_INTERNET` : un rappel « quand je suis sur le
        // réseau du bureau » doit partir même si la borne est momentanément
        // privée d'accès. C'est le rattachement qui compte, pas la connectivité.
        val request = NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .build()

        // Le callback est retenu statiquement : le registre reconstruit un
        // module à chaque évaluation, et un callback tenu par l'instance serait
        // perdu — donc impossible à désenregistrer, et empilé à chaque
        // synchronisation jusqu'à la limite système de 100 demandes.
        synchronized(WifiTriggerModule) {
            if (live != null) return@synchronized

            val callback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: android.net.Network) = signaler()
                override fun onLost(network: android.net.Network) = signaler()
            }

            runCatching { manager.registerNetworkCallback(request, callback) }
                .onSuccess { live = callback }
                .onFailure { Log.e(TAG, "Écoute Wi-Fi refusée", it) }
        }

        // Le système ne rejoue pas l'état courant à l'enregistrement : sans
        // cette amorce, une règle créée alors qu'on est déjà sur le réseau
        // resterait jugée sur un SSID inconnu jusqu'au prochain changement.
        // C'est le pendant de `primeInsideSet` côté lieu, en bien plus simple —
        // la réponse est immédiate, elle n'a pas à être attendue.
        refreshSsid()
    }

    /**
     * ⚠️ Le SSID connu **survit** à l'arrêt de l'écoute ; seul l'abonnement est
     * rendu au système.
     *
     * La phase 5 a payé la leçon inverse côté lieu : tout jeter à l'arrêt
     * faisait paraître neuf, au réarmement, un état qui ne l'était pas, et la
     * règle se déclenchait sans que rien n'ait changé dans le monde. Ce que
     * l'on sait du monde n'est pas ce que l'on a demandé au système.
     */
    override fun stop() {
        val manager = connectivityManager ?: return

        synchronized(WifiTriggerModule) {
            live?.let { callback ->
                runCatching { manager.unregisterNetworkCallback(callback) }
                live = null
            }
        }
    }

    /**
     * Relit l'état et n'évalue **que s'il a changé**.
     *
     * `ConnectivityManager` est bavard : validation du réseau, portail captif
     * et changement de capacités produisent chacun un appel pour un même SSID.
     */
    private fun signaler() {
        if (!refreshSsid()) return
        TriggerEngine.evaluateAll(context, TriggerType.WIFI.wireName)
    }

    override fun contributeToSignal(signal: SignalSnapshot): SignalSnapshot =
        signal.copy(wifiSsid = state.currentSsid())

    /** Relit le réseau courant et le mémorise. Renvoie `true` si cela a changé. */
    private fun refreshSsid(): Boolean = applyReading(WifiSsidReader.current(context))

    private fun applyReading(reading: WifiReading): Boolean {
        val ssid = when (reading) {
            is WifiReading.Connectee -> reading.ssid
            // Un SSID masqué est traité comme une absence : c'est le choix le
            // plus sûr des deux. Une règle « je suis connecté à X » restera
            // muette, là où l'inverse la ferait sonner à tort.
            WifiReading.Absente, WifiReading.Masquee -> null
        }

        if (ssid == state.currentSsid()) return false
        state.setSsid(ssid)
        return true
    }

    companion object {
        const val TAG = "SharpReminderWifi"

        /** Écoute en cours, s'il y en a une. Voir `start` pour le pourquoi. */
        private var live: ConnectivityManager.NetworkCallback? = null
    }
}
