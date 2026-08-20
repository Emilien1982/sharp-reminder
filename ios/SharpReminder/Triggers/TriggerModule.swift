import Foundation

/// Contrat d'un type de déclencheur, miroir Swift de `TriggerModule.kt`.
///
/// Chaque type est un module autonome portant sa propre écoute système, son
/// coût énergétique et son cycle de vie. Ajouter un déclencheur consiste à
/// implémenter ce protocole et à l'enregistrer dans `TriggerRegistry`.
protocol TriggerModule {
    var type: TriggerType { get }

    /// Coût **sur iOS**, qui diffère d'Android pour le Bluetooth.
    var cost: TriggerCost { get }

    /// Démarre l'écoute. Appelé dès qu'au moins une règle active utilise ce
    /// type, avec l'ensemble des conditions concernées.
    func start(rules: [RuleSnapshot])

    /// Arrête l'écoute. Appelé dès que plus aucune règle active n'utilise ce
    /// type — c'est ce qui satisfait l'extinction automatique des déclencheurs
    /// gourmands (§3 du brief).
    func stop()

    /// Complète l'état du monde avec ce que ce module observe.
    func contributeToSignal(_ signal: SignalSnapshot) -> SignalSnapshot
}

extension TriggerModule {
    func contributeToSignal(_ signal: SignalSnapshot) -> SignalSnapshot { signal }
}
