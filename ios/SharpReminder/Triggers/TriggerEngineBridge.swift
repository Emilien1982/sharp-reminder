import Foundation

/// Passerelle Objective-C vers le moteur écrit en Swift.
///
/// Le protocole `NativeTriggerEngineSpec` généré par React Native est en
/// Objective-C++ : une classe Swift ne peut pas s'y conformer directement.
/// Cette classe expose donc les opérations du moteur sous une forme visible
/// depuis Objective-C, et `TriggerEngineModule.mm` s'y adosse.
///
/// Volontairement dépourvue de logique : tout vit dans `TriggerEngine`, qui
/// reste ainsi joignable depuis n'importe quel réveil système, sans contexte
/// React. C'est ce qui permet au moteur de fonctionner application fermée.
@objc(TriggerEngineBridge)
public final class TriggerEngineBridge: NSObject {

    /// - Returns: le message d'erreur en cas d'échec, `nil` en cas de succès.
    ///   Une chaîne plutôt qu'un `NSError` : c'est tout ce dont la promesse
    ///   JavaScript a besoin, et cela évite un pont d'erreur superflu.
    @objc public static func syncRules(_ snapshotJson: String) -> String? {
        do {
            try TriggerEngine.syncRules(rawJson: snapshotJson)
            return nil
        } catch {
            return error.localizedDescription
        }
    }

    @objc public static func triggerCostsJson() -> String {
        TriggerEngine.costsJson()
    }

    @objc public static func drainFiredEventsJson() -> String {
        TriggerEngine.drainFiredEventsJson()
    }

    @objc public static func diagnosticsJson() -> String {
        TriggerEngine.diagnosticsJson()
    }

    /// Réévaluation complète, à appeler au retour au premier plan.
    ///
    /// Indispensable sur iOS : les règles combinant une date et un autre signal
    /// ne peuvent pas être confiées au système, et n'ont donc aucune occasion
    /// d'être évaluées tant que l'application ne s'exécute pas.
    @objc public static func evaluateAll() {
        TriggerEngine.evaluateAll()
    }
}
