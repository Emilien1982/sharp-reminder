package com.sharpreminder.triggers.location

import android.Manifest
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.location.LocationServices
import com.sharpreminder.triggers.TriggerEngine
import com.sharpreminder.triggers.TriggerModule
import com.sharpreminder.triggers.model.SignalSnapshot
import com.sharpreminder.triggers.model.TriggerCondition
import com.sharpreminder.triggers.model.TriggerCost
import com.sharpreminder.triggers.model.TriggerType

/**
 * Déclencheur de lieu, appuyé sur le géorepérage des services Google Play.
 *
 * Coût lourd : contrairement à `AlarmManager`, la surveillance de zones
 * maintient une écoute permanente du système de localisation. C'est
 * précisément le type de déclencheur que le registre doit éteindre dès qu'aucun
 * rappel actif ne l'utilise (§3 du brief).
 *
 * `GeofencingClient` est préféré à une écoute GPS continue pour la même
 * raison : le système regroupe les zones de toutes les applications et n'active
 * les capteurs qu'au besoin. Une écoute maison viderait la batterie en heures.
 */
class LocationTriggerModule(private val context: Context) : TriggerModule {

    override val type = TriggerType.LOCATION
    override val cost = TriggerCost.HEAVY

    private val geofencingClient = LocationServices.getGeofencingClient(context)
    private val state = GeofenceState(context)

    @SuppressLint("MissingPermission") // Vérifiée juste au-dessus de l'appel.
    override fun start(conditions: List<TriggerCondition>) {
        val zones = conditions.filterIsInstance<TriggerCondition.Location>()
        val zoneIds = zones.map { it.id }.toSet()

        // Réenregistrement complet à chaque synchronisation, comme pour les
        // alarmes : idempotent puisque l'identifiant de zone est celui de la
        // condition, et aucune zone orpheline ne peut survivre à une
        // modification.
        //
        // ⚠️ L'état n'est jamais effacé ici, contrairement à `stop()`. `start`
        // est rappelé à chaque évaluation, donc juste après chaque
        // franchissement : effacer jetterait l'information que le récepteur
        // vient d'enregistrer, avant que l'évaluateur ait pu la lire.
        //
        // Seules les zones disparues sont oubliées.
        state.replaceInside(state.insideConditionIds().intersect(zoneIds))

        if (zones.isEmpty()) {
            state.replaceKnown(emptySet())
            return
        }

        // ⚠️ C'est bien la permission d'ARRIÈRE-PLAN qu'il faut vérifier, pas
        // celle de premier plan. Depuis Android 10, `addGeofences` sans elle
        // est refusé **à l'intérieur des services Google Play** : la `Task`
        // réussit, `addOnFailureListener` ne se déclenche jamais, et
        // l'application croit surveiller des zones qui ne le sont pas. Le seul
        // indice est une ligne de journal de Play Services :
        //   « registration not permitted … (FINE) »
        // Vérifier ici transforme cette panne muette en refus explicite.
        if (!hasBackgroundPermission(context)) {
            Log.w(
                TAG,
                "Localisation en arrière-plan refusée : aucune zone surveillée. " +
                    "L'écran d'édition en avertit l'utilisateur.",
            )
            return
        }

        val request = GeofencingRequest.Builder()
            // Volontairement sans INITIAL_TRIGGER_ENTER. Le système
            // déclencherait une entrée immédiate pour toute zone déjà occupée,
            // et un rappel « préviens-moi en arrivant ici » sonnerait à
            // l'instant de sa création si l'on s'y trouve déjà. L'état initial
            // est établi autrement, par `primeInsideSet`.
            .setInitialTrigger(0)
            .addGeofences(zones.map(::toGeofence))
            .build()

        val nouvelles = zones.filterNot { it.id in state.knownConditionIds() }
        state.replaceKnown(zoneIds)

        // ⚠️ L'ajout attend la fin du retrait. Les deux opérations sont
        // asynchrones : lancées en parallèle, la suppression pouvait se
        // terminer *après* l'ajout et effacer les zones à peine enregistrées —
        // plus rien de surveillé, sans la moindre erreur.
        geofencingClient.removeGeofences(pendingIntent())
            .addOnCompleteListener {
                geofencingClient.addGeofences(request, pendingIntent())
                    .addOnSuccessListener {
                        // Amorce réservée aux zones jamais enregistrées : une
                        // zone déjà connue a un état tenu à jour par les
                        // franchissements, plus fiable qu'une dernière position
                        // connue vieille de plusieurs heures.
                        if (nouvelles.isNotEmpty()) {
                            primeInsideSet(nouvelles)
                        }
                    }
                    .addOnFailureListener { error ->
                        Log.e(TAG, "Enregistrement des zones refusé", error)
                    }
            }
    }

