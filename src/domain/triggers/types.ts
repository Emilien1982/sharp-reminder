/**
 * Modèle des déclencheurs.
 *
 * Ce fichier définit le contrat central de l'application : il est consommé par
 * l'UI, sérialisé vers SQLite, puis transmis tel quel au moteur natif
 * (Kotlin / Swift). Toute évolution ici a des répercussions sur les trois
 * couches — voir docs/adr/0002-moteur-de-triggers-natif.md.
 */

/** Types de déclencheurs supportés en V1. */
export const TRIGGER_TYPES = [
  'datetime',
  'wifi',
  'bluetooth',
  'location',
] as const;

export type TriggerType = (typeof TRIGGER_TYPES)[number];

/**
 * Coût énergétique d'un type de déclencheur.
 *
 * Volontairement absent de ce fichier sous forme de constante : le coût dépend
 * de la plateforme (le Bluetooth appairé est gratuit sur Android via un
 * broadcast système, coûteux sur iOS où il impose un scan BLE). La valeur est
 * donc fournie à l'exécution par le module natif. Voir §3 du brief.
 */
export type TriggerCost = 'light' | 'heavy';

/** Sens de franchissement, pour les déclencheurs qui en ont un. */
export type EdgeDirection = 'enter' | 'exit';

/** Sens de connexion, pour les déclencheurs d'appairage. */
export type ConnectionDirection = 'connect' | 'disconnect';

interface BaseCondition {
  /** Identifiant stable, utilisé pour l'édition et le diff avec le natif. */
  id: string;
}

export interface DateTimeCondition extends BaseCondition {
  type: 'datetime';
  /** Date et heure de déclenchement, au format ISO 8601 avec fuseau. */
  at: string;
}

export interface WifiCondition extends BaseCondition {
  type: 'wifi';
  /** SSID du réseau, tel que rapporté par le système. */
  ssid: string;
  direction: ConnectionDirection;
}

export interface BluetoothCondition extends BaseCondition {
  type: 'bluetooth';
  /** Adresse MAC sur Android, UUID d'appareil sur iOS. */
  deviceId: string;
  /** Nom lisible, conservé pour l'affichage même si l'appareil est absent. */
  deviceName: string;
  direction: ConnectionDirection;
}

export interface LocationCondition extends BaseCondition {
  type: 'location';
  latitude: number;
  longitude: number;
  radiusMeters: number;
  direction: EdgeDirection;
}

/**
 * Union discriminée de toutes les conditions.
 *
 * Ajouter un type de déclencheur (météo, cycle lunaire…) consiste à ajouter un
 * membre ici : TypeScript signalera alors tous les `switch` à compléter, grâce
 * à `noFallthroughCasesInSwitch` et aux vérifications d'exhaustivité.
 */
export type TriggerCondition =
  | DateTimeCondition
  | WifiCondition
  | BluetoothCondition
  | LocationCondition;

/** Logique de combinaison entre plusieurs conditions d'un même rappel. */
export type Combinator = 'AND' | 'OR';

/**
 * Garde d'exhaustivité : à placer dans la branche `default` des `switch` sur
 * `TriggerCondition`. Le code ne compile plus si un type n'est pas traité.
 */
export function assertNeverCondition(condition: never): never {
  throw new Error(
    `Type de déclencheur non géré : ${JSON.stringify(condition)}`,
  );
}
