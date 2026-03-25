import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import { colors, spacing, fontSize } from '../../utils/theme';

const { width } = Dimensions.get('window');
const GRID_SIZE = (width - 4) / 3;

export default function MyProfileScreen({ navigation }) {
  const { user, logout } = useAuthStore();
  const [videos, setVideos] = useState([]);
  const [stats, setStats] = useState({ followerCount: 0, followingCount: 0, videoCount: 0 });

  useEffect(() => {
    if (user?.username) {
      fetchProfile();
      fetchVideos();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data } = await api.get(`/profiles/${user.username}`);
      setStats({
        followerCount: data.followerCount,
        followingCount: data.followingCount,
        videoCount: data.videoCount,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVideos = async () => {
    try {
      const { data } = await api.get(`/profiles/${user.username}/videos`);
      setVideos(data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.username}>{user?.username}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate('GiftShop')}>
            <Ionicons name="diamond-outline" size={24} color={colors.tertiary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout}>
            <Ionicons name="log-out-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.profileSection}>
        <View style={styles.avatarBorder}>
          <View style={styles.avatarLarge}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarLargeText}>
                {(user?.username || '?')[0].toUpperCase()}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{stats.followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{stats.followerCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{stats.videoCount}</Text>
            <Text style={styles.statLabel}>Videos</Text>
          </View>
        </View>

        <Text style={styles.displayName}>{user?.displayName}</Text>
        {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

        <View style={styles.coinBar}>
          <Ionicons name="diamond" size={16} color={colors.tertiary} />
          <Text style={styles.coinText}>{user?.coinBalance || 0} coins</Text>
        </View>

        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Video Grid */}
      <FlatList
        data={videos}
        numColumns={3}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.gridItem}>
            {item.thumbnail_url ? (
              <Image source={{ uri: item.thumbnail_url }} style={styles.gridImage} />
            ) : (
              <View style={[styles.gridImage, styles.gridPlaceholder]}>
                <Ionicons name="videocam" size={20} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.gridOverlay}>
              <Ionicons name="play" size={12} color="#fff" />
              <Text style={styles.gridViews}>{item.view_count || 0}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyGrid}>
            <Ionicons name="videocam-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No videos yet</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  username: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: spacing.md },
  profileSection: { alignItems: 'center', paddingVertical: spacing.md },
  avatarBorder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: colors.primaryDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 76, height: 76, borderRadius: 38 },
  avatarLargeText: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.xl,
  },
  stat: { alignItems: 'center' },
  statNumber: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700' },
  statLabel: { color: colors.textSecondary, fontSize: fontSize.sm },
  displayName: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  bio: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  coinBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  coinText: { color: colors.tertiary, fontSize: fontSize.sm, fontWeight: '600' },
  editButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xxl,
    marginTop: spacing.md,
  },
  editButtonText: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  gridItem: { width: GRID_SIZE, height: GRID_SIZE, padding: 1 },
  gridImage: { width: '100%', height: '100%' },
  gridPlaceholder: {
    backgroundColor: colors.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  gridViews: { color: '#fff', fontSize: fontSize.xs, fontWeight: '600' },
  emptyGrid: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  emptyText: { color: colors.textMuted, marginTop: spacing.sm },
});
