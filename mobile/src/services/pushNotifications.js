import { Platform } from 'react-native';
import api from './api';

/**
 * Register for push notifications and send the token to the backend.
 * On web, this is a no-op (Expo push notifications are native-only).
 */
export async function registerForPushNotifications() {
  if (Platform.OS === 'web') {
    console.log('[Push] Skipping push registration on web');
    return null;
  }

  try {
    const Notifications = require('expo-notifications');
    const Device = require('expo-device');

    if (!Device.isDevice) {
      console.log('[Push] Must use physical device for push notifications');
      return null;
    }

    // Check/request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Permission not granted');
      return null;
    }

    // Get the Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: undefined, // Uses the project ID from app.json automatically
    });
    const token = tokenData.data;

    // Register with backend
    await api.post('/notifications/push-token', {
      token,
      platform: Platform.OS,
    });

    console.log('[Push] Token registered:', token);

    // Configure notification behavior
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    return token;
  } catch (err) {
    console.warn('[Push] Registration error:', err.message);
    return null;
  }
}

/**
 * Unregister the push token from the backend (e.g., on logout).
 */
export async function unregisterPushToken(token) {
  if (!token || Platform.OS === 'web') return;
  try {
    await api.delete('/notifications/push-token', { data: { token } });
  } catch (err) {
    console.warn('[Push] Unregister error:', err.message);
  }
}
