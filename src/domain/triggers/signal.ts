/**
 * État des signaux surveillés, à un instant donné.
 *
 * Cet objet est construit par le natif à chaque événement système reçu, puis
 * soumis à l'évaluateur. Il décrit le monde *maintenant* — pas ce qui vient de
 * se produire.
 *
 * C'est la clé qui rend le ET possible : deux événements ne surviennent jamais
 * au même instant, mais deux états peuvent parfaitement être vrais ensemble.
 */
export interface SignalSnapshot {
  /** Instant de l'évaluation, ISO 8601. */
  now: string;

  /** SSID du réseau Wi-Fi connecté, ou `null` si aucun. */
  wifiSsid: string | null;

  /**
   * Identifiants des appareils Bluetooth actuellement connectés.
   * Adresse MAC sur Android, UUID d'appareil sur iOS.
   */
  connectedBluetoothDeviceIds: readonly string[];

  /**
   * Identifiants des *conditions* de lieu dont la zone est actuellement
   * occupée.
   *
   * On transporte des identifiants de condition et non une position
   * géographique : les API de géorepérage des deux systèmes ne fournissent pas
   * de position continue, seulement des franchissements par zone surveillée.
   * C'est donc le natif qui tient à jour la liste des zones occupées.
   */
  insideLocationConditionIds: readonly string[];
}

/** État neutre : rien de connecté, aucune zone occupée. */
export function emptySignalSnapshot(now: string): SignalSnapshot {
  return {
    now,
    wifiSsid: null,
    connectedBluetoothDeviceIds: [],
    insideLocationConditionIds: [],
  };
}
