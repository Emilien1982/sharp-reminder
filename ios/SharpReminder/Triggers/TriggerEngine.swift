import Foundation

/// Orchestration du moteur natif iOS, miroir de `TriggerEngine.kt`.
///
/// Sérialisé sur une file dédiée : plusieurs réveils système peuvent survenir
/// simultanément, et deux évaluations concurrentes publieraient deux fois la
/// même notification.
enum TriggerEngine {

    private static let queue = DispatchQueue(label: "com.sharpreminder.triggers")

    /// Remplace le jeu de règles et réaligne les écoutes.
    ///
    /// Les règles nouvellement connues reçoivent une **ligne de base** : leur
    /// satisfaction actuelle est enregistrée sans déclencher. Sans cela, un
    /// rappel « préviens-moi quand je quitte la maison » sonnerait dès sa
    /// création, la condition étant déjà vraie si l'on est dehors.
    static func syncRules(rawJson: String) throws {
        try queue.sync {
            let store = RuleSnapshotStore()
            let notifier = Notifier()

            // Validation avant enregistrement : un JSON invalide doit remonter
            // au JavaScript, pas corrompre le miroir en silence.
            let rules = try RuleSnapshot.list(fromRawJson: rawJson)

            // Lues AVANT l'écrasement : comparer l'ancienne et la nouvelle
            // version d'une règle est ce qui permet de voir qu'elle a changé.
            let anciennes = Dictionary(
                store.loadRules().map { ($0.reminderId, $0) },
                uniquingKeysWith: { first, _ in first }
            )

            store.saveRules(rawJson)

            let registry = TriggerRegistry(notifier: notifier, store: store)

            // ⚠️ L'ordre est critique. `UNUserNotificationCenter.add()` échoue
            // **silencieusement** tant que l'autorisation n'est pas accordée :
            // ni erreur, ni journal, juste un rappel qui ne sonnera jamais.
            // La programmation doit donc attendre la réponse de l'utilisateur.
            //
            // Ce défaut a réellement été rencontré : la règle était bien
            // enregistrée, l'interface affichait « 1 règle, écoute active »,
            // et rien ne se déclenchait.
            if rules.isEmpty {
                registry.reconcile(rules: rules)
            } else {
                notifier.requestAuthorizationIfNeeded { _ in
                    // Reconcilie même en cas de refus : les règles restent
                    // programmées côté système et prendront effet si
                    // l'utilisateur accorde l'autorisation plus tard.
                    queue.async { registry.reconcile(rules: rules) }
                }
            }

            let signal = registry.buildSignal(base: .empty(now: Date()))
            var previous = store.previousSatisfaction()

            for rule in rules
            where Baseline.needsReset(previous: anciennes[rule.reminderId], current: rule) {
                previous[rule.reminderId] = Evaluator.areConditionsSatisfied(
                    rule.conditions, rule.combinator, signal
                )
            }

            // Les états des règles disparues sont oubliés, sans quoi le
            // stockage grossirait indéfiniment au fil des suppressions.
            let liveIds = Set(rules.map(\.reminderId))
            previous = previous.filter { liveIds.contains($0.key) }
            store.savePreviousSatisfaction(previous)
        }
    }

    /// Évalue toutes les règles et publie les notifications dues.
    ///
    /// Appelée au retour au premier plan et à chaque signal reçu. Volontairement
    /// globale plutôt que ciblée : une règle en ET peut basculer à cause d'un
    /// signal qui ne lui appartient pas directement.
    static func evaluateAll(signalType: String? = nil) {
        queue.sync {
            let store = RuleSnapshotStore()
            let notifier = Notifier()
            let registry = TriggerRegistry(notifier: notifier, store: store)

            let rules = store.loadRules()
            registry.reconcile(rules: rules)
            notifier.refreshAuthorizationStatus()

            let now = Date()
            if let signalType {
                store.recordSignal(type: signalType, at: IsoTime.format(now))
            }

            let signal = registry.buildSignal(base: .empty(now: now))
            var previous = store.previousSatisfaction()
            let osScheduled = store.osScheduledRuleIds()
            var rulesRemoved = false

            for rule in rules {
                let currentlySatisfied = Evaluator.areConditionsSatisfied(
                    rule.conditions, rule.combinator, signal
                )
                let previouslySatisfied = previous[rule.reminderId] ?? false

                if Evaluator.shouldFire(
                    previouslySatisfied: previouslySatisfied,
                    currentlySatisfied: currentlySatisfied
                ) {
                    // Si le système avait déjà la charge de cette notification,
                    // il l'a délivrée pendant que l'application était fermée :
                    // la republier ferait doublon. On enregistre malgré tout le
                    // déclenchement pour que le JavaScript applique le
                    // comportement post-déclenchement.
                    if !osScheduled.contains(rule.reminderId) {
                        notifier.notifyNow(
                            reminderId: rule.reminderId,
                            body: rule.notificationBody
                        )
                    }

                    store.enqueueFiredEvent(
                        FiredEvent(
                            reminderId: rule.reminderId,
                            firedAt: IsoTime.format(now),
                            triggeringConditionId: triggeringConditionId(rule, signal)
                        )
                    )

                    if rule.deleteAfterFire {
                        store.removeRule(reminderId: rule.reminderId)
                        previous.removeValue(forKey: rule.reminderId)
                        rulesRemoved = true
                        continue
                    }
                }

                previous[rule.reminderId] = currentlySatisfied
            }

            store.savePreviousSatisfaction(previous)

            if rulesRemoved {
                registry.reconcile(rules: store.loadRules())
            }
        }
    }

    static func diagnosticsJson() -> String {
        queue.sync {
            let store = RuleSnapshotStore()
            let rules = store.loadRules()
            let registry = TriggerRegistry(notifier: Notifier(), store: store)
            registry.reconcile(rules: rules)

            let payload: [String: Any] = [
                "activeTriggerTypes": registry.activeTypeNames(),
                "ruleCount": rules.count,
                "lastSignalAt": store.lastSignals(),
                // Sans cette information, un refus de notification rend
                // l'application totalement muette sans le moindre indice.
                "notificationsAuthorized": Notifier.lastKnownAuthorization,
            ]

            return jsonString(from: payload) ?? "{}"
        }
    }

    static func costsJson() -> String {
        let registry = TriggerRegistry(notifier: Notifier(), store: RuleSnapshotStore())
        return jsonString(from: registry.costs()) ?? "{}"
    }

    static func drainFiredEventsJson() -> String {
        queue.sync { RuleSnapshotStore().drainFiredEvents() }
    }

    private static func jsonString(from object: Any) -> String? {
        guard let data = try? JSONSerialization.data(withJSONObject: object) else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    /// Condition à créditer du déclenchement, pour l'écran de diagnostic.
    private static func triggeringConditionId(
        _ rule: RuleSnapshot,
        _ signal: SignalSnapshot
    ) -> String {
        rule.conditions
            .first { Evaluator.isConditionSatisfied($0, signal) }?
            .id ?? ""
    }
}
