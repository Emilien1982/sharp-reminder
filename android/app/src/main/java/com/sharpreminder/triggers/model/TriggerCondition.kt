package com.sharpreminder.triggers.model

import java.time.Instant
import org.json.JSONArray
import org.json.JSONObject

/**
 * Conditions de déclenchement, miroir Kotlin de `src/domain/triggers/types.ts`.
 *
 * Le format JSON est le contrat entre les deux couches : toute évolution du
 * type TypeScript doit être répercutée ici et dans l'équivalent Swift.
 */
sealed interface TriggerCondition {
    val id: String

    data class DateTime(
        override val id: String,
        /** Instant absolu ; le décalage horaire du JSON est déjà résolu. */
        val at: Instant,
    ) : TriggerCondition

    data class Wifi(
        override val id: String,
        val ssid: String,
        /** `true` pour « connexion », `false` pour « déconnexion ». */
        val onConnect: Boolean,
    ) : TriggerCondition

    data class Bluetooth(
        override val id: String,
        val deviceId: String,
        val deviceName: String,
        val onConnect: Boolean,
    ) : TriggerCondition

    data class Location(
        override val id: String,
        val latitude: Double,
        val longitude: Double,
        val radiusMeters: Float,
        /** `true` pour « entrée », `false` pour « sortie ». */
        val onEnter: Boolean,
    ) : TriggerCondition

    companion object {
        /**
         * @throws IllegalArgumentException si le type est inconnu — un
         *   déclencheur non géré doit faire échouer la synchronisation
         *   bruyamment, jamais être ignoré en silence : un rappel qui ne sonne
         *   pas est le pire des défauts pour cette application.
         */
        fun fromJson(json: JSONObject): TriggerCondition {
            val id = json.getString("id")
            return when (val type = json.getString("type")) {
                "datetime" -> DateTime(id, parseIsoInstant(json.getString("at")))

                "wifi" -> Wifi(
                    id = id,
                    ssid = json.getString("ssid"),
                    onConnect = json.getString("direction") == "connect",
                )

                "bluetooth" -> Bluetooth(
                    id = id,
                    deviceId = json.getString("deviceId"),
                    deviceName = json.getString("deviceName"),
                    onConnect = json.getString("direction") == "connect",
                )

                "location" -> Location(
                    id = id,
                    latitude = json.getDouble("latitude"),
                    longitude = json.getDouble("longitude"),
                    radiusMeters = json.getDouble("radiusMeters").toFloat(),
                    onEnter = json.getString("direction") == "enter",
                )

                else -> throw IllegalArgumentException(
                    "Type de déclencheur non géré : $type",
                )
            }
        }

        fun listFromJson(array: JSONArray): List<TriggerCondition> =
            (0 until array.length()).map { fromJson(array.getJSONObject(it)) }
    }
}

/** Type de déclencheur, utilisé par le registre pour piloter les écoutes. */
enum class TriggerType(val wireName: String) {
    DATETIME("datetime"),
    WIFI("wifi"),
    BLUETOOTH("bluetooth"),
    LOCATION("location"),
}

val TriggerCondition.triggerType: TriggerType
    get() = when (this) {
        is TriggerCondition.DateTime -> TriggerType.DATETIME
        is TriggerCondition.Wifi -> TriggerType.WIFI
        is TriggerCondition.Bluetooth -> TriggerType.BLUETOOTH
        is TriggerCondition.Location -> TriggerType.LOCATION
    }
