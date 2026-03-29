import React from 'react';
import { View, ActivityIndicator, Dimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import useAuthStore from '../store/authStore';
import useNotifications from '../hooks/useNotifications';
import useMessagesSocket from '../hooks/useMessagesSocket';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import LiveStreamScreen from '../screens/Live/LiveStreamScreen';
import GoLiveScreen from '../screens/Live/GoLiveScreen';
import BattleScreen from '../screens/Live/BattleScreen';
import GiftShopScreen from '../screens/Gifts/GiftShopScreen';
import VideoGiftScreen from '../screens/Gifts/VideoGiftScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import CommentsScreen from '../screens/Feed/CommentsScreen';
import UploadVideoScreen from '../screens/Upload/UploadVideoScreen';
import FollowListScreen from '../screens/Profile/FollowListScreen';
import HashtagScreen from '../screens/Feed/HashtagScreen';
import VideoPlayerScreen from '../screens/Feed/VideoPlayerScreen';
import RecordVideoScreen from '../screens/Upload/RecordVideoScreen';
import NotificationCenterScreen from '../screens/Notifications/NotificationCenterScreen';
import NotificationSettingsScreen from '../screens/Notifications/NotificationSettingsScreen';
import ChatScreen from '../screens/Messages/ChatScreen';
import ContactPickerModal from '../screens/Messages/ContactPickerModal';

const Stack = createStackNavigator();

function NotificationInitializer() {
  useNotifications();
  return null;
}

function MessagesSocketInitializer() {
  useMessagesSocket();
  return null;
}

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF2D55" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated && <NotificationInitializer />}
      {isAuthenticated && <MessagesSocketInitializer />}
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          gestureResponseDistance: Dimensions.get('window').width * 0.6,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      >
        {isAuthenticated ? (
          <>
            <Stack.Group>
              <Stack.Screen name="Main" component={MainTabNavigator} options={{ gestureEnabled: false }} />
              <Stack.Screen name="LiveStream" component={LiveStreamScreen} />
              <Stack.Screen name="GoLive" component={GoLiveScreen} />
              <Stack.Screen name="Battle" component={BattleScreen} />
              <Stack.Screen name="GiftShop" component={GiftShopScreen} />
              <Stack.Screen name="UserProfile" component={ProfileScreen} />
              <Stack.Screen name="UploadVideo" component={UploadVideoScreen} />
              <Stack.Screen name="FollowList" component={FollowListScreen} />
              <Stack.Screen name="HashtagPage" component={HashtagScreen} />
              <Stack.Screen name="RecordVideo" component={RecordVideoScreen} />
              <Stack.Screen name="VideoPlayer" component={VideoPlayerScreen} />
              <Stack.Screen name="NotificationCenter" component={NotificationCenterScreen} />
              <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
              <Stack.Screen name="Chat" component={ChatScreen} />
            </Stack.Group>
            <Stack.Group screenOptions={{
              presentation: 'transparentModal',
              detachPreviousScreen: false,
              gestureEnabled: true,
              gestureDirection: 'vertical',
              cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
            }}>
              <Stack.Screen name="Comments" component={CommentsScreen} />
              <Stack.Screen name="VideoGift" component={VideoGiftScreen} />
              <Stack.Screen name="ContactPicker" component={ContactPickerModal} />
            </Stack.Group>
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
