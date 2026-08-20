import NativeTriggerEngine from '@/native/NativeTriggerEngine';
import { drainFiredEvents, getDiagnostics } from '@/native/triggerEngine';

/**
 * Ces tests reproduisent des malformations réellement observées à la frontière
 * natif → JavaScript, et vérifient qu'elles produisent un message exploitable
 * plutôt qu'une erreur obscure survenant plus loin dans le code.
 */

const mocked = NativeTriggerEngine as jest.Mocked<typeof NativeTriggerEngine>;

describe('getDiagnostics', () => {
  it('analyse une réponse bien formée', async () => {
    mocked.getDiagnostics.mockResolvedValueOnce(
      '{"activeTriggerTypes":["datetime"],"ruleCount":2,"lastSignalAt":{"datetime":"2026-08-20T12:00:00Z"},"notificationsAuthorized":true}',
    );

    await expect(getDiagnostics()).resolves.toEqual({
      activeTriggerTypes: ['datetime'],
      ruleCount: 2,
      lastSignalAt: { datetime: '2026-08-20T12:00:00Z' },
      notificationsAuthorized: true,
    });
  });

  it('rejette une liste sérialisée en chaîne au lieu d’un tableau', async () => {
    // Défaut réellement rencontré : org.json sur Android convertit une List
    // Kotlin en chaîne. La chaîne possède un `length`, si bien qu'une
    // vérification naïve la laissait passer avant d'échouer sur `.join()`.
    mocked.getDiagnostics.mockResolvedValueOnce(
      '{"activeTriggerTypes":"[datetime]","ruleCount":1,"lastSignalAt":{},"notificationsAuthorized":true}',
    );

    await expect(getDiagnostics()).rejects.toThrow(
      /"activeTriggerTypes" devrait être un tableau, reçu string/,
    );
  });

  it('rejette un compteur manquant', async () => {
    mocked.getDiagnostics.mockResolvedValueOnce(
      '{"activeTriggerTypes":[],"lastSignalAt":{},"notificationsAuthorized":true}',
    );

    await expect(getDiagnostics()).rejects.toThrow(
      /"ruleCount" devrait être un nombre/,
    );
  });

  it('rejette une autorisation de notification manquante', async () => {
    // Ce champ signale le seul mode de défaillance totalement muet de
    // l'application : les rappels se déclenchent, rien ne s'affiche.
    mocked.getDiagnostics.mockResolvedValueOnce(
      '{"activeTriggerTypes":[],"ruleCount":0,"lastSignalAt":{}}',
    );

    await expect(getDiagnostics()).rejects.toThrow(
      /"notificationsAuthorized" devrait être un booléen/,
    );
  });

  it('rejette une réponse qui n’est pas du JSON', async () => {
    mocked.getDiagnostics.mockResolvedValueOnce('pas du json');

    await expect(getDiagnostics()).rejects.toThrow(/du JSON valide/);
  });
});

describe('drainFiredEvents', () => {
  it('analyse une file bien formée', async () => {
    mocked.drainFiredEvents.mockResolvedValueOnce(
      '[{"reminderId":"r1","firedAt":"2026-08-20T12:00:00Z","triggeringConditionId":"c1"}]',
    );

    await expect(drainFiredEvents()).resolves.toEqual([
      {
        reminderId: 'r1',
        firedAt: '2026-08-20T12:00:00Z',
        triggeringConditionId: 'c1',
      },
    ]);
  });

  it('rejette un événement dont un champ manque', async () => {
    mocked.drainFiredEvents.mockResolvedValueOnce(
      '[{"reminderId":"r1","firedAt":"2026-08-20T12:00:00Z"}]',
    );

    await expect(drainFiredEvents()).rejects.toThrow(
      /\[0\]\.triggeringConditionId" devrait être une chaîne/,
    );
  });
});
