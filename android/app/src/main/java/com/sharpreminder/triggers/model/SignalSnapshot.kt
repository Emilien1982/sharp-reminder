package com.sharpreminder.triggers.model

import java.time.Instant

/**
 * État des signaux surveillés à un instant donné. Miroir Kotlin de
 * `src/domain/triggers/signal.ts`.
 *
 * Décrit le monde *maintenant*, pas ce qui vient de se produire : c'est ce qui
 * rend le ET possible entre plusieurs conditions.
 */
data class SignalSnapshot(
    val now: Instant,
    val wifiSsid: String?,
    val connectedBluetoothDeviceIds: Set<String>,
    /** Identifiants des *conditions* de lieu dont la zone est occupée. */
    val insideLocationConditionIds: Set<String>,
) {
    companion object {
        fun empty(now: Instant) = SignalSnapshot(
            now = now,
            wifiSsid = null,
            connectedBluetoothDeviceIds = emptySet(),
            insideLocationConditionIds = emptySet(),
        )
    }
}
