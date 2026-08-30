import Foundation

enum Combinator: String {
    case and = "AND"
    case or = "OR"
}

/// Évaluation des règles de déclenchement.
///
/// ⚠️ Miroir exact de `src/domain/triggers/evaluator.ts` et de `Evaluator.kt`.
/// Les trois implémentations sont vérifiées sur le même jeu de cas,
/// `shared/fixtures/evaluator-cases.json`. Ne jamais modifier cette logique
/// sans ajouter le cas correspondant à ce fichier.
enum Evaluator {

    /// Une condition est-elle satisfaite dans l'état courant ?
    ///
    /// Chaque condition est un prédicat sur l'état du monde, jamais un
    /// événement. Le `switch` est exhaustif sur l'énumération : ajouter un type
    /// de déclencheur casse la compilation ici tant qu'il n'est pas traité.
    static func isConditionSatisfied(
        _ condition: TriggerCondition,
        _ signal: SignalSnapshot
    ) -> Bool {
        switch condition {
        case let .dateTime(_, at, until):
            // `>=` et non `>` : l'instant exact d'ouverture satisfait la
            // condition, comme en TypeScript et en Kotlin. La borne haute est
            // exclue — choix symétrique.
            return signal.now >= at && (until == nil || signal.now < until!)

        case let .wifi(_, ssid, onConnect):
            return onConnect ? signal.wifiSsid == ssid : signal.wifiSsid != ssid

        case let .bluetooth(_, deviceId, _, onConnect):
            let connected = signal.connectedBluetoothDeviceIds.contains(deviceId)
            return onConnect ? connected : !connected

        case let .location(id, _, _, _, onEnter):
            let inside = signal.insideLocationConditionIds.contains(id)
            return onEnter ? inside : !inside
        }
    }

    /// Un rappel sans condition ne se déclenche jamais : sans cette règle, un ET
    /// sur liste vide renverrait `true` — correct mathématiquement, mais il
    /// ferait sonner un rappel vide à chaque signal reçu.
    static func areConditionsSatisfied(
        _ conditions: [TriggerCondition],
        _ combinator: Combinator,
        _ signal: SignalSnapshot
    ) -> Bool {
        guard !conditions.isEmpty else { return false }

        switch combinator {
        case .and:
            return conditions.allSatisfy { isConditionSatisfied($0, signal) }
        case .or:
            return conditions.contains { isConditionSatisfied($0, signal) }
        }
    }

    /// Le déclenchement se produit sur la transition faux → vrai, jamais sur un
    /// état durablement vrai.
    static func shouldFire(
        previouslySatisfied: Bool,
        currentlySatisfied: Bool
    ) -> Bool {
        !previouslySatisfied && currentlySatisfied
    }
}