    override fun stop() {
        removeRegisteredGeofences()
        state.clear()
    }

    private fun removeRegisteredGeofences() {
        geofencingClient.removeGeofences(pendingIntent())
    }

    override fun contributeToSignal(signal: SignalSnapshot): SignalSnapshot =
        signal.copy(insideLocationConditionIds = state.insideConditionIds())

    // --- Zones ---------------------------------------------------------------

    /**
     * Les deux sens sont toujours surveillés, quelle que soit la direction
     * demandée par la condition.
     *
     * L'évaluateur raisonne sur un état, pas sur un événement : une condition
     * « quand je quitte X » a besoin de savoir que l'on vient d'entrer dans X
     * pour pouvoir constater la sortie ensuite. N'écouter qu'un sens rendrait
     * l'autre définitivement faux.
     */
    private fun toGeofence(condition: TriggerCondition.Location): Geofence =
        Geofence.Builder()
            .setRequestId(condition.id)
            .setCircularRegion(
                condition.latitude,
                condition.longitude,
                condition.radiusMeters,
            )
            .setExpirationDuration(Geofence.NEVER_EXPIRE)
            .setTransitionTypes(
                Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT,
            )
            .build()

    /**
     * Établit l'état initial des zones à partir de la dernière position connue.
     *
     * Nécessaire parce que le géorepérage ne répond jamais à « suis-je dans
     * cette zone ? ». Sans cette amorce, une zone déjà occupée resterait
     * considérée comme vide jusqu'à ce qu'on en sorte puis y revienne.
     *
     * Le résultat **est évalué**, et c'est délibéré : découvrir qu'une zone est
     * occupée est une information sur le monde, pas la création d'une règle. Si
     * elle rend la règle vraie, le rappel doit sonner — un rappel « quand je
     * suis au magasin » créé au magasin a précisément cet objet.
     *
     * La protection contre un déclenchement à la création reste assurée par la
     * ligne de base ordinaire : « préviens-moi quand je quitte la maison »,
     * créé à la maison, a sa condition fausse et ne part pas.
     */
    @SuppressLint("MissingPermission") // Appelée uniquement permission accordée.
    private fun primeInsideSet(zones: List<TriggerCondition.Location>) {
        LocationServices.getFusedLocationProviderClient(context)
            .lastLocation
            .addOnSuccessListener { position ->
                if (position == null) return@addOnSuccessListener

                val inside = zones.filter { zone ->
                    val distance = FloatArray(1)
                    android.location.Location.distanceBetween(
                        position.latitude,
                        position.longitude,
                        zone.latitude,
                        zone.longitude,
                        distance,
                    )
                    distance[0] <= zone.radiusMeters
                }

                // `markInside` et non `replaceInside` : seules les zones
                // neuves sont concernées, l'état des autres reste celui que
                // les franchissements ont établi.
                state.markInside(inside.map { it.id })
                TriggerEngine.evaluateAll(context, TriggerType.LOCATION.wireName)
            }
    }

    // --- Permissions ---------------------------------------------------------

    private fun isGranted(permission: String): Boolean =
        ContextCompat.checkSelfPermission(context, permission) ==
            PackageManager.PERMISSION_GRANTED

    private fun pendingIntent(): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            Intent(context, GeofenceReceiver::class.java),
            // MUTABLE est imposé par l'API : le système complète lui-même
            // l'intent avec la zone franchie et le sens du franchissement.
            // Avec FLAG_IMMUTABLE, le récepteur ne recevrait qu'un intent vide.
            PendingIntent.FLAG_UPDATE_CURRENT or mutabilityFlag(),
        )

    private fun mutabilityFlag(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0

    companion object {
        const val TAG = "SharpReminderLocation"

        /** Un seul intent pour toutes les zones : l'API les regroupe. */
        private const val REQUEST_CODE = 0x10CA

        /**
         * La surveillance de zones fonctionne-t-elle application fermée ?
         *
         * Depuis Android 10, elle exige `ACCESS_BACKGROUND_LOCATION`, qui ne
         * peut pas être demandée dans la même invite que la localisation
         * ordinaire. Exposée au diagnostic : sans elle, les rappels de lieu ne
         * sonnent que l'application ouverte, ce qui n'a aucun intérêt et ne se
         * verrait pas autrement.
         */
        fun hasBackgroundPermission(context: Context): Boolean =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.ACCESS_BACKGROUND_LOCATION,
                ) == PackageManager.PERMISSION_GRANTED
            } else {
                true
            }
    }
}
