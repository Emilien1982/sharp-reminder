import XCTest

// Pas d'`@testable import SharpReminder` : la cible de test n'a pas d'hôte
// applicatif et recompile directement les fichiers de logique pure. Les types
// sont donc déjà dans son propre module. Un hôte imposerait de démarrer React
// Native pour tester une fonction pure — lent et fragile pour aucun bénéfice.

/// Vérifie l'évaluateur Swift sur `shared/fixtures/evaluator-cases.json`, le
/// même fichier que consomment Jest et JUnit.
///
/// C'est le garde-fou central de l'architecture : l'évaluateur existe en trois
/// exemplaires, et rien d'autre n'empêcherait leurs comportements de diverger.
final class EvaluatorTests: XCTestCase {

    private func loadFixtures() throws -> [String: Any] {
        guard let url = Bundle(for: type(of: self))
            .url(forResource: "evaluator-cases", withExtension: "json")
        else {
            XCTFail(
                "evaluator-cases.json absent du bundle de test. "
                    + "Vérifier la phase « Copy Bundle Resources » de la cible."
            )
            return [:]
        }

        let data = try Data(contentsOf: url)
        return try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any]
        )
    }

    private func signal(from json: [String: Any]) throws -> SignalSnapshot {
        let rawNow = try XCTUnwrap(json["now"] as? String)
        let now = try XCTUnwrap(IsoTime.parse(rawNow), "Date illisible : \(rawNow)")

        return SignalSnapshot(
            now: now,
            wifiSsid: json["wifiSsid"] as? String,
            connectedBluetoothDeviceIds: Set(
                json["connectedBluetoothDeviceIds"] as? [String] ?? []
            ),
            insideLocationConditionIds: Set(
                json["insideLocationConditionIds"] as? [String] ?? []
            )
        )
    }

    func testFixturesAreLoaded() throws {
        // Sans ce garde-fou, une ressource absente donnerait zéro cas et tous
        // les tests passeraient sans rien vérifier.
        let cases = try XCTUnwrap(loadFixtures()["satisfactionCases"] as? [[String: Any]])
        XCTAssertGreaterThan(cases.count, 20, "Trop peu de cas chargés")
    }

    func testSatisfactionCases() throws {
        let cases = try XCTUnwrap(loadFixtures()["satisfactionCases"] as? [[String: Any]])
        var failures: [String] = []

        for testCase in cases {
            let name = testCase["name"] as? String ?? "(sans nom)"
            let rawConditions = try XCTUnwrap(testCase["conditions"] as? [[String: Any]])
            let conditions = try TriggerCondition.list(from: rawConditions)
            let combinator = try XCTUnwrap(
                Combinator(rawValue: try XCTUnwrap(testCase["combinator"] as? String))
            )
            let snapshot = try signal(from: try XCTUnwrap(testCase["signal"] as? [String: Any]))
            let expected = try XCTUnwrap(testCase["expected"] as? Bool)

            let actual = Evaluator.areConditionsSatisfied(conditions, combinator, snapshot)
            if actual != expected {
                failures.append("  ✗ \(name) → attendu \(expected), obtenu \(actual)")
            }
        }

        // On collecte tous les échecs avant d'échouer : voir les cas divergents
        // d'un coup vaut mieux que de les découvrir un par un.
        XCTAssertTrue(
            failures.isEmpty,
            "Cas divergents entre Swift et la référence partagée :\n"
                + failures.joined(separator: "\n")
        )
    }

    func testRisingEdgeCases() throws {
        let cases = try XCTUnwrap(loadFixtures()["risingEdgeCases"] as? [[String: Any]])

        for testCase in cases {
            let name = testCase["name"] as? String ?? "(sans nom)"
            XCTAssertEqual(
                Evaluator.shouldFire(
                    previouslySatisfied: try XCTUnwrap(testCase["previous"] as? Bool),
                    currentlySatisfied: try XCTUnwrap(testCase["current"] as? Bool)
                ),
                try XCTUnwrap(testCase["expected"] as? Bool),
                name
            )
        }
    }

    func testUnknownTriggerTypeThrows() {
        XCTAssertThrowsError(
            try TriggerCondition.from(json: ["id": "x", "type": "meteo"])
        ) { error in
            guard case TriggerParsingError.unknownTriggerType = error else {
                XCTFail("Un type inconnu doit lever unknownTriggerType, reçu \(error)")
                return
            }
        }
    }

    /// Les deux formes d'ISO 8601 produites par la couche JavaScript doivent
    /// être acceptées : `Date.toISOString()` inclut toujours les millisecondes,
    /// un sélecteur de date local peut n'émettre qu'une précision à la seconde.
    func testIsoTimeAcceptsBothPrecisions() throws {
        XCTAssertNotNil(IsoTime.parse("2026-08-20T18:00:00Z"))
        XCTAssertNotNil(IsoTime.parse("2026-08-20T18:00:00.000Z"))
        XCTAssertNotNil(IsoTime.parse("2026-08-20T20:00:00+02:00"))

        let withOffset = try XCTUnwrap(IsoTime.parse("2026-08-20T20:00:00+02:00"))
        let asUtc = try XCTUnwrap(IsoTime.parse("2026-08-20T18:00:00Z"))
        XCTAssertEqual(withOffset, asUtc, "Le décalage horaire doit être résolu")
    }
}
