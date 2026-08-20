import Foundation

/// Déclencheur date et heure sur iOS.
///
/// Fonctionne différemment de son équivalent Android, et c'est délibéré. Là où
/// Android réveille l'application via `AlarmManager` pour qu'elle évalue, iOS
/// permet de **confier la notification au système** : `UNCalendarNotificationTrigger`
/// la délivre à l'heure dite sans réveiller le moindre code, application tuée.
/// C'est plus fiable que tout ce qu'on pourrait bâtir soi-même.
///
/// Cette délégation n'est possible que si la date suffit à satisfaire la règle
/// à elle seule. Pour une règle en ET combinant une date et un autre signal,
/// le système notifierait sans vérifier les autres conditions : ces règles sont
/// donc évaluées au réveil de l'application, avec le délai que cela implique.
/// C'est une limite iOS assumée, documentée dans CLAUDE.md.
final class DateTimeTriggerModule: TriggerModule {

    let type: TriggerType = .dateTime
    let cost: TriggerCost = .light

    private let notifier: Notifier
    private let store: RuleSnapshotStore

    init(notifier: Notifier, store: RuleSnapshotStore) {
        self.notifier = notifier
        self.store = store
    }

    func start(rules: [RuleSnapshot]) {
        // Reprogrammation complète à chaque synchronisation : idempotent
        // puisque l'identifiant dérive de celui du rappel, et aucune
        // notification orpheline ne peut subsister après une modification.
        notifier.cancelAllScheduled()

        var osScheduled = Set<String>()

        for rule in rules {
            guard let date = soleSufficientDate(in: rule) else { continue }

            // Une échéance déjà passée n'est pas programmée : le système
            // notifierait immédiatement, faisant sonner un rappel dont l'heure
            // est révolue.
            guard date > Date() else { continue }

            notifier.schedule(
                reminderId: rule.reminderId,
                body: rule.notificationBody,
                at: date
            )
            osScheduled.insert(rule.reminderId)
        }

        store.saveOsScheduledRuleIds(osScheduled)
    }

    func stop() {
        notifier.cancelAllScheduled()
        store.saveOsScheduledRuleIds([])
    }

    /// Date suffisant à elle seule à déclencher la règle, s'il en existe une.
    ///
    /// En OU, n'importe quelle date suffit — la plus proche est retenue.
    /// En ET, seule une règle réduite à cette unique condition qualifie.
    private func soleSufficientDate(in rule: RuleSnapshot) -> Date? {
        let dates = rule.conditions.compactMap { condition -> Date? in
            if case let .dateTime(_, at) = condition { return at }
            return nil
        }

        guard !dates.isEmpty else { return nil }

        switch rule.combinator {
        case .or:
            return dates.min()
        case .and:
            return rule.conditions.count == 1 ? dates.first : nil
        }
    }
}
