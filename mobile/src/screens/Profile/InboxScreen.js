import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import api from '../../services/api';
import useMessageStore from '../../store/messageStore';
import useAuthStore from '../../store/authStore';
import { colors, spacing, fontSize } from '../../utils/theme';

// ── helpers ──────────────────────────────────────────────────────────
function relativeTime(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

function truncate(str, max = 50) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

// ── component ────────────────────────────────────────────────────────
export default function InboxScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { conversations, setConversations } = useMessageStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/messages');
      setConversations(data);
    } catch (err) {
      console.error('[Inbox] Failed to load conversations:', err.message);
    }
  }, [setConversations]);

  // Initial load
  useEffect(() => {
    fetchConversations().finally(() => setLoading(false));
  }, []);

  // Re-fetch on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  }, [fetchConversations]);

  const getOtherUser = (conversation) => {
    if (!conversation.participants) return {};
    return conversation.participants.find((p) => p.id !== user?.id) || conversation.participants[0] || {};
  };

  const renderItem = ({ item }) => {
    const other = getOtherUser(item);
    const hasUnread = (item.unreadCount || 0) > 0;
    const lastMsg = item.lastMessage;

    let preview = '';
    if (lastMsg) {
      if (lastMsg.type === 'video_share') {
        preview = 'Shared a video';
      } else if (lastMsg.type === 'image') {
        preview = 'Sent a photo';
      } else {
        preview = truncate(lastMsg.content);
      }
    }

    return (
      <TouchableOpacity
        style={styles.conversationRow}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('Chat', {
            conversationId: item.id,
            otherUser: {
              id: other.id,
              username: other.username,
              displayName: other.displayName,
              avatarUrl: other.avatarUrl,
            },
          })
        }
      >
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {other.avatarUrl ? (
            <Image source={{ uri: other.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>
                {(other.username || '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Text content */}
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text
              style={[styles.username, hasUnread && styles.usernameBold]}
              numberOfLines={1}
            >
              {other.displayName || other.username || 'Unknown'}
            </Text>
            <Text style={styles.timestamp}>
              {relativeTime(lastMsg?.createdAt || item.updatedAt)}
            </Text>
          </View>
          <View style={styles.previewRow}>
            <Text
              style={[styles.preview, hasUnread && styles.previewUnread]}
              numberOfLines={1}
            >
              {preview || 'Start a conversation'}
            </Text>
            {hasUnread && <View style={styles.unreadDot} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── empty state ────────────────────────────────────────────────────
  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.empty}>
        <Ionicons name="chatbubbles-outline" size={56} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No messages yet</Text>
        <Text style={styles.emptySubtext}>
          Start a conversation from someone's profile!
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryDim} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={conversations.length === 0 ? { flex: 1 } : { paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primaryDim}
              colors={[colors.primaryDim]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  headerTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Conversation row
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    gap: spacing.sm + 4,
  },
  avatarContainer: {
    width: 48,
    height: 48,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  conversationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  username: {
    color: colors.text,
    fontSize: fontSize.md,
    flex: 1,
    marginRight: spacing.sm,
  },
  usernameBold: {
    fontWeight: '700',
  },
  timestamp: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  preview: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    flex: 1,
  },
  previewUnread: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
    marginLeft: spacing.sm,
  },

  // Empty state
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    textAlign: 'center',
  },
});
