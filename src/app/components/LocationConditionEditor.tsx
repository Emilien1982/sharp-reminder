import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, {
  Circle,
  Marker,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  type LatLng,
  type MapPressEvent,
  type MarkerDragStartEndEvent,
  type UserLocationChangeEvent,
} from 'react-native-maps';

import { hasBackgroundLocationPermission } from '@/app/permissions/location';
import { isPlaced, MIN_RADIUS_METERS } from '@/domain/reminders/reminderForm';
import type { EdgeDirection, LocationCondition } from '@/domain/triggers/types';

/**
 * Choix d'une zone géographique.
 *
 * Deux fournisseurs de carte, pour une raison qui n'est pas cosmétique :
 * `react-native-maps` impose Google sur Android — d'où la clé d'API — alors
 * qu'iOS utilise Apple Maps, sans clé ni compte. Voir
 * docs/adr/0005-carte-et-choix-du-lieu.md.
 */

/** Rayons proposés, en mètres. Le premier est le seuil de fiabilité. */
const RADIUS_CHOICES = [MIN_RADIUS_METERS, 150, 300, 500, 1000];

const DIRECTIONS: EdgeDirection[] = ['enter', 'exit'];

/**
 * Cadrage initial tant qu'aucune position n'est connue : la France entière.
 * Volontairement très large — un cadrage serré sur un point arbitraire
 * laisserait croire que le lieu est déjà choisi.
 */
const UNKNOWN_REGION = {
  latitude: 46.6,
  longitude: 2.4,
  latitudeDelta: 9,
  longitudeDelta: 9,
};

/** Cadrage autour d'une zone : environ trois fois son rayon. */
function regionFor(condition: LocationCondition) {
  const degrees = (condition.radiusMeters * 3) / 111_000;
  return {
    latitude: condition.latitude,
    longitude: condition.longitude,
    latitudeDelta: degrees,
    longitudeDelta: degrees,
  };
}

interface Props {
  condition: LocationCondition;
  onChange: (condition: LocationCondition) => void;
}

export function LocationConditionEditor({
  condition,
  onChange,
}: Props): React.JSX.Element {
  const { t } = useTranslation();
  const mapRef = useRef<MapView | null>(null);
  // `useState` et non `useRef` : cette valeur décide si le bouton « Ma
  // position » est actif. Muter une référence ne provoque aucun rendu — le
  // bouton restait grisé après l'arrivée du premier point GPS.
  const [userPosition, setUserPosition] = useState<LatLng | null>(null);
  const [backgroundAllowed, setBackgroundAllowed] = useState(true);

  const placed = isPlaced(condition);

  useEffect(() => {
    void hasBackgroundLocationPermission().then(setBackgroundAllowed);
  }, []);

  const moveTo = useCallback(
    (coordinate: LatLng) => {
      onChange({
        ...condition,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      });
      mapRef.current?.animateToRegion(
        regionFor({ ...condition, ...coordinate }),
        300,
      );
    },
    [condition, onChange],
  );

  /**
   * Première position connue : l'épingle s'y pose d'elle-même.
   *
   * Uniquement si le lieu n'a jamais été positionné — sans quoi le GPS
   * déplacerait sous les doigts de l'utilisateur un point qu'il vient de
   * choisir.
   */
  const onUserLocation = useCallback(
    (event: UserLocationChangeEvent) => {
      const coordinate = event.nativeEvent.coordinate;
      if (!coordinate) {
        return;
      }

      const position = {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      };
      setUserPosition(position);

      if (!placed) {
        moveTo(position);
      }
    },
    [moveTo, placed],
  );

  return (
    <View style={styles.container}>
      {!backgroundAllowed && (
        <Pressable
          accessibilityRole="button"
          style={styles.warning}
          onPress={() => {
            void Linking.openSettings();
          }}
        >
          <Text style={styles.warningText}>
            {t('editor.location.backgroundRequired')}
          </Text>
          <Text style={styles.warningAction}>
            {t('editor.location.openSettings')} →
          </Text>
        </Pressable>
      )}

      <View style={styles.mapFrame}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={
            Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT
          }
          initialRegion={placed ? regionFor(condition) : UNKNOWN_REGION}
          // La carte ne capte pas le glissement vertical : à l'intérieur d'un
          // formulaire défilant, elle absorbait le geste et rendait tout ce qui
          // se trouve en dessous — rayon, sens, suppression — inatteignable.
          // Le point se pose par appui ou en déplaçant l'épingle, et le zoom
          // reste disponible pour viser un lieu éloigné.
          scrollEnabled={false}
          zoomEnabled
          showsUserLocation
          onUserLocationChange={onUserLocation}
          onPress={(event: MapPressEvent) =>
            moveTo(event.nativeEvent.coordinate)
          }
        >
          {placed && (
            <>
              <Marker
                coordinate={{
                  latitude: condition.latitude,
                  longitude: condition.longitude,
                }}
                draggable
                onDragEnd={(event: MarkerDragStartEndEvent) =>
                  moveTo(event.nativeEvent.coordinate)
                }
              />
              <Circle
                center={{
                  latitude: condition.latitude,
                  longitude: condition.longitude,
                }}
                radius={condition.radiusMeters}
                strokeColor="#2c6cb0"
                fillColor="rgba(44, 108, 176, 0.15)"
              />
            </>
          )}
        </MapView>
      </View>

      <View style={styles.row}>
        <Text style={styles.hint}>{t('editor.location.hint')}</Text>
        <Pressable
          accessibilityRole="button"
          disabled={userPosition === null}
          onPress={() => {
            if (userPosition !== null) {
              moveTo(userPosition);
            }
          }}
        >
          <Text
            style={[
              styles.action,
              userPosition === null && styles.actionDisabled,
            ]}
          >
            {t('editor.location.useMyPosition')}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.label}>
        {t('editor.location.radius', { meters: condition.radiusMeters })}
      </Text>
      <View style={styles.choices}>
        {RADIUS_CHOICES.map(radius => {
          const selected = radius === condition.radiusMeters;
          return (
            <Pressable
              key={radius}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onChange({ ...condition, radiusMeters: radius })}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
              >
                {radius} m
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.hint}>{t('editor.location.edgeHint')}</Text>
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
                {t(`editor.location.direction.${direction}`)}
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
  mapFrame: {
    height: 220,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#c9c9c9',
  },
  map: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hint: { flex: 1, fontSize: 12, opacity: 0.6 },
  action: { fontSize: 14, color: '#2c6cb0', fontWeight: '500' },
  actionDisabled: { opacity: 0.4 },
  label: { fontSize: 13, fontWeight: '600', opacity: 0.7 },
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
  warning: {
    backgroundColor: '#fdf0ef',
    borderWidth: 1,
    borderColor: '#a4302a',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  warningText: { fontSize: 12, color: '#a4302a' },
  warningAction: { fontSize: 12, color: '#a4302a', fontWeight: '700' },
});
