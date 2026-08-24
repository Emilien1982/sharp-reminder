import Foundation

/// Déclencheur de lieu sur iOS, miroir de `LocationTriggerModule.kt`.
///
/// Coût lourd : la surveillance de régions maintient une écoute permanente du
/// système de localisation. C'est le type de déclencheur que le registre doit
/// éteindre dès qu'aucun rappel actif ne l'utilise (§3 du brief).
///
/// Le module lui-même est sans état : tout vit dans `LocationMonitor`, qui doit
/// survivre au registre — celui-ci est reconstruit à chaque appel, alors que le
/// gestionnaire de localisation doit rester joignable par le système pour
/// livrer les franchissements en arrière-plan.
///
/// **Limite structurelle : 20 régions surveillées au maximum.** Au-delà, iOS
/// cesse silencieusement de surveiller les suivantes. `LocationMonitor` tronque
/// et journalise plutôt que de laisser croire à une surveillance complète.
final class LocationTriggerModule: TriggerModule {

    let type: TriggerType = .location
    let cost: TriggerCost = .heavy

    private let monitor: LocationMonitor

    init(monitor: LocationMonitor = .shared) {
        self.monitor = monitor
    }

    func start(rules: [RuleSnapshot]) {
        let conditions = rules
            .flatMap(\.conditions)
            .filter { $0.triggerType == .location }

        monitor.requestAuthorization()
        monitor.replaceRegions(conditions)
    }

    func stop() {
        monitor.stopAll()
    }

    func contributeToSignal(_ signal: SignalSnapshot) -> SignalSnapshot {
        SignalSnapshot(
            now: signal.now,
            wifiSsid: signal.wifiSsid,
            connectedBluetoothDeviceIds: signal.connectedBluetoothDeviceIds,
            insideLocationConditionIds: monitor.insideConditionIds
        )
    }
}
