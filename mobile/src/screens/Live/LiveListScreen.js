import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Platform,
  Animated,
  Easing,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, fontSize } from '../../utils/theme';
import api from '../../services/api';

// Pulsing dot for LIVE badge
function PulsingDot() {
  const dotAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(dotAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.liveDot, { opacity: dotAnim }]} />
  );
}

function formatViewerCount(count) {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(count);
}

// Random gradient-like colors for cards without thumbnails
const BG_COLORS = ['#E91E63', '#FF9800', '#4CAF50', '#9C27B0', '#2196F3', '#00BCD4', '#FF5722', '#673AB7'];

export default function LiveListScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const cardWidth = (width - spacing.md * 3) / 2;
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStreams = useCallback(async () => {
    try {
      const { data } = await api.get('/live');
      setStreams(data);
    } catch (err) {
      console.warn('Failed to fetch live streams:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch on mount + refetch when screen gains focus
  useFocusEffect(
    useCallback(() => {
      fetchStreams();
    }, [fetchStreams])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchStreams();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Live Now</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Live Now</Text>
        <TouchableOpacity
          style={styles.goLiveBtn}
          onPress={() => navigation.navigate('GoLive')}
          activeOpacity={0.8}
        >
          <Ionicons name="radio" size={16} color="#fff" />
          <Text style={styles.goLiveText}>Go Live</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {streams.length === 0 ? (
          /* Empty state */
          <View style={styles.emptyState}>
            <Ionicons name="radio-outline" size={56} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No one is live right now</Text>
            <Text style={styles.emptySubtitle}>Be the first to go live and grow your audience!</Text>
            <TouchableOpacity
              style={styles.emptyGoLiveBtn}
              onPress={() => navigation.navigate('GoLive')}
              activeOpacity={0.8}
            >
              <Ionicons name="radio" size={18} color="#fff" />
              <Text style={styles.emptyGoLiveText}>Start Streaming</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Stream grid */}
            <View style={styles.grid}>
              {streams.map((stream, index) => {
                const bgColor = BG_COLORS[index % BG_COLORS.length];
                const host = stream.host || {};
                const initial = (host.username || '?')[0].toUpperCase();

                return (
                  <TouchableOpacity
                    key={stream.id}
                    style={[styles.card, { width: cardWidth }]}
                    activeOpacity={0.8}
                    onPress={() =>
                      navigation.navigate('LiveStream', {
                        streamId: stream.id,
                        hostName: host.username,
                      })
                    }
                  >
                    {/* Thumbnail */}
                    <View
                      style={[
                        styles.thumbnail,
                        { height: cardWidth * 1.3, backgroundColor: bgColor },
                      ]}
                    >
                      {stream.thumbnailUrl ? (
                        <Image
                          source={{ uri: stream.thumbnailUrl }}
                          style={StyleSheet.absoluteFill}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                          <Ionicons name="radio" size={40} color="rgba(255,255,255,0.3)" />
                        </View>
                      )}

                      {/* Darker overlay */}
                      <View style={styles.thumbnailOverlay} />

                      {/* LIVE badge */}
                      <View style={styles.liveBadge}>
                        <PulsingDot />
                        <Text style={styles.liveText}>LIVE</Text>
                      </View>

                      {/* Viewer count */}
                      <View style={styles.viewerBadge}>
                        <Ionicons name="eye" size={11} color={colors.text} />
                        <Text style={styles.viewerText}>
                          {formatViewerCount(stream.viewerCount || 0)}
                        </Text>
                      </View>
                    </View>

                    {/* Card info */}
                    <View style={styles.cardInfo}>
                      <View style={[styles.hostAvatar, { backgroundColor: bgColor }]}>
                        {host.avatarUrl ? (
                          <Image
                            source={{ uri: host.avatarUrl }}
                            style={{ width: 28, height: 28, borderRadius: 14 }}
                          />
                        ) : (
                          <Text style={styles.hostAvatarText}>{initial}</Text>
                        )}
                      </View>
                      <View style={styles.cardMeta}>
                        <Text style={styles.hostName} numberOfLines={1}>
                          {host.username || 'Unknown'}
                        </Text>
                        <Text style={styles.streamTitle} numberOfLines={1}>
                          {stream.title || 'Livestream'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Battle card */}
            <TouchableOpacity
              style={styles.battleCard}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Battle', { battleId: 'demo' })}
            >
              <View style={styles.battleContent}>
                <View style={styles.battleIconContainer}>
                  <Ionicons name="flash" size={26} color={colors.tertiary} />
                </View>
                <View style={styles.battleInfo}>
                  <Text style={styles.battleTitle}>Live Battle</Text>
                  <Text style={styles.battleSubtitle}>
                    Watch creators compete in real-time!
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color={colors.textMuted}
                />
              </View>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  goLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryDim,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  goLiveText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  // Scroll content
  scrollContent: {
    paddingBottom: spacing.xxl + 60,
  },
  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyGoLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryDim,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: spacing.lg,
  },
  emptyGoLiveText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  // Card
  card: {
    marginBottom: spacing.sm,
  },
  thumbnail: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  liveBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E53935',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  viewerBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.glass,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  viewerText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  // Card info
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  hostAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  hostAvatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  cardMeta: {
    flex: 1,
  },
  hostName: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  streamTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: 1,
  },
  // Battle card
  battleCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  battleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  battleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  battleInfo: {
    flex: 1,
  },
  battleTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  battleSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
});
