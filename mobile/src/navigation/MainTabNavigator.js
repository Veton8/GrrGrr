import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, TouchableOpacity, StyleSheet, Platform, Modal, Text, Pressable } from 'react-native';
import FeedScreen from '../screens/Feed/FeedScreen';
import DiscoverScreen from '../screens/Feed/DiscoverScreen';
import InboxScreen from '../screens/Profile/InboxScreen';
import MyProfileScreen from '../screens/Profile/MyProfileScreen';
import useMessageStore from '../store/messageStore';
import { colors, spacing, fontSize } from '../utils/theme';

const Tab = createBottomTabNavigator();

function CreateButton({ onPress }) {
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
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const unreadTotal = useMessageStore((s) => s.unreadTotal);

  return (
    <>
    <CreateMenu
      visible={showCreateMenu}
      onClose={() => setShowCreateMenu(false)}
      onRecord={() => { setShowCreateMenu(false); navigation.navigate('RecordVideo'); }}
      onUpload={() => { setShowCreateMenu(false); navigation.navigate('UploadVideo'); }}
      onGoLive={() => { setShowCreateMenu(false); navigation.navigate('GoLive'); }}
    />
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
            <CreateButton {...props} onPress={() => setShowCreateMenu(true)} />
          ),
        }}
      />
      <Tab.Screen
        name="Messages"
        component={InboxScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={color} />
          ),
          ...(unreadTotal > 0
            ? {
                tabBarBadge: unreadTotal > 99 ? '99+' : unreadTotal,
                tabBarBadgeStyle: {
                  backgroundColor: colors.secondary,
                  color: colors.background,
                  fontSize: 10,
                  fontWeight: '700',
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  top: 2,
                },
              }
            : {}),
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
    </>
  );
}

function CreateMenu({ visible, onClose, onRecord, onUpload, onGoLive }) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.menuOverlay} onPress={onClose}>
        <View style={styles.menuContainer}>
          <TouchableOpacity style={styles.menuItem} onPress={onRecord} activeOpacity={0.7}>
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(255, 45, 85, 0.15)' }]}>
              <Ionicons name="camera" size={24} color="#FF6B8A" />
            </View>
            <View>
              <Text style={styles.menuTitle}>Record Video</Text>
              <Text style={styles.menuSubtitle}>Shoot with camera</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={styles.menuItem} onPress={onUpload} activeOpacity={0.7}>
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(170, 48, 250, 0.2)' }]}>
              <Ionicons name="cloud-upload" size={24} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.menuTitle}>Upload Video</Text>
              <Text style={styles.menuSubtitle}>Post from camera roll</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={styles.menuItem} onPress={onGoLive} activeOpacity={0.7}>
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(255, 45, 85, 0.2)' }]}>
              <Ionicons name="radio" size={24} color={colors.error} />
            </View>
            <View>
              <Text style={styles.menuTitle}>Go Live</Text>
              <Text style={styles.menuSubtitle}>Start a livestream</Text>
            </View>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
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
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    paddingBottom: Platform.OS === 'web' ? 90 : 110,
    paddingHorizontal: spacing.xl,
  },
  menuContainer: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 20,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  menuSubtitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
});
