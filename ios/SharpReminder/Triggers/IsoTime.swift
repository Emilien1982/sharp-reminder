import Foundation

/// Lecture des instants ISO 8601 produits par la couche JavaScript.
///
/// `ISO8601DateFormatter` doit être configuré explicitement pour accepter les
/// fractions de seconde : `Date.toISOString()` en produit systématiquement
/// (`2026-08-20T18:00:00.000Z`), alors qu'un sélecteur de date local peut
/// n'émettre qu'une précision à la seconde. Les deux formats sont donc
/// essayés, faute de quoi une moitié des dates serait silencieusement rejetée.
enum IsoTime {

    private static let withFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let withoutFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func parse(_ value: String) -> Date? {
        withFractionalSeconds.date(from: value)
            ?? withoutFractionalSeconds.date(from: value)
    }

    static func format(_ date: Date) -> String {
        withFractionalSeconds.string(from: date)
    }
}
