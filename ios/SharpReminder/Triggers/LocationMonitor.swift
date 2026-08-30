import CoreLocation
import Foundation

/// Surveillance des zones géographiques sur iOS.
///
/// Singleton, et ce n'est pas une facilité : iOS livre les franchissements de
/// région en **réveillant l'application en arrière-plan** et en appelant le
/// délégué du `CLLocationManager`. Ce gestionnaire doit donc exister pour toute
/// la durée de vie du processus, dès le lancement — un objet créé à la demande
/// serait détruit avant que le système n'ait quoi que ce soit à livrer. D'où
/// l'activation depuis `AppDelegate`.
///
/// Équivalent combiné de `GeofenceState.kt` et `GeofenceReceiver.kt`, qu'Android
/// peut se permettre de séparer parce qu'un `BroadcastReceiver` est instancié
/// par le système à la volée.
final class LocationMonitor: NSObject, CLLocationManagerDelegate {

    static let shared = LocationMonitor()

    /// Limite matérielle d'iOS : au-delà, `startMonitoring` échoue en silence.
    static let maxRegions = 20

    private let manager = CLLocationManager()
    private let defaults: UserDefaults = .standard

    private override init() {
        super.init()
        manager.delegate = self
        manager.allowsBackgroundLocationUpdates = false
    }

    /// À appeler au lancement, avant toute chose.
    func activate() {
        // Le simple fait d'assigner le délégué suffit à recevoir les
        // franchissements survenus pendant que l'application était fermée :
        // iOS la relance et rejoue l'événement.
        manager.delegate = self
    }

    // MARK: - Autorisation

    var isAlwaysAuthorized: Bool {
        manager.authorizationStatus == .authorizedAlways
    }

    /// La surveillance de régions exige « Toujours », pas « Quand l'app est
    /// ouverte » : sans elle, aucune zone n'est surveillée application fermée.
    func requestAuthorization() {
        onMain { [self] in
            switch manager.authorizationStatus {
            case .notDetermined:
                manager.requestWhenInUseAuthorization()
            case .authorizedWhenInUse:
                manager.requestAlwaysAuthorization()
            default:
                break
            }
        }
    }

    /// Exécute sur le thread principal, sans s'y replanifier si l'on y est déjà.
    ///
    /// `CLLocationManager` doit être piloté depuis un thread doté d'une boucle
    /// d'exécution active. Or `start(rules:)` est appelé par le registre depuis
    /// la file série privée de `TriggerEngine` : sans ce détour, les rappels du
    /// délégué peuvent n'être jamais livrés, de façon intermittente et
    /// impossible à reproduire — on l'attribuerait au GPS.
    private func onMain(_ work: @escaping () -> Void) {
        if Thread.isMainThread {
            work()
        } else {
            DispatchQueue.main.async(execute: work)
        }
    }

    // MARK: - Zones

    /// Remplace l'ensemble des zones surveillées.
    ///
    /// Remplacement complet plutôt que différentiel : idempotent, et aucune
    /// zone orpheline ne peut survivre à une modification. L'état des zones
    /// conservées n'est pas effacé — c'est la même précaution qu'Android, où
    /// l'effacer jetait l'information qu'un franchissement venait d'apporter.
    func replaceRegions(_ conditions: [TriggerCondition]) {
        let zones = conditions.compactMap { condition -> CLCircularRegion? in
            guard case let .location(id, latitude, longitude, radius, _) = condition else {
                return nil
            }
            let region = CLCircularRegion(
                center: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
                radius: radius,
                identifier: id
            )
            // Les deux sens sont toujours surveillés, quelle que soit la
            // direction demandée : l'évaluateur raisonne sur un état, et une
            // condition « je suis hors de la zone » a besoin de savoir qu'on y
            // est entré pour constater la sortie ensuite.
            region.notifyOnEntry = true
            region.notifyOnExit = true
            return region
        }

        let retained = Array(zones.prefix(Self.maxRegions))
        if zones.count > Self.maxRegions {
            NSLog(
                "[SharpReminder] %d zones demandées, iOS en accepte %d : les suivantes sont ignorées.",
                zones.count, Self.maxRegions
            )
        }

        keepInside(only: Set(retained.map(\.identifier)))

        onMain { [self] in
            for region in manager.monitoredRegions {
                manager.stopMonitoring(for: region)
            }

            guard isAlwaysAuthorized else {
                // Sans autorisation permanente, `startMonitoring` ne produit
                // rien. On s'arrête plutôt que de laisser croire à une
                // surveillance qui n'existe pas.
                NSLog(
                    "[SharpReminder] Autorisation « Toujours » absente : aucune zone surveillée."
                )
                return
            }

            for region in retained {
                manager.startMonitoring(for: region)
                // iOS sait répondre à « suis-je dans cette zone ? »,
                // contrairement à Android. La réponse arrive par
                // `didDetermineState`.
                manager.requestState(for: region)
            }
        }
    }

