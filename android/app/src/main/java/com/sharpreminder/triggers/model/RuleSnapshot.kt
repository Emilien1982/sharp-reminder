package com.sharpreminder.triggers.model

import com.sharpreminder.triggers.Evaluator
import org.json.JSONArray
import org.json.JSONObject

/**
 * Une règle active, telle que transmise par la couche JavaScript.
 * Miroir Kotlin de `RuleSnapshot` dans `src/domain/triggers/snapshot.ts`.
 */
data class RuleSnapshot(
    val reminderId: String,
    val notificationBody: String,
    val combinator: Evaluator.Combinator,
    val conditions: List<TriggerCondition>,
    val deleteAfterFire: Boolean,
) {
    companion object {
        fun fromJson(json: JSONObject) = RuleSnapshot(
            reminderId = json.getString("reminderId"),
            notificationBody = json.getString("notificationBody"),
            combinator = Evaluator.Combinator.fromWire(json.getString("combinator")),
            conditions = TriggerCondition.listFromJson(json.getJSONArray("conditions")),
            deleteAfterFire = json.getBoolean("deleteAfterFire"),
        )

        fun listFromJson(raw: String): List<RuleSnapshot> {
            val array = JSONArray(raw)
            return (0 until array.length()).map { fromJson(array.getJSONObject(it)) }
        }
    }
}

/** Déclenchement mis en file pour la couche JavaScript. */
data class FiredEvent(
    val reminderId: String,
    val firedAt: String,
    val triggeringConditionId: String,
) {
    fun toJson(): JSONObject = JSONObject()
        .put("reminderId", reminderId)
        .put("firedAt", firedAt)
        .put("triggeringConditionId", triggeringConditionId)

    companion object {
        fun fromJson(json: JSONObject) = FiredEvent(
            reminderId = json.getString("reminderId"),
            firedAt = json.getString("firedAt"),
            triggeringConditionId = json.getString("triggeringConditionId"),
        )
    }
}

/**
 * Coût énergétique d'un type de déclencheur, **sur Android**.
 *
 * Valeur délibérément portée par la plateforme et non par le TypeScript : le
 * Bluetooth appairé est gratuit ici (broadcast système `ACTION_ACL_CONNECTED`)
 * alors qu'il impose un scan BLE coûteux sur iOS.
 */
enum class TriggerCost(val wireName: String) {
    LIGHT("light"),
    HEAVY("heavy"),
}
