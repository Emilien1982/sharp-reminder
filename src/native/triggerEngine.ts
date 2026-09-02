import type {
  FiredEvent,
  RuleSnapshot,
  TriggerEngineDiagnostics,
} from '@/domain/triggers/snapshot';
import type { TriggerCost, TriggerType } from '@/domain/triggers/types';
import NativeTriggerEngine from '@/native/NativeTriggerEngine';
import {
  NativePayloadError,
  parseJsonArray,
  parseJsonObject,
  requireBoolean,
  requireNumber,
  requireObject,
  requireStringArray,
} from '@/native/parsing';

/**
 * Enveloppe typée autour du module natif.
 *
 * Seul endroit du projet où le JSON échangé avec le natif est analysé, et seul
 * endroit où sa forme est vérifiée. Le reste de l'application ne manipule que
 * des objets typés, et toute malformation est signalée ici avec le nom du
 * champ fautif plutôt que de provoquer une erreur obscure plus loin.
 */

export async function syncRules(snapshot: RuleSnapshot[]): Promise<void> {
  await NativeTriggerEngine.syncRules(JSON.stringify(snapshot));
}

export async function getTriggerCosts(): Promise<
  Partial<Record<TriggerType, TriggerCost>>
> {
  const raw = await NativeTriggerEngine.getTriggerCosts();
  const parsed = parseJsonObject('getTriggerCosts', raw);

  const costs: Partial<Record<TriggerType, TriggerCost>> = {};
  for (const [type, cost] of Object.entries(parsed)) {
    if (cost !== 'light' && cost !== 'heavy') {
      throw new NativePayloadError(
        'getTriggerCosts',
        type,
        '"light" ou "heavy"',
        cost,
      );
    }
    costs[type as TriggerType] = cost;
  }

  return costs;
}

/**
 * Récupère et vide la file des déclenchements survenus pendant que
 * l'application ne tournait pas.
 */
export async function drainFiredEvents(): Promise<FiredEvent[]> {
  const raw = await NativeTriggerEngine.drainFiredEvents();
  const parsed = parseJsonArray('drainFiredEvents', raw);

  return parsed.map((item, index) => {
    if (typeof item !== 'object' || item === null) {
      throw new NativePayloadError(
        'drainFiredEvents',
        `[${index}]`,
        'un objet',
        item,
      );
    }

    const event = item as Record<string, unknown>;
    for (const field of ['reminderId', 'firedAt', 'triggeringConditionId']) {
      if (typeof event[field] !== 'string') {
        throw new NativePayloadError(
          'drainFiredEvents',
          `[${index}].${field}`,
          'une chaîne',
          event[field],
        );
      }
    }

    return event as unknown as FiredEvent;
  });
}

/**
 * Ce que le natif sait du réseau Wi-Fi courant.
 *
 * Quatre issues et non deux, parce qu'elles appellent quatre messages
 * différents dans l'éditeur : un SSID, aucun réseau, un nom refusé par le
 * système faute de localisation, et une plateforme qui ne sait pas répondre.
 * Les confondre reviendrait à afficher un champ vide sans rien expliquer.
 */
export type CurrentWifi =
  | { status: 'connected'; ssid: string }
  | { status: 'none' }
  | { status: 'masked' }
  | { status: 'unsupported' };

export async function readCurrentWifi(): Promise<CurrentWifi> {
  const raw = await NativeTriggerEngine.readCurrentWifi();
  const parsed = parseJsonObject('readCurrentWifi', raw);
  const status = parsed.status;

  switch (status) {
    case 'connected': {
      const ssid = parsed.ssid;
      if (typeof ssid !== 'string' || ssid.length === 0) {
        throw new NativePayloadError(
          'readCurrentWifi',
          'ssid',
          'une chaîne non vide',
          ssid,
        );
      }
      return { status, ssid };
    }

    case 'none':
    case 'masked':
    case 'unsupported':
      return { status };

    default:
      throw new NativePayloadError(
        'readCurrentWifi',
        'status',
        '"connected", "none", "masked" ou "unsupported"',
        status,
      );
  }
}

export async function getDiagnostics(): Promise<TriggerEngineDiagnostics> {
  const raw = await NativeTriggerEngine.getDiagnostics();
  const parsed = parseJsonObject('getDiagnostics', raw);

  return {
    activeTriggerTypes: requireStringArray(
      'getDiagnostics',
      parsed,
      'activeTriggerTypes',
    ) as TriggerType[],
    ruleCount: requireNumber('getDiagnostics', parsed, 'ruleCount'),
    lastSignalAt: requireObject(
      'getDiagnostics',
      parsed,
      'lastSignalAt',
    ) as TriggerEngineDiagnostics['lastSignalAt'],
    notificationsAuthorized: requireBoolean(
      'getDiagnostics',
      parsed,
      'notificationsAuthorized',
    ),
  };
}
