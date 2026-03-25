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
import api from '../../services/api';
import { colors, spacing, fontSize } from '../../utils/theme';

const { width } = Dimensions.get('window');
const GRID_SIZE = (width - 4) / 3;

export default function ProfileScreen({ route, navigation }) {
  const { username } = route.params;
  const [profile, setProfile] = useState(null);
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    fetchProfile();
    fetchVideos();
  }, [username]);

  const fetchProfile = async () => {
    try {
      const { data } = await api.get(`/profiles/${username}`);
      setProfile(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVideos = async () => {
    try {
      const { data } = await api.get(`/profiles/${username}/videos`);
      setVideos(data);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleFollow = async () => {
    if (!profile) return;
    try {
      if (profile.isFollowing) {
        await api.delete(`/profiles/${profile.id}/follow`);
      } else {
        await api.post(`/profiles/${profile.id}/follow`);
      }
      setProfile((p) => ({
        ...p,
        isFollowing: !p.isFollowing,
        followerCount: p.followerCount + (p.isFollowing ? -1 : 1),
      }));
    } catch (err) {
      console.error(err);
    }
  };

  if (!profile) return <View style={styles.container} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{profile.username}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.profileSection}>
        <View style={styles.avatarLarge}>
          {profile.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{profile.username[0].toUpperCase()}</Text>
          )}
          {profile.isLive && (
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{profile.followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{profile.followerCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{profile.videoCount}</Text>
            <Text style={styles.statLabel}>Videos</Text>
          </View>
        </View>

        <Text style={styles.displayName}>
          {profile.displayName}
          {profile.isVerified && (
            <>
              {' '}
              <Ionicons name="checkmark-circle" size={16} color="#00BFFF" />
            </>
          )}
        </Text>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.followButton, profile.isFollowing && styles.followingButton]}
            onPress={toggleFollow}
          >
            <Text
              style={[
                styles.followButtonText,
                profile.isFollowing && styles.followingButtonText,
              ]}
            >
              {profile.isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
          {profile.isLive && (
            <TouchableOpacity
              style={styles.liveButton}
              onPress={() => navigation.navigate('LiveStream', { hostUsername: username })}
            >
              <Ionicons name="radio" size={16} color="#fff" />
              <Text style={styles.liveButtonText}>Watch Live</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

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
          </TouchableOpacity>
        )}
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
  headerTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  profileSection: { alignItems: 'center', paddingVertical: spacing.md },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarText: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '700' },
  liveBadge: {
    position: 'absolute',
    bottom: -4,
    backgroundColor: colors.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  liveBadgeText: { color: '#fff', fontSize: 8, fontWeight: '900' },
  statsRow: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.xl },
  stat: { alignItems: 'center' },
  statNumber: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700' },
  statLabel: { color: colors.textSecondary, fontSize: fontSize.sm },
  displayName: { color: colors.text, fontSize: fontSize.lg, fontWeight: '600', marginTop: spacing.md },
  bio: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  followButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  followButtonText: { color: '#fff', fontWeight: '700' },
  followingButtonText: { color: colors.textSecondary },
  liveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.error,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  liveButtonText: { color: '#fff', fontWeight: '700' },
  gridItem: { width: GRID_SIZE, height: GRID_SIZE, padding: 1 },
  gridImage: { width: '100%', height: '100%' },
  gridPlaceholder: { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
});
