import Foundation
import UserNotifications

/// Publication des notifications de rappel sur iOS.
///
/// V1 : notification simple, sans action rapide. La construction du contenu est
/// isolée pour que l'ajout futur d'actions « Fait » et « Reporter » (§2 du
/// brief) ne touche qu'un seul endroit.
final class Notifier {

    private let center: UNUserNotificationCenter

    init(center: UNUserNotificationCenter = .current()) {
        self.center = center
    }

    /// Demande l'autorisation si elle n'a jamais été sollicitée.
    ///
    /// Appelée lors de la première synchronisation comportant des règles, et
    /// non au lancement : la permission est ainsi demandée au moment où
    /// l'utilisateur crée son premier rappel, conformément au principe de
    /// permission contextuelle (§4 du brief).
    func requestAuthorizationIfNeeded(completion: @escaping (Bool) -> Void) {
        center.getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .notDetermined:
                self.center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
                    self.cache(authorized: granted)
                    completion(granted)
                }
            case .denied:
                self.cache(authorized: false)
                completion(false)
            default:
                self.cache(authorized: true)
                completion(true)
            }
        }
    }

    /// Rafraîchit l'état mémorisé sans rien demander à l'utilisateur.
    ///
    /// L'autorisation peut être révoquée depuis les Réglages à tout moment,
    /// sans que l'application en soit informée.
    func refreshAuthorizationStatus() {
        center.getNotificationSettings { settings in
            self.cache(authorized: settings.authorizationStatus == .authorized
                || settings.authorizationStatus == .provisional)
        }
    }

    /// L'état est mis en cache parce que le diagnostic est synchrone alors que
    /// `getNotificationSettings` ne l'est pas. Attendre la réponse au moyen
    /// d'un sémaphore risquerait un interblocage sur la file du moteur.
    private func cache(authorized: Bool) {
        UserDefaults.standard.set(authorized, forKey: Notifier.authorizationKey)
    }

    static let authorizationKey = "sharpReminder.notificationsAuthorized"

    static var lastKnownAuthorization: Bool {
        UserDefaults.standard.bool(forKey: authorizationKey)
    }

    private func content(body: String) -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        content.title = NSLocalizedString(
            "notification_title",
            value: "Rappel",
            comment: "Titre de la notification de rappel"
        )
        content.body = body
        content.sound = .default
        return content
    }

    /// Publie immédiatement une notification.
    func notifyNow(reminderId: String, body: String) {
        let request = UNNotificationRequest(
            identifier: "\(reminderId)#immediate",
            content: content(body: body),
            trigger: nil
        )
        center.add(request)
    }

    /// Confie au système la publication d'une notification à une date donnée.
    ///
    /// Le système la délivre même application fermée, sans réveiller le code :
    /// c'est ce qui rend le déclencheur date/heure fiable sur iOS.
    func schedule(reminderId: String, body: String, at date: Date) {
        let components = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute, .second],
            from: date
        )

        let request = UNNotificationRequest(
            identifier: scheduledIdentifier(for: reminderId),
            content: content(body: body),
            trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        )
        center.add(request)
    }

    func cancelScheduled(reminderIds: [String]) {
        center.removePendingNotificationRequests(
            withIdentifiers: reminderIds.map(scheduledIdentifier(for:))
        )
    }

    func cancelAllScheduled() {
        center.removeAllPendingNotificationRequests()
    }

    private func scheduledIdentifier(for reminderId: String) -> String {
        "\(reminderId)#scheduled"
    }
}
