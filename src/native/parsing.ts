/**
 * Validation des charges utiles reçues du natif.
 *
 * Le module natif échange du JSON brut : rien ne garantit à la compilation que
 * ce qui arrive a la forme attendue. Un simple `JSON.parse(...) as T` reporte
 * la défaillance loin de sa cause — une valeur mal typée traverse la frontière
 * et provoque une erreur incompréhensible plusieurs appels plus tard.
 *
 * Cas réel rencontré : `org.json` sur Android sérialise une `List` Kotlin en
 * *chaîne* `"[datetime]"` plutôt qu'en tableau JSON. Côté JavaScript, la
 * chaîne possède bien une propriété `length`, la vérification naïve passait,
 * et l'échec ne survenait qu'à l'appel de `.join()` sous la forme
 * « undefined is not a function ».
 *
 * Ces fonctions transforment ce genre de défaut en message explicite,
 * mentionnant le champ fautif et la valeur réellement reçue.
 */

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `tableau(${value.length})`;
  return typeof value;
}

export class NativePayloadError extends Error {
  constructor(
    source: string,
    field: string,
    expected: string,
    received: unknown,
  ) {
    super(
      `Réponse invalide du moteur natif (${source}) : le champ "${field}" ` +
        `devrait être ${expected}, reçu ${describe(received)} — ` +
        `${JSON.stringify(received)?.slice(0, 120)}`,
    );
    this.name = 'NativePayloadError';
  }
}

export function parseJsonObject(
  source: string,
  raw: string,
): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new NativePayloadError(source, '(racine)', 'du JSON valide', raw);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new NativePayloadError(source, '(racine)', 'un objet', parsed);
  }

  return parsed as Record<string, unknown>;
}

export function parseJsonArray(source: string, raw: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new NativePayloadError(source, '(racine)', 'du JSON valide', raw);
  }

  if (!Array.isArray(parsed)) {
    throw new NativePayloadError(source, '(racine)', 'un tableau', parsed);
  }

  return parsed;
}

export function requireStringArray(
  source: string,
  container: Record<string, unknown>,
  field: string,
): string[] {
  const value = container[field];

  if (!Array.isArray(value)) {
    throw new NativePayloadError(source, field, 'un tableau', value);
  }
  if (!value.every(item => typeof item === 'string')) {
    throw new NativePayloadError(source, field, 'un tableau de chaînes', value);
  }

  return value;
}

export function requireNumber(
  source: string,
  container: Record<string, unknown>,
  field: string,
): number {
  const value = container[field];

  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new NativePayloadError(source, field, 'un nombre', value);
  }

  return value;
}

export function requireBoolean(
  source: string,
  container: Record<string, unknown>,
  field: string,
): boolean {
  const value = container[field];

  if (typeof value !== 'boolean') {
    throw new NativePayloadError(source, field, 'un booléen', value);
  }

  return value;
}

export function requireObject(
  source: string,
  container: Record<string, unknown>,
  field: string,
): Record<string, unknown> {
  const value = container[field];

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new NativePayloadError(source, field, 'un objet', value);
  }

  return value as Record<string, unknown>;
}
