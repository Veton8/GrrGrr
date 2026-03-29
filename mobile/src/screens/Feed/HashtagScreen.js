import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Image,
  ActivityIndicator, useWindowDimensions, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../../utils/theme';
import api from '../../services/api';

function formatCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n || 0);
}

export default function HashtagScreen({ route, navigation }) {
  const { name } = route.params;
  const { width } = useWindowDimensions();
  const tileWidth = (width - spacing.md * 2 - spacing.sm * 2) / 3;

  const [hashtag, setHashtag] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchVideos = useCallback(async (pageNum = 1) => {
    try {
      const { data } = await api.get(`/feed/hashtags/${name}/videos`, { params: { page: pageNum, limit: 15 } });
      if (data.hashtag) setHashtag(data.hashtag);
      setHasMore(data.hasMore);
      if (pageNum === 1) {
        setVideos(data.videos || []);
      } else {
        setVideos(prev => [...prev, ...(data.videos || [])]);
      }
    } catch (err) {
      console.warn('Hashtag fetch error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [name]);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  const loadMore = () => {
    if (!hasMore) return;
    const next = page + 1;
    setPage(next);
    fetchVideos(next);
  };

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchVideos(1);
  };

  // Compute total views across all loaded videos
  const totalViews = videos.reduce((sum, v) => sum + (v.viewCount || 0), 0);

  const renderVideoTile = ({ item }) => (
    <TouchableOpacity
      style={[styles.videoTile, { width: tileWidth, height: tileWidth * 1.4 }]}
      onPress={() => navigation.navigate('Home')}
      activeOpacity={0.8}
    >
      <View style={[styles.videoTileInner, { backgroundColor: colors.surfaceContainer }]}>
        {item.thumbnailUrl ? (
          <Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Ionicons name="videocam" size={24} color={colors.textMuted} />
        )}
        <View style={styles.tileOverlay}>
          <View style={styles.tileStat}>
            <Ionicons name="play" size={10} color="#fff" />
            <Text style={styles.tileCount}>{formatCount(item.viewCount)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>#{name}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <Text style={styles.bannerHash}>#</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerName}>{name}</Text>
          <Text style={styles.bannerStats}>
            {formatCount(hashtag?.videoCount || videos.length)} videos · {formatCount(totalViews)} total views
          </Text>
        </View>
        {hashtag?.trendingScore > 0 && (
          <View style={styles.trendingBadge}>
            <Ionicons name="trending-up" size={14} color={colors.tertiary} />
            <Text style={styles.trendingText}>Trending</Text>
          </View>
        )}
      </View>

      {/* Video grid */}
      <FlatList
        data={videos}
        renderItem={renderVideoTile}
        keyExtractor={item => item.id}
        numColumns={3}
        contentContainerStyle={styles.gridContainer}
        columnWrapperStyle={styles.gridRow}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="pricetag-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No videos with this hashtag yet</Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 100 }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800' },

  banner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.lg, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.sm },
  bannerIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(170,48,250,0.2)', justifyContent: 'center', alignItems: 'center' },
  bannerHash: { color: colors.primary, fontSize: 28, fontWeight: '900' },
  bannerName: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  bannerStats: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 4 },
  trendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,201,0,0.15)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  trendingText: { color: colors.tertiary, fontSize: fontSize.xs, fontWeight: '700' },

  gridContainer: { paddingHorizontal: spacing.md },
  gridRow: { gap: spacing.sm, marginBottom: spacing.sm },
  videoTile: {},
  videoTileInner: { flex: 1, borderRadius: 10, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  tileOverlay: { position: 'absolute', bottom: 4, left: 4 },
  tileStat: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
  tileCount: { color: '#fff', fontSize: 9, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: spacing.md },
  emptyText: { color: colors.textMuted, fontSize: fontSize.md },
});
