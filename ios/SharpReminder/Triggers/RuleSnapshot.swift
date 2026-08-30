import Foundation

/// Une règle active, telle que transmise par la couche JavaScript.
/// Miroir Swift de `RuleSnapshot` dans `src/domain/triggers/snapshot.ts`.
struct RuleSnapshot {
    let reminderId: String
    let notificationBody: String
    let combinator: Combinator
    let conditions: [TriggerCondition]

    static func from(json: [String: Any]) throws -> RuleSnapshot {
        guard let reminderId = json["reminderId"] as? String else {
            throw TriggerParsingError.missingField("reminderId")
        }
        guard let rawCombinator = json["combinator"] as? String,
              let combinator = Combinator(rawValue: rawCombinator)
        else {
            throw TriggerParsingError.missingField("combinator")
        }
        guard let rawConditions = json["conditions"] as? [[String: Any]] else {
            throw TriggerParsingError.missingField("conditions")
        }

        return RuleSnapshot(
            reminderId: reminderId,
            notificationBody: json["notificationBody"] as? String ?? "",
            combinator: combinator,
            conditions: try TriggerCondition.list(from: rawConditions)
        )
    }

    static func list(fromRawJson raw: String) throws -> [RuleSnapshot] {
        guard let data = raw.data(using: .utf8),
              let array = try JSONSerialization.jsonObject(with: data) as? [[String: Any]]
        else {
            throw TriggerParsingError.missingField("(racine du tableau de règles)")
        }
        return try array.map { try from(json: $0) }
    }
}

/// Déclenchement mis en file pour la couche JavaScript.
struct FiredEvent {
    let reminderId: String
    let firedAt: String
    let triggeringConditionId: String

    var asDictionary: [String: Any] {
        [
            "reminderId": reminderId,
            "firedAt": firedAt,
            "triggeringConditionId": triggeringConditionId,
        ]
    }
}
