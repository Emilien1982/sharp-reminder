import Foundation

/// Conditions de déclenchement, miroir Swift de `src/domain/triggers/types.ts`
/// et de `TriggerCondition.kt`.
///
/// Le format JSON est le contrat entre les trois couches : toute évolution du
/// type TypeScript doit être répercutée ici et côté Kotlin.
/// `Equatable` est nécessaire à `Baseline`, qui compare l'ancienne et la
/// nouvelle version d'une règle pour savoir si elle a changé de sens. La
/// conformité est synthétisée : toutes les valeurs associées le sont déjà.
enum TriggerCondition: Equatable {
    case dateTime(id: String, at: Date, until: Date?)
    case wifi(id: String, ssid: String, onConnect: Bool)
    case bluetooth(id: String, deviceId: String, deviceName: String, onConnect: Bool)
    case location(id: String, latitude: Double, longitude: Double, radiusMeters: Double, onEnter: Bool)

    var id: String {
        switch self {
        case let .dateTime(id, _, _): return id
        case let .wifi(id, _, _): return id
        case let .bluetooth(id, _, _, _): return id
        case let .location(id, _, _, _, _): return id
        }
    }

    var triggerType: TriggerType {
        switch self {
        case .dateTime: return .dateTime
        case .wifi: return .wifi
        case .bluetooth: return .bluetooth
        case .location: return .location
        }
    }
}

enum TriggerType: String, CaseIterable {
    case dateTime = "datetime"
    case wifi
    case bluetooth
    case location
}

/// Coût énergétique d'un type de déclencheur, **sur iOS**.
///
/// Volontairement porté par la plateforme : le Bluetooth appairé est gratuit
/// sur Android (broadcast système) mais impose ici un scan BLE coûteux, et
/// CoreBluetooth ne voit même pas les appareils appairés classiques.
enum TriggerCost: String {
    case light
    case heavy
}

enum TriggerParsingError: Error, LocalizedError {
    case missingField(String)
    case unknownTriggerType(String)
    case invalidDate(String)

    var errorDescription: String? {
        switch self {
        case let .missingField(field):
            return "Champ manquant ou de type incorrect : \(field)"
        case let .unknownTriggerType(type):
            return "Type de déclencheur non géré : \(type)"
        case let .invalidDate(value):
            return "Date ISO 8601 illisible : \(value)"
        }
    }
}

extension TriggerCondition {

    /// Lit une condition depuis sa représentation JSON.
    ///
    /// Lève une erreur sur un type inconnu plutôt que de l'ignorer : un
    /// déclencheur non géré doit faire échouer la synchronisation bruyamment.
    /// Un rappel qui ne sonne pas est le pire défaut possible ici, et le plus
    /// difficile à remarquer.
    static func from(json: [String: Any]) throws -> TriggerCondition {
        guard let id = json["id"] as? String else {
            throw TriggerParsingError.missingField("id")
        }
        guard let type = json["type"] as? String else {
            throw TriggerParsingError.missingField("type")
        }

        switch type {
        case "datetime":
            guard let raw = json["at"] as? String else {
                throw TriggerParsingError.missingField("at")
            }
            guard let date = IsoTime.parse(raw) else {
                throw TriggerParsingError.invalidDate(raw)
            }
            // Un `until` absent doit rester absent : la fenêtre n'a alors
            // pas de borne haute, ce qui est le format antérieur.
            var until: Date?
            if let rawUntil = json["until"] as? String {
                guard let parsed = IsoTime.parse(rawUntil) else {
                    throw TriggerParsingError.invalidDate(rawUntil)
                }
                until = parsed
            }

            return .dateTime(id: id, at: date, until: until)

        case "wifi":
            guard let ssid = json["ssid"] as? String else {
                throw TriggerParsingError.missingField("ssid")
            }
            return .wifi(
                id: id,
                ssid: ssid,
                onConnect: (json["direction"] as? String) == "connect"
            )

        case "bluetooth":
            guard let deviceId = json["deviceId"] as? String else {
                throw TriggerParsingError.missingField("deviceId")
            }
            return .bluetooth(
                id: id,
                deviceId: deviceId,
                deviceName: json["deviceName"] as? String ?? "",
                onConnect: (json["direction"] as? String) == "connect"
            )

        case "location":
            guard let latitude = json["latitude"] as? Double,
                  let longitude = json["longitude"] as? Double,
                  let radius = json["radiusMeters"] as? Double
            else {
                throw TriggerParsingError.missingField("latitude/longitude/radiusMeters")
            }
            return .location(
                id: id,
                latitude: latitude,
                longitude: longitude,
                radiusMeters: radius,
                onEnter: (json["direction"] as? String) == "enter"
            )

        default:
            throw TriggerParsingError.unknownTriggerType(type)
        }
    }

    static func list(from array: [[String: Any]]) throws -> [TriggerCondition] {
        try array.map { try from(json: $0) }
    }
}
