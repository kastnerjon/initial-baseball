import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, Text, View } from 'react-native';
import { DEFAULT_ALPHA_SETTINGS } from '@initial-baseball/shared';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', textAlign: 'center' }}>Initial Baseball</Text>
        <Text style={{ marginTop: 12, textAlign: 'center' }}>
          Scaffold loaded. Default game: {DEFAULT_ALPHA_SETTINGS.innings} innings, {DEFAULT_ALPHA_SETTINGS.strikesPerAtBat} strikes.
        </Text>
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}
