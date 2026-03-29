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
  Share,
  ActionSheetIOS,
  Alert,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
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

export default function VideoCard({ video, isActive, navigation, cardHeight, source = 'fyp' }) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinAnimRef = useRef(null);
  const dotAnim = useRef(new Animated.Value(0.4)).current;

  const [isLiked, setIsLiked] = useState(video.isLiked || false);
  const [likeCount, setLikeCount] = useState(video.likeCount || 0);
  const [shareCount, setShareCount] = useState(video.shareCount || 0);
  const [isFollowing, setIsFollowing] = useState(video.user?.isFollowing || false);
  const [isPaused, setIsPaused] = useState(false);

  // Watch time tracking refs
  const watchStartTime = useRef(null);
  const accumulatedWatchTime = useRef(0);

  // Full window height since tab bar is absolute-positioned overlay
  const height = cardHeight || windowHeight;

  /** Video player via expo-video */
  const player = useVideoPlayer(video.videoUrl || null, (p) => {
    p.loop = true;
    p.muted = false;
  });

  // Sync props when video changes
  useEffect(() => {
    setIsLiked(video.isLiked || false);
    setLikeCount(video.likeCount || 0);
    setIsFollowing(video.user?.isFollowing || false);
  }, [video.id]);

  // Video play/pause
  useEffect(() => {
    if (!player) return;
    try {
      if (isActive && !isPaused) {
        player.play();
      } else {
        player.pause();
        if (!isActive) {
          player.currentTime = 0;
        }
      }
    } catch {}
  }, [isActive, isPaused, player]);

  // Watch time tracking
  useEffect(() => {
    if (isActive) {
      watchStartTime.current = Date.now();
    } else {
      // Video left view — calculate and send watch time
      if (watchStartTime.current) {
        const elapsed = Date.now() - watchStartTime.current;
        accumulatedWatchTime.current += elapsed;
        watchStartTime.current = null;
      }

      // Send view event if we accumulated enough time
      const totalMs = accumulatedWatchTime.current;
      if (totalMs >= 1000 && video.id) {
        // Fire and forget — don't block UI
        api.post(`/feed/${video.id}/view`, {
          watchDurationMs: totalMs,
          source,
        }).catch(() => {}); // Silently fail
      }

      // Reset for next time this video becomes active
      accumulatedWatchTime.current = 0;
    }

    // Cleanup on unmount
    return () => {
      if (watchStartTime.current) {
        const elapsed = Date.now() - watchStartTime.current;
        accumulatedWatchTime.current += elapsed;
        watchStartTime.current = null;
      }
      const totalMs = accumulatedWatchTime.current;
      if (totalMs >= 1000 && video.id) {
        api.post(`/feed/${video.id}/view`, {
          watchDurationMs: totalMs,
          source,
        }).catch(() => {});
      }
    };
  }, [isActive, video.id, source]);

  // Handle pause/unpause for watch time
  useEffect(() => {
    if (!isActive) return;

    if (isPaused) {
      // Paused — save elapsed time
      if (watchStartTime.current) {
        accumulatedWatchTime.current += Date.now() - watchStartTime.current;
        watchStartTime.current = null;
      }
    } else {
      // Resumed — restart timer
      watchStartTime.current = Date.now();
    }
  }, [isPaused, isActive]);

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

  const handleShare = useCallback(async () => {
    const shareUrl = `https://grgr.app/v/${video.id}`;
    const shareMessage = video.caption
      ? `Check out this video by @${video.user?.username}: "${video.caption}" ${shareUrl}`
      : `Check out this video by @${video.user?.username} on Grgr! ${shareUrl}`;

    const options = ['Share to external app', 'Send to friend', 'Cancel'];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2 },
        async (buttonIndex) => {
          if (buttonIndex === 0) {
            try {
              await Share.share({ message: shareMessage, url: shareUrl });
              api.post(`/feed/${video.id}/share`).then(({ data }) => setShareCount(data.shareCount)).catch(() => {});
            } catch {}
          } else if (buttonIndex === 1) {
            navigation.navigate('ContactPicker', {
              onSelect: async (user) => {
                try {
                  const { data: conv } = await api.post('/messages', { participantId: user.id });
                  await api.post(`/messages/${conv.id}/messages`, {
                    type: 'video_share',
                    content: `Shared a video by @${video.user?.username}`,
                    metadata: { videoId: video.id, thumbnailUrl: video.thumbnailUrl, username: video.user?.username, caption: video.caption },
                  });
                  api.post(`/feed/${video.id}/share`).then(({ data }) => setShareCount(data.shareCount)).catch(() => {});
                  Alert.alert('Sent!', `Video shared with @${user.username}`);
                } catch {
                  Alert.alert('Error', 'Could not send video');
                }
              },
            });
          }
        },
      );
    } else {
      Alert.alert('Share', 'How would you like to share?', [
        {
          text: 'Share to external app',
          onPress: async () => {
            try {
              await Share.share({ message: shareMessage });
              api.post(`/feed/${video.id}/share`).then(({ data }) => setShareCount(data.shareCount)).catch(() => {});
            } catch {}
          },
        },
        {
          text: 'Send to friend',
          onPress: () => {
            navigation.navigate('ContactPicker', {
              onSelect: async (user) => {
                try {
                  const { data: conv } = await api.post('/messages', { participantId: user.id });
                  await api.post(`/messages/${conv.id}/messages`, {
                    type: 'video_share',
                    content: `Shared a video by @${video.user?.username}`,
                    metadata: { videoId: video.id, thumbnailUrl: video.thumbnailUrl, username: video.user?.username, caption: video.caption },
                  });
                  api.post(`/feed/${video.id}/share`).then(({ data }) => setShareCount(data.shareCount)).catch(() => {});
                  Alert.alert('Sent!', `Video shared with @${user.username}`);
                } catch {
                  Alert.alert('Error', 'Could not send video');
                }
              },
            });
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [video, navigation]);

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
          <View style={{ width: windowWidth, height, overflow: 'hidden', backgroundColor: '#000' }}>
            <VideoView
              player={player}
              style={{ width: windowWidth, height, position: 'absolute', top: 0, left: 0 }}
              contentFit="contain"
              nativeControls={false}
            />
          </View>
        ) : (
          <View style={[{ width: windowWidth, height }, styles.placeholder]}>
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
            {video.viewCount > 0 && (
              <Text style={styles.viewCountText}>
                {formatCount(video.viewCount)} views
              </Text>
            )}
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
        <TouchableOpacity style={styles.sidebarItem} onPress={handleShare}>
          <View style={styles.actionCircle}>
            <Ionicons name="share-social" size={24} color="#fff" />
          </View>
          <Text style={styles.sidebarCount}>{formatCount(shareCount)}</Text>
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
  viewCountText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginTop: 2,
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
