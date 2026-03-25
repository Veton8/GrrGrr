import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import FeedScreen from '../screens/Feed/FeedScreen';
import DiscoverScreen from '../screens/Feed/DiscoverScreen';
import LiveListScreen from '../screens/Live/LiveListScreen';
import InboxScreen from '../screens/Profile/InboxScreen';
import MyProfileScreen from '../screens/Profile/MyProfileScreen';
import { colors } from '../utils/theme';

const Tab = createBottomTabNavigator();

function GoLiveButton({ onPress }) {
  return (
    <TouchableOpacity style={styles.goLiveButton} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.goLiveGlow}>
        <View style={styles.goLiveInner}>
          <Ionicons name="add" size={30} color="#fff" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MainTabNavigator({ navigation }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(0,0,0,0.9)',
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          borderTopWidth: 0,
          position: 'absolute',
          height: Platform.OS === 'web' ? 70 : 85,
          paddingBottom: Platform.OS === 'web' ? 8 : 25,
          paddingTop: 8,
          shadowColor: '#aa30fa',
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
          elevation: 20,
          overflow: 'visible',
        },
        tabBarActiveTintColor: '#d394ff',
        tabBarInactiveTintColor: 'rgba(239,223,255,0.4)',
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={FeedScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Create"
        component={View}
        options={{
          tabBarLabel: () => null,
          tabBarButton: (props) => (
            <GoLiveButton {...props} onPress={() => navigation.navigate('GoLive')} />
          ),
        }}
      />
      <Tab.Screen
        name="Live"
        component={LiveListScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="radio-outline" size={size} color={color} />
          ),
          tabBarBadge: '',
          tabBarBadgeStyle: {
            backgroundColor: colors.primaryDim,
            minWidth: 8,
            maxHeight: 8,
            borderRadius: 4,
            top: 6,
          },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={MyProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  goLiveButton: {
    top: -24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goLiveGlow: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(170, 48, 250, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#aa30fa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
  goLiveInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#aa30fa',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#aa30fa',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
});
