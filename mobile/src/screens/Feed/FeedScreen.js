import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import VideoCard from '../../components/feed/VideoCard';
import api from '../../services/api';
import useFeedStore from '../../store/feedStore';
import { colors, fontSize, spacing } from '../../utils/theme';

// ==================== LIVE CARD COMPONENT ====================
function PulsingLiveDot() {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.3, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    ).start();
  }, []);
  return <Animated.View style={[liveStyles.liveDot, { opacity: anim }]} />;
}

function LiveCard({ stream, cardHeight, navigation, isActive }) {
  const { width: screenWidth } = useWindowDimensions();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isActive) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [isActive]);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[liveStyles.card, { width: screenWidth, height: cardHeight }]}
      onPress={() => navigation.navigate('LiveStream', { streamId: stream.id, hostName: stream.host?.username })}
    >
      {/* Background thumbnail or gradient */}
      {stream.thumbnailUrl ? (
        <Image source={{ uri: stream.thumbnailUrl }} style={StyleSheet.absoluteFill} blurRadius={20} />
      ) : null}
      <View style={[StyleSheet.absoluteFill, liveStyles.cardOverlay]} />

      {/* Center content */}
      <View style={liveStyles.centerContent}>
        {/* Avatar with pulsing ring */}
        <Animated.View style={[liveStyles.avatarRing, { transform: [{ scale: pulseAnim }] }]}>
          {stream.host?.avatarUrl ? (
            <Image source={{ uri: stream.host.avatarUrl }} style={liveStyles.avatar} />
          ) : (
            <View style={liveStyles.avatarPlaceholder}>
              <Text style={liveStyles.avatarText}>
                {(stream.host?.username || 'U')[0].toUpperCase()}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* LIVE badge */}
        <View style={liveStyles.liveBadge}>
          <PulsingLiveDot />
          <Text style={liveStyles.liveText}>LIVE</Text>
        </View>

        {/* Username */}
        <Text style={liveStyles.username}>@{stream.host?.username}</Text>
        {stream.host?.displayName && stream.host.displayName !== stream.host.username && (
          <Text style={liveStyles.displayName}>{stream.host.displayName}</Text>
        )}

        {/* Stream title */}
        {stream.title ? (
          <Text style={liveStyles.title} numberOfLines={2}>{stream.title}</Text>
        ) : null}

        {/* Viewer count */}
        <View style={liveStyles.viewerRow}>
          <Ionicons name="eye" size={16} color="rgba(255,255,255,0.7)" />
          <Text style={liveStyles.viewerCount}>
            {stream.viewerCount >= 1000
              ? (stream.viewerCount / 1000).toFixed(1) + 'K'
              : stream.viewerCount} watching
          </Text>
        </View>

        {/* Join button */}
        <View style={liveStyles.joinBtn}>
          <Text style={liveStyles.joinBtnText}>Tap to join</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const liveStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardOverlay: {
    backgroundColor: 'rgba(15, 5, 30, 0.75)',
  },
  centerContent: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.xl,
  },
  avatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    ...Platform.select({
      ios: { shadowColor: colors.error, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 16 },
      android: { elevation: 8 },
    }),
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '700',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.error,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  username: {
    color: '#fff',
    fontSize: fontSize.xl,
    fontWeight: '800',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  displayName: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: '500',
    marginTop: -6,
  },
  title: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontSize.lg,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 22,
  },
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  viewerCount: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  joinBtn: {
    marginTop: 16,
    backgroundColor: colors.primaryDim,
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    ...Platform.select({
      ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  joinBtnText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

// Tab bar is position:absolute, so cards should be full window height
const TAB_BAR_HEIGHT = Platform.OS === 'web' ? 70 : 85;

// Module-level cache to survive remounts (e.g. when navigating to Comments and back)
let cachedVideos = [];
let cachedIndex = 0;
let cachedTab = 'foryou';

export default function FeedScreen({ navigation }) {
  const { height: windowHeight } = useWindowDimensions();
  const cardHeight = windowHeight;
  const isFocused = useIsFocused();

  const { activeTab, setActiveTab } = useFeedStore();
  const [videos, setVideos] = useState(cachedTab === activeTab ? cachedVideos : []);
  const [loading, setLoading] = useState(cachedVideos.length === 0 || cachedTab !== activeTab);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(cachedIndex);
  const flatListRef = useRef(null);
  const hasRestored = useRef(false);
  const seenVideoIds = useRef(new Set());

  // Lives tab state
  const [liveStreams, setLiveStreams] = useState([]);
  const [livesLoading, setLivesLoading] = useState(false);
  const [livesError, setLivesError] = useState(null);
  const [liveIndex, setLiveIndex] = useState(0);
  const liveListRef = useRef(null);

  const fetchFeed = useCallback(async (pageNum = 1) => {
    try {
      let endpoint, params;

      if (activeTab === 'following') {
        endpoint = '/feed/following';
        params = { page: pageNum, limit: 10 };
      } else {
        endpoint = '/feed/foryou';
        const excludeArr = [...seenVideoIds.current];
        params = {
          page: pageNum,
          limit: 10,
          ...(excludeArr.length > 0 && pageNum > 1 ? { exclude: excludeArr.join(',') } : {}),
        };
      }

      const { data } = await api.get(endpoint, { params });
      const feedVideos = data.videos || data || [];

      // Track seen IDs for cursor-based pagination
      feedVideos.forEach(v => seenVideoIds.current.add(v.id));

      if (pageNum === 1) {
        setVideos(feedVideos);
        cachedVideos = feedVideos;
      } else {
        setVideos(prev => {
          const existingIds = new Set(prev.map(v => v.id));
          const unique = feedVideos.filter(v => !existingIds.has(v.id));
          const merged = [...prev, ...unique];
          cachedVideos = merged;
          return merged;
        });
      }
    } catch (err) {
      console.error('Feed fetch error:', err);
      setError(err.message || 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Fetch only if we don't already have cached data
  useEffect(() => {
    if (activeTab === 'lives') return;
    if (cachedVideos.length === 0 || cachedTab !== activeTab) {
      cachedTab = activeTab;
      seenVideoIds.current.clear();
      setLoading(true);
      fetchFeed(1);
    }
  }, [activeTab]);

  // Fetch live streams when Lives tab is selected
  const fetchLiveStreams = useCallback(async () => {
    setLivesLoading(true);
    setLivesError(null);
    try {
      const { data } = await api.get('/live');
      setLiveStreams(data || []);
    } catch (err) {
      console.error('Lives fetch error:', err);
      setLivesError(err.message || 'Failed to load live streams');
    } finally {
      setLivesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'lives') {
      fetchLiveStreams();
    }
  }, [activeTab]);

  // Restore scroll position after videos are loaded
  useEffect(() => {
    if (videos.length > 0 && cachedIndex > 0 && !hasRestored.current) {
      hasRestored.current = true;
      // Small delay to ensure FlatList has rendered
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: cachedIndex, animated: false });
      }, 100);
    }
  }, [videos]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const idx = viewableItems[0].index ?? 0;
      setCurrentIndex(idx);
      cachedIndex = idx;
    }
  }).current;

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchFeed(nextPage);
  };

  const liveViewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
  const onLiveViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setLiveIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const switchTab = (tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    if (tab !== 'lives') {
      setPage(1);
      setCurrentIndex(0);
      cachedIndex = 0;
      cachedVideos = [];
      cachedTab = tab;
      seenVideoIds.current.clear();
      setVideos([]);
      setLoading(true);
      hasRestored.current = false;
    }
  };

  const isLoading = activeTab === 'lives' ? livesLoading : loading;

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primaryDim} />
      </View>
    );
  }

  const renderTabs = () => (
    <SafeAreaView style={styles.header} edges={['top']}>
      <TouchableOpacity onPress={() => switchTab('foryou')} style={styles.tabWrapper}>
        <Text style={[styles.tab, activeTab === 'foryou' && styles.tabActive]}>For You</Text>
        {activeTab === 'foryou' && <View style={styles.tabUnderline} />}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => switchTab('following')} style={styles.tabWrapper}>
        <Text style={[styles.tab, activeTab === 'following' && styles.tabActive]}>Following</Text>
        {activeTab === 'following' && <View style={styles.tabUnderline} />}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => switchTab('lives')} style={styles.tabWrapper}>
        <Text style={[styles.tab, activeTab === 'lives' && styles.tabActiveLive]}>
          {activeTab === 'lives' ? '● ' : ''}Lives
        </Text>
        {activeTab === 'lives' && <View style={styles.tabUnderlineLive} />}
      </TouchableOpacity>
    </SafeAreaView>
  );

  // Lives tab content
  if (activeTab === 'lives') {
    return (
      <View style={styles.container}>
        {renderTabs()}
        <FlatList
          ref={liveListRef}
          data={liveStreams}
          renderItem={({ item, index }) => (
            <LiveCard
              stream={item}
              cardHeight={cardHeight}
              navigation={navigation}
              isActive={index === liveIndex && isFocused}
            />
          )}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={cardHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onLiveViewableItemsChanged}
          viewabilityConfig={liveViewabilityConfig}
          getItemLayout={(_, index) => ({
            length: cardHeight,
            offset: cardHeight * index,
            index,
          })}
          ListEmptyComponent={
            <View style={[styles.emptyContainer, { height: cardHeight }]}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="radio-outline" size={36} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>
                {livesError ? 'Connection Error' : 'No one is live'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {livesError
                  ? livesError
                  : 'Be the first to go live! Tap the + button to start streaming.'}
              </Text>
              {livesError && (
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={fetchLiveStreams}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      </View>
    );
  }

  // For You / Following tab content
  return (
    <View style={styles.container}>
      {renderTabs()}

      <FlatList
        ref={flatListRef}
        data={videos}
        renderItem={({ item, index }) => (
          <VideoCard
            video={item}
            isActive={index === currentIndex && isFocused}
            navigation={navigation}
            cardHeight={cardHeight}
            source={activeTab === 'foryou' ? 'fyp' : 'following'}
          />
        )}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={cardHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        getItemLayout={(_, index) => ({
          length: cardHeight,
          offset: cardHeight * index,
          index,
        })}
        ListEmptyComponent={
          <View style={[styles.emptyContainer, { height: cardHeight }]}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>{error ? '!' : '📱'}</Text>
            </View>
            <Text style={styles.emptyTitle}>{error ? 'Connection Error' : 'No videos yet'}</Text>
            <Text style={styles.emptySubtitle}>
              {error
                ? error
                : activeTab === 'following'
                  ? 'Follow creators to see their videos here'
                  : 'Videos will appear here soon'}
            </Text>
            {error && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => { setError(null); setLoading(true); fetchFeed(1); }}
              >
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingBottom: spacing.sm,
  },
  tabWrapper: {
    alignItems: 'center',
    paddingBottom: 2,
  },
  tab: {
    color: 'rgba(239,223,255,0.4)',
    fontSize: fontSize.lg,
    fontWeight: '700',
    letterSpacing: 0.3,
    paddingBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  tabActive: {
    color: colors.primary,
  },
  tabActiveLive: {
    color: colors.error,
    fontWeight: '800',
  },
  tabUnderlineLive: {
    width: 28,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.error,
    ...Platform.select({
      ios: { shadowColor: colors.error, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6 },
      android: { elevation: 4 },
      web: { boxShadow: `0 0 10px ${colors.error}` },
    }),
  },
  tabUnderline: {
    width: 28,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: `0 0 10px ${colors.primary}, 0 0 20px ${colors.primaryDim}`,
      },
    }),
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '800',
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: fontSize.md,
  },
});
