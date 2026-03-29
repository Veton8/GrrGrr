import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  FlatList, Image, ActivityIndicator, Platform, RefreshControl,
  useWindowDimensions, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../../utils/theme';
import api from '../../services/api';

// Storage helper for search history
const HISTORY_KEY = 'search_history';
const storage = {
  get() {
    if (Platform.OS === 'web') {
      try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
    }
    return [];
  },
  set(items) {
    if (Platform.OS === 'web') {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
    }
  },
};

function formatCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n || 0);
}

export default function DiscoverScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchTab, setSearchTab] = useState('all');
  const [suggestions, setSuggestions] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [history, setHistory] = useState(storage.get());

  // Discover data
  const [discover, setDiscover] = useState(null);
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch discover data
  const fetchDiscover = useCallback(async () => {
    try {
      const { data } = await api.get('/search/discover');
      setDiscover(data);
    } catch (err) {
      console.warn('Failed to fetch discover:', err.message);
    } finally {
      setDiscoverLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDiscover(); }, []);

  // Debounced suggestions
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/search/suggestions', { params: { q: searchQuery } });
        setSuggestions(data || []);
      } catch { setSuggestions([]); }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  // Execute search
  const executeSearch = useCallback(async (query, tab = searchTab) => {
    if (!query || query.trim().length === 0) return;
    const q = query.trim();
    setSearchLoading(true);
    setSearchResults(null);
    setIsSearching(true);
    setSuggestions([]);
    Keyboard.dismiss();

    // Save to history
    const newHistory = [q, ...history.filter(h => h !== q)].slice(0, 10);
    setHistory(newHistory);
    storage.set(newHistory);

    try {
      const { data } = await api.get('/search', { params: { q, type: tab, limit: 20 } });
      setSearchResults(data);
    } catch (err) {
      console.warn('Search error:', err.message);
      setSearchResults({ videos: [], users: [], hashtags: [] });
    } finally {
      setSearchLoading(false);
    }
  }, [searchTab, history]);

  const clearHistory = () => {
    setHistory([]);
    storage.set([]);
  };

  const cancelSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    setSearchResults(null);
    setSuggestions([]);
    Keyboard.dismiss();
  };

  const tileWidth = (width - spacing.md * 2 - spacing.sm * 2) / 3;

  // ── SEARCH MODE ──
  if (isSearching || searchQuery.length > 0) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Search bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => executeSearch(searchQuery)}
              returnKeyType="search"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={cancelSearch} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Suggestions dropdown */}
        {suggestions.length > 0 && !searchResults && (
          <View style={styles.suggestionsContainer}>
            {suggestions.map((s, i) => (
              <TouchableOpacity
                key={i}
                style={styles.suggestionItem}
                onPress={() => {
                  setSearchQuery(s.text.replace(/^[#@]/, ''));
                  executeSearch(s.text.replace(/^[#@]/, ''), s.type === 'hashtag' ? 'hashtags' : 'users');
                }}
              >
                <Ionicons
                  name={s.type === 'hashtag' ? 'pricetag' : 'person'}
                  size={16} color={colors.primary}
                />
                <Text style={styles.suggestionText}>{s.text}</Text>
                {s.type === 'hashtag' && (
                  <Text style={styles.suggestionMeta}>{formatCount(s.videoCount)} videos</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Search results */}
        {searchResults && (
          <>
            {/* Tab bar */}
            <View style={styles.tabBar}>
              {['all', 'videos', 'users', 'hashtags'].map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tabItem, searchTab === tab && styles.tabItemActive]}
                  onPress={() => { setSearchTab(tab); executeSearch(searchQuery, tab); }}
                >
                  <Text style={[styles.tabText, searchTab === tab && styles.tabTextActive]}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {searchLoading ? (
              <View style={styles.loadingCenter}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.resultsContainer} showsVerticalScrollIndicator={false}>
                {/* Videos */}
                {searchResults.videos && searchResults.videos.length > 0 && (
                  <View style={styles.resultSection}>
                    {(searchTab === 'all') && <Text style={styles.resultSectionTitle}>Videos</Text>}
                    <View style={styles.videoGrid}>
                      {searchResults.videos.map((v, idx) => (
                        <TouchableOpacity
                          key={v.id}
                          style={[styles.videoTile, { width: tileWidth, height: tileWidth * 1.4 }]}
                          onPress={() => navigation.navigate('VideoPlayer', {
                            videos: searchResults.videos,
                            startIndex: idx,
                          })}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.videoTileInner, { backgroundColor: colors.surfaceContainer }]}>
                            {v.thumbnailUrl ? (
                              <Image source={{ uri: v.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                            ) : (
                              <Ionicons name="videocam" size={24} color={colors.textMuted} />
                            )}
                            <View style={styles.videoTileOverlay}>
                              <View style={styles.videoTileStat}>
                                <Ionicons name="play" size={10} color="#fff" />
                                <Text style={styles.videoTileCount}>{formatCount(v.viewCount)}</Text>
                              </View>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Users */}
                {searchResults.users && searchResults.users.length > 0 && (
                  <View style={styles.resultSection}>
                    {(searchTab === 'all') && <Text style={styles.resultSectionTitle}>Users</Text>}
                    {searchResults.users.map(u => (
                      <TouchableOpacity
                        key={u.id}
                        style={styles.userRow}
                        onPress={() => navigation.navigate('UserProfile', { username: u.username })}
                      >
                        <View style={styles.userAvatar}>
                          {u.avatarUrl ? (
                            <Image source={{ uri: u.avatarUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                          ) : (
                            <Text style={styles.userAvatarText}>{(u.username || '?')[0].toUpperCase()}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={styles.userName}>{u.username}</Text>
                            {u.isVerified && <Ionicons name="checkmark-circle" size={14} color={colors.secondary} />}
                          </View>
                          <Text style={styles.userMeta}>{u.displayName || ''} · {formatCount(u.followerCount)} followers</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Hashtags */}
                {searchResults.hashtags && searchResults.hashtags.length > 0 && (
                  <View style={styles.resultSection}>
                    {(searchTab === 'all') && <Text style={styles.resultSectionTitle}>Hashtags</Text>}
                    {searchResults.hashtags.map(h => (
                      <TouchableOpacity
                        key={h.id || h.name}
                        style={styles.hashtagRow}
                        onPress={() => navigation.navigate('HashtagPage', { name: h.name })}
                      >
                        <View style={styles.hashtagIcon}>
                          <Text style={styles.hashtagHash}>#</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.hashtagName}>{h.name}</Text>
                          <Text style={styles.hashtagMeta}>{formatCount(h.videoCount)} videos</Text>
                        </View>
                        {h.trendingScore > 0 && (
                          <Ionicons name="trending-up" size={18} color={colors.tertiary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Empty state */}
                {(!searchResults.videos || searchResults.videos.length === 0) &&
                 (!searchResults.users || searchResults.users.length === 0) &&
                 (!searchResults.hashtags || searchResults.hashtags.length === 0) && (
                  <View style={styles.emptyResults}>
                    <Ionicons name="search-outline" size={48} color={colors.textMuted} />
                    <Text style={styles.emptyTitle}>No results found</Text>
                    <Text style={styles.emptySubtitle}>Try a different search term</Text>
                  </View>
                )}
                <View style={{ height: 120 }} />
              </ScrollView>
            )}
          </>
        )}

        {/* Search history (shown when no results and no suggestions) */}
        {!searchResults && suggestions.length === 0 && history.length > 0 && (
          <View style={styles.historyContainer}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Recent Searches</Text>
              <TouchableOpacity onPress={clearHistory}>
                <Text style={styles.historyClear}>Clear</Text>
              </TouchableOpacity>
            </View>
            {history.map((q, i) => (
              <TouchableOpacity
                key={i}
                style={styles.historyItem}
                onPress={() => { setSearchQuery(q); executeSearch(q); }}
              >
                <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                <Text style={styles.historyText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </SafeAreaView>
    );
  }

  // ── DISCOVER MODE (default) ──
  return (
    <SafeAreaView style={styles.container}>
      {/* Search bar (tap to activate search) */}
      <TouchableOpacity
        style={[styles.searchBar, { margin: spacing.md }]}
        onPress={() => { setIsSearching(true); setTimeout(() => inputRef.current?.focus(), 100); }}
        activeOpacity={0.8}
      >
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <Text style={styles.searchPlaceholder}>Search users, videos, hashtags...</Text>
      </TouchableOpacity>

      {discoverLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDiscover(); }} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Trending Hashtags */}
          {discover?.trendingHashtags?.length > 0 && (
            <View style={styles.discoverSection}>
              <Text style={styles.sectionTitle}>Trending Hashtags</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {discover.trendingHashtags.map(h => (
                  <TouchableOpacity
                    key={h.id || h.name}
                    style={styles.hashtagChip}
                    onPress={() => navigation.navigate('HashtagPage', { name: h.name })}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.chipText}>#{h.name}</Text>
                    <Text style={styles.chipCount}>{formatCount(h.videoCount)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Popular Creators */}
          {discover?.popularCreators?.length > 0 && (
            <View style={styles.discoverSection}>
              <Text style={styles.sectionTitle}>Popular Creators</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.creatorsRow}>
                {discover.popularCreators.map(u => (
                  <TouchableOpacity
                    key={u.id}
                    style={styles.creatorCard}
                    onPress={() => navigation.navigate('UserProfile', { username: u.username })}
                    activeOpacity={0.8}
                  >
                    <View style={styles.creatorAvatar}>
                      {u.avatarUrl ? (
                        <Image source={{ uri: u.avatarUrl }} style={{ width: 56, height: 56, borderRadius: 28 }} />
                      ) : (
                        <Text style={styles.creatorAvatarText}>{(u.username || '?')[0].toUpperCase()}</Text>
                      )}
                    </View>
                    <Text style={styles.creatorName} numberOfLines={1}>@{u.username}</Text>
                    <Text style={styles.creatorFollowers}>{formatCount(u.followerCount)} fans</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Rising Videos */}
          {discover?.risingVideos?.length > 0 && (
            <View style={styles.discoverSection}>
              <Text style={styles.sectionTitle}>Rising Videos</Text>
              <View style={styles.videoGrid}>
                {discover.risingVideos.map((v, idx) => (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.videoTile, { width: tileWidth, height: tileWidth * 1.4 }]}
                    onPress={() => navigation.navigate('VideoPlayer', {
                      videos: discover.risingVideos,
                      startIndex: idx,
                    })}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.videoTileInner, { backgroundColor: colors.surfaceContainer }]}>
                      {v.thumbnailUrl ? (
                        <Image source={{ uri: v.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      ) : (
                        <Ionicons name="videocam" size={24} color={colors.textMuted} />
                      )}
                      <View style={styles.videoTileOverlay}>
                        <View style={styles.videoTileStat}>
                          <Ionicons name="play" size={10} color="#fff" />
                          <Text style={styles.videoTileCount}>{formatCount(v.viewCount)}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.videoTileCaption} numberOfLines={2}>{v.caption}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Search bar
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 24, paddingHorizontal: spacing.md, gap: spacing.sm },
  searchInput: { flex: 1, color: colors.text, fontSize: fontSize.md, paddingVertical: Platform.OS === 'web' ? 12 : spacing.sm },
  searchPlaceholder: { flex: 1, color: colors.textMuted, fontSize: fontSize.md, paddingVertical: spacing.md },
  cancelBtn: { paddingVertical: spacing.sm },
  cancelText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },

  // Suggestions
  suggestionsContainer: { marginHorizontal: spacing.md, backgroundColor: colors.surfaceContainer, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  suggestionText: { flex: 1, color: colors.text, fontSize: fontSize.md, fontWeight: '500' },
  suggestionMeta: { color: colors.textMuted, fontSize: fontSize.xs },

  // Tabs
  tabBar: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.sm },
  tabItem: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, backgroundColor: colors.glass },
  tabItemActive: { backgroundColor: colors.primaryDim },
  tabText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  // Results
  resultsContainer: { paddingHorizontal: spacing.md },
  resultSection: { marginBottom: spacing.lg },
  resultSectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700', marginBottom: spacing.sm },

  // Video grid
  videoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.md },
  videoTile: { marginBottom: spacing.sm },
  videoTileInner: { flex: 1, borderRadius: 10, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  videoTileOverlay: { position: 'absolute', bottom: 4, left: 4, flexDirection: 'row' },
  videoTileStat: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
  videoTileCount: { color: '#fff', fontSize: 9, fontWeight: '700' },
  videoTileCaption: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 4, lineHeight: 14 },

  // User results
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md },
  userAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceContainerHigh, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  userAvatarText: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  userName: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  userMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },

  // Hashtag results
  hashtagRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  hashtagIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(170, 48, 250, 0.15)', justifyContent: 'center', alignItems: 'center' },
  hashtagHash: { color: colors.primary, fontSize: fontSize.xl, fontWeight: '800' },
  hashtagName: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  hashtagMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },

  // Empty
  emptyResults: { alignItems: 'center', paddingTop: 60, gap: spacing.sm },
  emptyTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  emptySubtitle: { color: colors.textMuted, fontSize: fontSize.md },

  // History
  historyContainer: { paddingHorizontal: spacing.md, marginTop: spacing.sm },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  historyTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  historyClear: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  historyText: { color: colors.textSecondary, fontSize: fontSize.md },

  // Discover sections
  discoverSection: { marginBottom: spacing.lg },
  sectionTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800', paddingHorizontal: spacing.md, marginBottom: spacing.md },
  chipRow: { paddingHorizontal: spacing.md, gap: spacing.sm },
  hashtagChip: { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700' },
  chipCount: { color: colors.textMuted, fontSize: fontSize.xs },

  // Creator cards
  creatorsRow: { paddingHorizontal: spacing.md, gap: spacing.md },
  creatorCard: { width: 90, alignItems: 'center', gap: 4 },
  creatorAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.surfaceContainerHigh, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.primary, overflow: 'hidden' },
  creatorAvatarText: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  creatorName: { color: colors.text, fontSize: fontSize.xs, fontWeight: '600', textAlign: 'center' },
  creatorFollowers: { color: colors.textMuted, fontSize: 9, textAlign: 'center' },
});
