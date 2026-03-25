import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import useAuthStore from '../store/authStore';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import LiveStreamScreen from '../screens/Live/LiveStreamScreen';
import GoLiveScreen from '../screens/Live/GoLiveScreen';
import BattleScreen from '../screens/Live/BattleScreen';
import GiftShopScreen from '../screens/Gifts/GiftShopScreen';
import VideoGiftScreen from '../screens/Gifts/VideoGiftScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import CommentsScreen from '../screens/Feed/CommentsScreen';

const Stack = createStackNavigator();

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
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Group>
              <Stack.Screen name="Main" component={MainTabNavigator} />
              <Stack.Screen name="LiveStream" component={LiveStreamScreen} />
              <Stack.Screen name="GoLive" component={GoLiveScreen} />
              <Stack.Screen name="Battle" component={BattleScreen} />
              <Stack.Screen name="GiftShop" component={GiftShopScreen} />
              <Stack.Screen name="UserProfile" component={ProfileScreen} />
            </Stack.Group>
            <Stack.Group screenOptions={{ presentation: 'transparentModal', detachPreviousScreen: false }}>
              <Stack.Screen name="Comments" component={CommentsScreen} />
              <Stack.Screen name="VideoGift" component={VideoGiftScreen} />
            </Stack.Group>
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
