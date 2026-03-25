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
} from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import VideoCard from '../../components/feed/VideoCard';
import api from '../../services/api';
import { colors, fontSize, spacing } from '../../utils/theme';

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

  const [videos, setVideos] = useState(cachedVideos);
  const [loading, setLoading] = useState(cachedVideos.length === 0);
  const [page, setPage] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(cachedIndex);
  const [activeTab, setActiveTab] = useState(cachedTab);
  const flatListRef = useRef(null);
  const hasRestored = useRef(false);

  const fetchFeed = useCallback(async (pageNum = 1) => {
    try {
      const endpoint = activeTab === 'following' ? '/feed/following' : '/feed';
      const { data } = await api.get(endpoint, { params: { page: pageNum, limit: 10 } });
      const feedVideos = data.videos || data || [];
      if (pageNum === 1) {
        setVideos(feedVideos);
        cachedVideos = feedVideos;
      } else {
        setVideos((prev) => {
          const merged = [...prev, ...feedVideos];
          cachedVideos = merged;
          return merged;
        });
      }
    } catch (err) {
      console.error('Feed fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Fetch only if we don't already have cached data
  useEffect(() => {
    if (cachedVideos.length === 0 || cachedTab !== activeTab) {
      cachedTab = activeTab;
      setLoading(true);
      fetchFeed(1);
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

  const switchTab = (tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setPage(1);
    setCurrentIndex(0);
    cachedIndex = 0;
    cachedVideos = [];
    cachedTab = tab;
    setVideos([]);
    setLoading(true);
    hasRestored.current = false;
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primaryDim} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity onPress={() => switchTab('foryou')} style={styles.tabWrapper}>
          <Text style={[styles.tab, activeTab === 'foryou' && styles.tabActive]}>For You</Text>
          {activeTab === 'foryou' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => switchTab('following')} style={styles.tabWrapper}>
          <Text style={[styles.tab, activeTab === 'following' && styles.tabActive]}>Following</Text>
          {activeTab === 'following' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
      </SafeAreaView>

      <FlatList
        ref={flatListRef}
        data={videos}
        renderItem={({ item, index }) => (
          <VideoCard
            video={item}
            isActive={index === currentIndex && isFocused}
            navigation={navigation}
            cardHeight={cardHeight}
          />
        )}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={cardHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        onEndReached={loadMore}
        onEndReachedThreshold={2}
        getItemLayout={(_, index) => ({
          length: cardHeight,
          offset: cardHeight * index,
          index,
        })}
        ListEmptyComponent={
          <View style={[styles.emptyContainer, { height: cardHeight }]}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>📱</Text>
            </View>
            <Text style={styles.emptyTitle}>No videos yet</Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'following'
                ? 'Follow creators to see their videos here'
                : 'Videos will appear here soon'}
            </Text>
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
});
