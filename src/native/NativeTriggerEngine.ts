import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Interface du moteur de déclencheurs natif.
 *
 * Toutes les charges utiles transitent en **JSON sérialisé**, pas en objets
 * structurés. Raison : le générateur de code de React Native ne sait pas
 * représenter une union discriminée, or `TriggerCondition` en est une. Décrire
 * les conditions en types codegen imposerait un objet plat aux champs tous
 * optionnels — on perdrait précisément la garantie que le typage apporte.
 *
 * Le coût est une sérialisation aller-retour, négligeable ici : la
 * synchronisation n'a lieu qu'à l'écriture d'un rappel, pas à chaque signal.
 */
export interface Spec extends TurboModule {
  /**
   * Remplace intégralement le jeu de règles connu du natif.
   *
   * Sémantique volontairement « tout ou rien » plutôt qu'incrémentale : un
   * remplacement complet ne peut pas désynchroniser les deux côtés, là où une
   * suite d'ajouts et de retraits finirait par diverger après un crash ou une
   * mise à jour manquée.
   *
   * @param snapshotJson tableau JSON de règles actives — voir `RuleSnapshot`.
   */
  syncRules(snapshotJson: string): Promise<void>;

  /**
   * Coût énergétique de chaque type de déclencheur, **sur cette plateforme**.
   *
   * @returns objet JSON `{ "bluetooth": "light", "location": "heavy", ... }`
   */
  getTriggerCosts(): Promise<string>;

  /**
   * Récupère et vide la file des déclenchements survenus pendant que
   * l'application ne tournait pas.
   *
   * @returns tableau JSON de `FiredEvent`.
   */
  drainFiredEvents(): Promise<string>;

  /**
   * Réseau Wi-Fi auquel le téléphone est rattaché à cet instant.
   *
   * Sert au bouton « Utiliser le réseau actuel » de l'éditeur. Renvoie un objet
   * JSON `{ "status": "connected" | "none" | "masked", "ssid"?: string }`
   * plutôt qu'une chaîne nullable : les trois issues appellent trois messages
   * différents, et un champ vide sans explication serait la pire des trois.
   *
   * `masked` signifie que le système refuse le nom du réseau — permission de
   * localisation retirée, ou service de position coupé.
   */
  readCurrentWifi(): Promise<string>;

  /**
   * État interne du moteur, pour l'écran de diagnostic.
   *
   * @returns objet JSON `TriggerEngineDiagnostics`.
   */
  getDiagnostics(): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('TriggerEngine');
