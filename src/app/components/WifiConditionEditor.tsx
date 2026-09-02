import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { WifiCondition } from '@/domain/triggers/types';
import { readCurrentWifi } from '@/native/triggerEngine';

/**
 * Saisie d'une condition Wi-Fi.
 *
 * Le SSID se **capture**, il ne se cherche pas : un bouton reprend le réseau
 * auquel le téléphone est connecté à cet instant. Aucun scan des réseaux à
 * portée — Android le bride à quatre appels par deux minutes, exige la
 * localisation activée, renvoie souvent une liste vide, et aucune API publique
 * iOS ne listera jamais les réseaux. Le cas d'usage réel se passe très bien de
 * cette liste : on est chez soi ou au bureau au moment où l'on crée le rappel.
 *
 * La saisie libre reste ouverte, pour désigner un réseau où l'on n'est pas.
 */

interface Props {
  condition: WifiCondition;
  onChange: (condition: WifiCondition) => void;
}

const DIRECTIONS = ['connect', 'disconnect'] as const;

export function WifiConditionEditor({
  condition,
  onChange,
}: Props): React.JSX.Element {
  const { t } = useTranslation();

  /**
   * Message d'échec de la capture, jamais une erreur silencieuse.
   *
   * Les trois refus possibles appellent trois conduites différentes : se
   * connecter, rallumer la localisation, ou renoncer sur iOS. Laisser le champ
   * vide sans rien dire serait la pire des trois.
   */
  const [failure, setFailure] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const capture = useCallback(() => {
    setReading(true);
    setFailure(null);

    readCurrentWifi()
      .then(current => {
        if (current.status === 'connected') {
          onChange({ ...condition, ssid: current.ssid });
          return;
        }

        setFailure(
          t(
            current.status === 'none'
              ? 'editor.wifi.noNetwork'
              : current.status === 'masked'
              ? 'editor.wifi.masked'
              : 'editor.wifi.unsupported',
          ),
        );
      })
      // `String(error)` et non l'objet : cet état est une chaîne affichée telle
      // quelle, et y ranger une `Error` produisait un « [object Object] » à
      // l'écran — le défaut relevé en revue de la phase 4.
      .catch((error: unknown) => setFailure(String(error)))
      .finally(() => setReading(false));
  }, [condition, onChange, t]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('editor.wifi.ssidLabel')}</Text>

      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={condition.ssid}
          onChangeText={ssid => onChange({ ...condition, ssid })}
          placeholder={t('editor.wifi.ssidPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Pressable
          accessibilityRole="button"
          disabled={reading}
          onPress={capture}
          hitSlop={8}
        >
          <Text style={[styles.action, reading && styles.actionDisabled]}>
            {t('editor.wifi.useCurrent')}
          </Text>
        </Pressable>
      </View>

      {failure !== null && <Text style={styles.failure}>{failure}</Text>}

      <View style={styles.choices}>
        {DIRECTIONS.map(direction => {
          const selected = direction === condition.direction;
          return (
            <Pressable
              key={direction}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[
                styles.chip,
                styles.chipWide,
                selected && styles.chipSelected,
              ]}
              onPress={() => onChange({ ...condition, direction })}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
              >
                {t(`editor.wifi.direction.${direction}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  label: { fontSize: 13, fontWeight: '600', opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#c9c9c9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
  },
  action: { fontSize: 14, color: '#2c6cb0', fontWeight: '500' },
  actionDisabled: { opacity: 0.4 },
  failure: { fontSize: 12, color: '#a4302a' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c9c9c9',
  },
  chipWide: { flex: 1, alignItems: 'center' },
  chipSelected: { backgroundColor: '#2c6cb0', borderColor: '#2c6cb0' },
  chipText: { fontSize: 13 },
  chipTextSelected: { color: '#ffffff', fontWeight: '600' },
});
