import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from '@/app/navigation/RootNavigator';
import {
  applyPendingFiredEvents,
  resyncTriggerEngine,
} from '@/domain/reminders/reminderService';
import { initialiseI18n } from '@/i18n';

export function App(): React.JSX.Element {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function bootstrap(): Promise<void> {
      // i18next s'initialise de façon asynchrone : afficher l'interface avant
      // la fin de cette étape produirait un bref affichage des clés brutes.
      await initialiseI18n();

      // Répercute en base les déclenchements survenus pendant que
      // l'application ne tournait pas, puis reconstruit le miroir natif. Cette
      // resynchronisation systématique rattrape toute divergence due à un
      // crash entre une écriture en base et sa synchronisation.
      //
      // **L'ordre porte la garantie du déclenchement unique.** Le natif a
      // retiré de son miroir la règle qui vient de sonner ; c'est
      // `applyPendingFiredEvents` qui inscrit `lastFiredAt` en base, et donc
      // `buildRuleSnapshot` qui cesse ensuite de la transmettre. Resynchroniser
      // d'abord la repousserait telle quelle, avec une ligne de base fraîche :
      // elle sonnerait une seconde fois.
      await applyPendingFiredEvents();
      await resyncTriggerEngine();

      setReady(true);
    }

    void bootstrap();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      {ready ? (
        <RootNavigator />
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator />
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
