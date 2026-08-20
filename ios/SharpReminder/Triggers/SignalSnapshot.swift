import Foundation

/// État des signaux surveillés à un instant donné. Miroir Swift de
/// `src/domain/triggers/signal.ts` et de `SignalSnapshot.kt`.
///
/// Décrit le monde *maintenant*, pas ce qui vient de se produire : c'est ce qui
/// rend le ET possible entre plusieurs conditions.
struct SignalSnapshot {
    let now: Date
    let wifiSsid: String?
    let connectedBluetoothDeviceIds: Set<String>
    /// Identifiants des *conditions* de lieu dont la zone est occupée.
    let insideLocationConditionIds: Set<String>

    static func empty(now: Date) -> SignalSnapshot {
        SignalSnapshot(
            now: now,
            wifiSsid: nil,
            connectedBluetoothDeviceIds: [],
            insideLocationConditionIds: []
        )
    }
}
