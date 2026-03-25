import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../../utils/theme';
import api from '../../services/api';

// Tab bar is position:absolute overlaying content, so full screen height is used
const TAB_BAR_HEIGHT = Platform.OS === 'web' ? 70 : 85;

function formatCount(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
}

export default function VideoCard({ video, isActive, navigation, cardHeight }) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const videoRef = useRef(null);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinAnimRef = useRef(null);
  const dotAnim = useRef(new Animated.Value(0.4)).current;

  const [isLiked, setIsLiked] = useState(video.isLiked || false);
  const [likeCount, setLikeCount] = useState(video.likeCount || 0);
  const [isFollowing, setIsFollowing] = useState(video.user?.isFollowing || false);
  const [isPaused, setIsPaused] = useState(false);

  // Full window height since tab bar is absolute-positioned overlay
  const height = cardHeight || windowHeight;

  // Sync props when video changes
  useEffect(() => {
    setIsLiked(video.isLiked || false);
    setLikeCount(video.likeCount || 0);
    setIsFollowing(video.user?.isFollowing || false);
  }, [video.id]);

  // Video play/pause
  useEffect(() => {
    if (videoRef.current) {
      if (isActive && !isPaused) {
        videoRef.current.playAsync().catch(() => {});
      } else {
        videoRef.current.pauseAsync().catch(() => {});
        if (!isActive) {
          videoRef.current.setPositionAsync(0).catch(() => {});
        }
      }
    }
  }, [isActive, isPaused]);

  // Spinning disc animation
  useEffect(() => {
    if (isActive && !isPaused) {
      spinAnim.setValue(0);
      spinAnimRef.current = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== 'web',
        })
      );
      spinAnimRef.current.start();
    } else {
      if (spinAnimRef.current) {
        spinAnimRef.current.stop();
      }
    }
    return () => {
      if (spinAnimRef.current) {
        spinAnimRef.current.stop();
      }
    };
  }, [isActive, isPaused]);

  // Pulsing green dot animation for "watching" indicator
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(dotAnim, {
          toValue: 0.4,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleLike = useCallback(async () => {
    const wasLiked = isLiked;
    const prevCount = likeCount;
    // Optimistic update
    setIsLiked(!wasLiked);
    setLikeCount(wasLiked ? prevCount - 1 : prevCount + 1);
    try {
      if (wasLiked) {
        await api.delete(`/feed/${video.id}/like`);
      } else {
        await api.post(`/feed/${video.id}/like`);
      }
    } catch (err) {
      // Revert on failure
      setIsLiked(wasLiked);
      setLikeCount(prevCount);
    }
  }, [isLiked, likeCount, video.id]);

  const handleFollow = useCallback(async () => {
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    try {
      if (wasFollowing) {
        await api.delete(`/profiles/${video.user.id}/follow`);
      } else {
        await api.post(`/profiles/${video.user.id}/follow`);
      }
    } catch (err) {
      setIsFollowing(wasFollowing);
    }
  }, [isFollowing, video.user?.id]);

  const handleTapVideo = () => {
    setIsPaused((prev) => !prev);
  };

  return (
    <View style={[styles.container, { width: windowWidth, height }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleTapVideo}
        style={StyleSheet.absoluteFill}
      >
        {video.videoUrl ? (
          <View style={{ width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#000' }}>
            <Video
              ref={videoRef}
              source={{ uri: video.videoUrl }}
              style={{
                width: '100%',
                height: '100%',
                ...(Platform.OS === 'web' ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } : {}),
              }}
              videoStyle={Platform.OS === 'web' ? { width: '100%', height: '100%', objectFit: 'cover' } : undefined}
              resizeMode={ResizeMode.COVER}
              isLooping
              shouldPlay={isActive && !isPaused}
              isMuted={false}
            />
          </View>
        ) : (
          <View style={[{ width: '100%', height: '100%' }, styles.placeholder]}>
            <Ionicons name="videocam-outline" size={48} color={colors.textMuted} />
          </View>
        )}
      </TouchableOpacity>

      {/* Gradient overlay at bottom */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.6, 1]}
        style={styles.gradientOverlay}
        pointerEvents="none"
      />

      {/* Pause icon overlay */}
      {isPaused && isActive && (
        <View style={styles.pauseOverlay} pointerEvents="none">
          <View style={styles.pauseIconCircle}>
            <Ionicons name="play" size={48} color="rgba(255,255,255,0.9)" />
          </View>
        </View>
      )}

      {/* Bottom overlay - user info + caption */}
      <View style={styles.bottomOverlay} pointerEvents="box-none">
        {/* Creator row: avatar + username + watching */}
        <View style={styles.creatorRow}>
          <TouchableOpacity
            onPress={() => navigation.navigate('UserProfile', { username: video.user?.username })}
            style={styles.avatarContainer}
          >
            <View style={styles.avatarGlowRing}>
              {video.user?.avatarUrl ? (
                <Image source={{ uri: video.user.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {(video.user?.username || 'U')[0].toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            {!isFollowing && (
              <TouchableOpacity style={styles.followBadge} onPress={handleFollow}>
                <Ionicons name="add" size={12} color="#fff" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          <View style={styles.creatorInfo}>
            <TouchableOpacity
              onPress={() => navigation.navigate('UserProfile', { username: video.user?.username })}
            >
              <Text style={styles.username}>@{video.user?.username}</Text>
            </TouchableOpacity>
            <View style={styles.watchingRow}>
              <Animated.View style={[styles.liveDot, { opacity: dotAnim }]} />
              <Text style={styles.watchingText}>
                {video.viewCount ? formatCount(video.viewCount) : '0'} watching
              </Text>
            </View>
          </View>
        </View>

        {/* Caption */}
        <Text style={styles.caption} numberOfLines={2}>
          {video.caption}
        </Text>

        {/* Sound row */}
        {video.sound && (
          <View style={styles.soundRow}>
            <Ionicons name="musical-note" size={12} color={colors.tertiary} />
            <Text style={styles.soundName} numberOfLines={1}>
              {video.sound || 'Original Sound'}
            </Text>
          </View>
        )}
      </View>

      {/* Right sidebar - action buttons */}
      <View style={styles.sidebar} pointerEvents="box-none">
        {/* Like */}
        <TouchableOpacity style={styles.sidebarItem} onPress={handleLike}>
          <View style={styles.actionCircle}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={26}
              color={isLiked ? colors.error : '#fff'}
            />
          </View>
          <Text style={styles.sidebarCount}>{formatCount(likeCount)}</Text>
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity
          style={styles.sidebarItem}
          onPress={() => navigation.navigate('Comments', { videoId: video.id })}
        >
          <View style={styles.actionCircle}>
            <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
          </View>
          <Text style={styles.sidebarCount}>{formatCount(video.commentCount || 0)}</Text>
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity style={styles.sidebarItem}>
          <View style={styles.actionCircle}>
            <Ionicons name="share-social" size={24} color="#fff" />
          </View>
          <Text style={styles.sidebarCount}>{formatCount(video.shareCount || 0)}</Text>
        </TouchableOpacity>

        {/* Gift */}
        <TouchableOpacity
          style={styles.sidebarItem}
          onPress={() => navigation.navigate('VideoGift', { videoId: video.id, creatorId: video.user?.id, creatorName: video.user?.username })}
        >
          <View style={[styles.actionCircle, { backgroundColor: 'rgba(170, 48, 250, 0.5)', borderColor: 'rgba(211, 148, 255, 0.3)' }]}>
            <Ionicons name="gift" size={22} color={colors.tertiary} />
          </View>
          <Text style={styles.sidebarCount}>Gift</Text>
        </TouchableOpacity>

        {/* Spinning disc */}
        <Animated.View style={[styles.musicDisc, { transform: [{ rotate: spin }] }]}>
          <View style={styles.musicDiscInner}>
            <Ionicons name="musical-note" size={14} color={colors.tertiary} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    position: 'relative',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(41, 21, 67, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4, // visual centering for play icon
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT + 24,
    left: spacing.md,
    right: 80,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  avatarGlowRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    // Glow effect simulated via shadow
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: `0 0 12px ${colors.primaryDim}`,
      },
    }),
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  followBadge: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    backgroundColor: colors.primaryDim,
    borderRadius: 8,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  creatorInfo: {
    flex: 1,
  },
  username: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: '800',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  watchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  watchingText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  caption: {
    color: colors.onSurfaceVariant,
    fontSize: fontSize.md,
    marginTop: spacing.xs,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 5,
  },
  soundName: {
    color: colors.tertiary,
    fontSize: fontSize.sm,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  sidebar: {
    position: 'absolute',
    right: spacing.sm,
    bottom: TAB_BAR_HEIGHT + 24,
    alignItems: 'center',
    gap: 20,
  },
  sidebarItem: {
    alignItems: 'center',
  },
  actionCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.glass,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sidebarCount: {
    color: '#fff',
    fontSize: fontSize.xs,
    marginTop: 4,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  musicDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.tertiaryDim,
    marginTop: 4,
    ...Platform.select({
      ios: {
        shadowColor: colors.tertiaryDim,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: `0 0 8px ${colors.tertiaryDim}`,
      },
    }),
  },
  musicDiscInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