    /// ⚠️ Les zones occupées ne sont **pas** oubliées : seule la surveillance
    /// s'arrête.
    ///
    /// Tout jeter a produit un faux déclenchement. Depuis que le moteur retire
    /// du miroir une règle qui vient de sonner, cet arrêt survient à chaque
    /// déclenchement de la dernière règle de lieu. Au réarmement, la ligne de
    /// base était posée sur un état vide — donc « hors de la zone » — puis
    /// `requestState` répondait « dedans » : une transition surgissait sans que
    /// rien n'ait été franchi, et le rappel sonnait aussitôt. `requestState`
    /// rectifie de toute façon les deux sens au prochain enregistrement, cette
    /// connaissance ne peut donc pas rester fausse longtemps.
    func stopAll() {
        onMain { [self] in
            for region in manager.monitoredRegions {
                manager.stopMonitoring(for: region)
            }
        }
    }

    // MARK: - État des zones occupées

    var insideConditionIds: Set<String> {
        Set(defaults.stringArray(forKey: Keys.inside) ?? [])
    }

    /// Écrit l'ensemble et indique s'il a réellement changé.
    ///
    /// Le booléen n'est pas un raffinement : `evaluateAll` réaligne les écoutes,
    /// ce qui relance `startMonitoring` puis `requestState`, ce qui rappelle
    /// `didDetermineState`. Évaluer inconditionnellement crée une **récursion
    /// infinie** qui asphyxie l'application — observé, écran blanc à la clé.
    /// N'évaluer que sur changement effectif rompt la boucle au second tour.
    @discardableResult
    private func setInside(_ ids: Set<String>) -> Bool {
        guard ids != insideConditionIds else { return false }
        defaults.set(Array(ids), forKey: Keys.inside)
        return true
    }

    private func keepInside(only ids: Set<String>) {
        setInside(insideConditionIds.intersection(ids))
    }

    // MARK: - Délégué

    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        guard setInside(insideConditionIds.union([region.identifier])) else { return }
        TriggerEngine.evaluateAll(signalType: TriggerType.location.rawValue)
    }

    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        guard setInside(insideConditionIds.subtracting([region.identifier])) else { return }
        TriggerEngine.evaluateAll(signalType: TriggerType.location.rawValue)
    }

    /// Réponse à `requestState` : établit l'état initial, puis évalue.
    ///
    /// L'évaluation est délibérée. Découvrir qu'une zone est occupée est une
    /// information sur le monde, pas la création d'une règle : si elle rend la
    /// règle vraie, le rappel doit sonner. Un rappel « quand je suis au
    /// magasin » créé au magasin doit partir — c'est son objet même.
    ///
    /// La protection contre un déclenchement à la création reste assurée par la
    /// ligne de base ordinaire : « préviens-moi quand je quitte la maison »,
    /// créé à la maison, a sa condition fausse et ne part pas.
    func locationManager(
        _ manager: CLLocationManager,
        didDetermineState state: CLRegionState,
        for region: CLRegion
    ) {
        let changed: Bool
        switch state {
        case .inside:
            changed = setInside(insideConditionIds.union([region.identifier]))
        case .outside:
            changed = setInside(insideConditionIds.subtracting([region.identifier]))
        case .unknown:
            return
        @unknown default:
            return
        }

        // Sans cette garde, la boucle décrite dans `setInside` se referme.
        guard changed else { return }
        TriggerEngine.evaluateAll(signalType: TriggerType.location.rawValue)
    }

    func locationManager(
        _ manager: CLLocationManager,
        monitoringDidFailFor region: CLRegion?,
        withError error: Error
    ) {
        // Journalisé plutôt qu'ignoré : un échec de surveillance signifie des
        // rappels qui ne sonneront pas, et rien d'autre ne le dirait.
        NSLog(
            "[SharpReminder] Surveillance impossible pour %@ : %@",
            region?.identifier ?? "(zone inconnue)",
            error.localizedDescription
        )
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        // Passer de « quand l'app est ouverte » à « toujours » doit relancer la
        // surveillance : les zones avaient été refusées jusque-là.
        if isAlwaysAuthorized {
            TriggerEngine.evaluateAll()
        }
    }

    private enum Keys {
        static let inside = "sharp_reminder_inside_location_condition_ids"
    }
}
