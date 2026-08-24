import Foundation

/// Registre des modules de déclencheurs, miroir Swift de `TriggerRegistry.kt`.
///
/// Sa seule responsabilité : maintenir les écoutes système alignées sur ce que
/// les règles actives réclament réellement. Un type qu'aucune règle n'utilise
/// voit son écoute arrêtée — mécanisme qui satisfait l'extinction automatique
/// des déclencheurs gourmands (§3 du brief).
final class TriggerRegistry {

    private let modules: [TriggerModule]
    private var activeTypes: Set<TriggerType> = []

    init(notifier: Notifier, store: RuleSnapshotStore) {
        modules = [
            DateTimeTriggerModule(notifier: notifier, store: store),
            LocationTriggerModule(),
            // Les modules Wi-Fi et Bluetooth viendront ici.
        ]
    }

    func reconcile(rules: [RuleSnapshot]) {
        for module in modules {
            let concerned = rules.filter { rule in
                rule.conditions.contains { $0.triggerType == module.type }
            }

            if concerned.isEmpty {
                // Arrêt inconditionnel : le registre est reconstruit à chaque
                // appel et ne peut pas savoir si l'écoute était active. Les
                // implémentations de `stop()` sont idempotentes.
                activeTypes.remove(module.type)
                module.stop()
            } else {
                activeTypes.insert(module.type)
                module.start(rules: concerned)
            }
        }
    }

    /// Complète l'état du monde avec ce qu'observe chaque module actif.
    ///
    /// Seuls les modules actifs contribuent : interroger une écoute arrêtée
    /// reviendrait à rallumer le capteur qu'on vient d'éteindre.
    func buildSignal(base: SignalSnapshot) -> SignalSnapshot {
        modules
            .filter { activeTypes.contains($0.type) }
            .reduce(base) { signal, module in module.contributeToSignal(signal) }
    }

    func activeTypeNames() -> [String] {
        activeTypes.map(\.rawValue).sorted()
    }

    func costs() -> [String: String] {
        Dictionary(uniqueKeysWithValues: modules.map { ($0.type.rawValue, $0.cost.rawValue) })
    }
}
