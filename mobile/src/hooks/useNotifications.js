import { useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { registerForPushNotifications } from '../services/pushNotifications';
import useAuthStore from '../store/authStore';

/**
 * Hook to initialize push notifications and handle notification taps.
 * Call this once at the top level (e.g., inside AppNavigator when authenticated).
 */
export default function useNotifications() {
  const navigation = useNavigation();
  const { isAuthenticated } = useAuthStore();
  const responseListenerRef = useRef(null);
  const notificationListenerRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === 'web') return;

    let Notifications;
    try {
      Notifications = require('expo-notifications');
    } catch {
      return;
    }

    // Register for push notifications
    registerForPushNotifications();

    // Listen for notification taps (when user taps a notification)
    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        handleNotificationTap(data, navigation);
      }
    );

    // Listen for foreground notifications (optional: show in-app toast)
    notificationListenerRef.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const { title, body } = notification.request.content;
        // On native, expo-notifications handles the display automatically
        // via setNotificationHandler in pushNotifications.js
        console.log('[Notification] Received:', title, body);
      }
    );

    return () => {
      if (responseListenerRef.current) {
        responseListenerRef.current.remove();
      }
      if (notificationListenerRef.current) {
        notificationListenerRef.current.remove();
      }
    };
  }, [isAuthenticated, navigation]);
}

/**
 * Navigate to the appropriate screen based on notification data.
 */
function handleNotificationTap(data, navigation) {
  if (!data || !data.type) return;

  switch (data.type) {
    case 'like':
    case 'comment':
      if (data.videoId) {
        // Navigate to the feed — ideally to the specific video
        navigation.navigate('Main', { screen: 'Home' });
      }
      break;

    case 'new_follower':
      if (data.followerUsername) {
        navigation.navigate('UserProfile', { username: data.followerUsername });
      }
      break;

    case 'live_started':
      if (data.streamId) {
        navigation.navigate('LiveStream', { streamId: data.streamId });
      }
      break;

    case 'gift_received':
      navigation.navigate('Main', { screen: 'Profile' });
      break;

    default:
      // Open notification center
      navigation.navigate('NotificationCenter');
      break;
  }
}
