/**
 * Génération d'identifiants.
 *
 * Les identifiants de rappels et de conditions sont purement locaux : ils ne
 * servent qu'à corréler l'UI, la base et le moteur natif. Aucune exigence
 * cryptographique, mais un UUID v4 reste préférable à un compteur — il permet
 * de dupliquer un rappel ou d'importer une sauvegarde sans risque de collision.
 */

/**
 * Contrat minimal attendu de l'objet `crypto` global.
 *
 * React Native n'inclut pas la lib DOM de TypeScript : le type `Crypto` n'y
 * existe pas. On déclare donc uniquement ce que l'on utilise.
 */
interface CryptoLike {
  randomUUID?: () => string;
}

/**
 * Repli utilisé quand `crypto.randomUUID` est absent (certaines versions de
 * Hermes, et l'environnement de test Jest).
 *
 * Les opérateurs binaires sont l'implémentation canonique d'un UUID v4 :
 * `| 0` tronque vers l'entier, et `(random & 0x3) | 0x8` force les deux bits de
 * poids fort du chiffre « variant » à la valeur exigée par la RFC 4122.
 */
/* eslint-disable no-bitwise */
function randomUuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
/* eslint-enable no-bitwise */

export function newId(): string {
  const globalCrypto = (globalThis as { crypto?: CryptoLike }).crypto;

  if (typeof globalCrypto?.randomUUID === 'function') {
    return globalCrypto.randomUUID();
  }

  return randomUuidV4();
}
