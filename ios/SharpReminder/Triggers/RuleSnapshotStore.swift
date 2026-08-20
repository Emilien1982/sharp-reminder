import Foundation

/// Persistance locale du moteur natif iOS.
///
/// Équivalent de `RuleSnapshotStore.kt`, appuyé sur `UserDefaults` plutôt que
/// sur `SharedPreferences`. Le natif ne lit jamais la base SQLite de
/// l'application : il travaille sur un miroir en lecture seule, poussé par le
/// JavaScript à chaque écriture, et qui doit survivre à la mort du processus.
final class RuleSnapshotStore {

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    // MARK: - Règles

    func saveRules(_ rawJson: String) {
        defaults.set(rawJson, forKey: Keys.rules)
    }

    func loadRules() -> [RuleSnapshot] {
        guard let raw = defaults.string(forKey: Keys.rules) else { return [] }
        // Un miroir illisible ne doit pas empêcher l'application de démarrer :
        // on repart d'un jeu vide, que la prochaine synchronisation JavaScript
        // reconstruira intégralement.
        return (try? RuleSnapshot.list(fromRawJson: raw)) ?? []
    }

    func removeRule(reminderId: String) {
        guard let raw = defaults.string(forKey: Keys.rules),
              let data = raw.data(using: .utf8),
              let array = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
        else { return }

        // Le filtrage opère sur le JSON brut : inutile de reconstruire un
        // format que l'on possède déjà.
        let kept = array.filter { ($0["reminderId"] as? String) != reminderId }
        if let encoded = try? JSONSerialization.data(withJSONObject: kept),
           let string = String(data: encoded, encoding: .utf8) {
            saveRules(string)
        }
    }

    // MARK: - État de satisfaction précédent

    func previousSatisfaction() -> [String: Bool] {
        defaults.dictionary(forKey: Keys.satisfaction) as? [String: Bool] ?? [:]
    }

    func savePreviousSatisfaction(_ states: [String: Bool]) {
        defaults.set(states, forKey: Keys.satisfaction)
    }

    // MARK: - Règles confiées au système

    /// Règles dont la notification a été programmée directement auprès
    /// d'`UNUserNotificationCenter`.
    ///
    /// Sans ce marquage, la prochaine évaluation constaterait la transition
    /// faux → vrai et publierait une **seconde** notification pour un rappel
    /// que le système a déjà délivré, application fermée.
    func osScheduledRuleIds() -> Set<String> {
        Set(defaults.stringArray(forKey: Keys.osScheduled) ?? [])
    }

    func saveOsScheduledRuleIds(_ ids: Set<String>) {
        defaults.set(Array(ids), forKey: Keys.osScheduled)
    }

    // MARK: - File des déclenchements

    func enqueueFiredEvent(_ event: FiredEvent) {
        var queue = defaults.array(forKey: Keys.fired) as? [[String: Any]] ?? []
        queue.append(event.asDictionary)
        defaults.set(queue, forKey: Keys.fired)
    }

    /// Renvoie la file au format JSON et la vide dans la foulée.
    func drainFiredEvents() -> String {
        let queue = defaults.array(forKey: Keys.fired) as? [[String: Any]] ?? []
        defaults.set([], forKey: Keys.fired)

        guard let data = try? JSONSerialization.data(withJSONObject: queue),
              let json = String(data: data, encoding: .utf8)
        else { return "[]" }

        return json
    }

    // MARK: - Diagnostic

    func recordSignal(type: String, at isoInstant: String) {
        var signals = defaults.dictionary(forKey: Keys.lastSignals) as? [String: String] ?? [:]
        signals[type] = isoInstant
        defaults.set(signals, forKey: Keys.lastSignals)
    }

    func lastSignals() -> [String: String] {
        defaults.dictionary(forKey: Keys.lastSignals) as? [String: String] ?? [:]
    }

    private enum Keys {
        static let rules = "sharpReminder.rules"
        static let satisfaction = "sharpReminder.previousSatisfaction"
        static let fired = "sharpReminder.firedEvents"
        static let lastSignals = "sharpReminder.lastSignals"
        static let osScheduled = "sharpReminder.osScheduledRules"
    }
}
