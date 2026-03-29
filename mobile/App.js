import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import useAuthStore from './src/store/authStore';
import { SnapCameraProvider } from './src/features/camera/SnapCameraProvider';

// Error boundary to catch crashes and show error message instead of blank screen
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={ebStyles.container}>
          <Text style={ebStyles.title}>Something went wrong</Text>
          <Text style={ebStyles.error}>{String(this.state.error?.message || this.state.error)}</Text>
          <Text style={ebStyles.hint}>Pull down to refresh</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const ebStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#150629', justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { color: '#ff6e84', fontSize: 22, fontWeight: '800', marginBottom: 12 },
  error: { color: '#b7a3cf', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  hint: { color: '#806e96', fontSize: 12 },
});

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <SnapCameraProvider>
            <AppNavigator />
          </SnapCameraProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
