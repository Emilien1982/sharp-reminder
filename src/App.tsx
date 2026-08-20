import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from '@/app/navigation/RootNavigator';
import { initialiseI18n } from '@/i18n';

export function App(): React.JSX.Element {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // i18next s'initialise de façon asynchrone : afficher l'interface avant la
    // fin de cette étape produirait un bref affichage des clés brutes.
    void initialiseI18n().then(() => setReady(true));
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
