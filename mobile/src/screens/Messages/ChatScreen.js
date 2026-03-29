import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../services/api';
import { getMessagesSocket } from '../../services/socket';
import useAuthStore from '../../store/authStore';
import useMessageStore from '../../store/messageStore';
import { colors, spacing, fontSize } from '../../utils/theme';

// ── helpers ──────────────────────────────────────────────────────────
function formatMessageTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function getDayLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today - msgDay) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function shouldShowDaySeparator(currentMsg, prevMsg) {
  if (!prevMsg) return true;
  const a = new Date(currentMsg.createdAt).toDateString();
  const b = new Date(prevMsg.createdAt).toDateString();
  return a !== b;
}

// ── typing dots animation ────────────────────────────────────────────
function TypingIndicator({ username }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - delay),
        ])
      );
    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 150);
    const a3 = animate(dot3, 300);
    a1.start();
    a2.start();
    a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  const dotStyle = (dot) => ({
    opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
  });

  return (
    <View style={styles.typingContainer}>
      <Text style={styles.typingText}>{username} is typing</Text>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.Text key={i} style={[styles.typingDot, dotStyle(dot)]}>.</Animated.Text>
      ))}
    </View>
  );
}

// ── main component ───────────────────────────────────────────────────
export default function ChatScreen({ route, navigation }) {
  const { conversationId, otherUser } = route.params;
  const { user } = useAuthStore();
  const { setActiveConversation, markConversationRead } = useMessageStore();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [lastReadAt, setLastReadAt] = useState(null);

  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingEmitRef = useRef(0);

  // ── mark conversation active / inactive ────────────────────────────
  useFocusEffect(
    useCallback(() => {
      setActiveConversation(conversationId);
      markRead();
      return () => setActiveConversation(null);
    }, [conversationId])
  );

  // ── fetch messages ─────────────────────────────────────────────────
  const fetchMessages = useCallback(async (before) => {
    try {
      const params = { limit: 30 };
      if (before) params.before = before;
      const { data } = await api.get(`/messages/${conversationId}/messages`, { params });
      if (data.length < 30) setHasMore(false);
      return data;
    } catch (err) {
      console.error('[Chat] fetchMessages error:', err.message);
      return [];
    }
  }, [conversationId]);

  useEffect(() => {
    fetchMessages().then((data) => {
      setMessages(data);
      setLoading(false);
    });
  }, [fetchMessages]);

  // ── mark as read ───────────────────────────────────────────────────
  const markRead = useCallback(async () => {
    try {
      await api.patch(`/messages/${conversationId}/read`);
      markConversationRead(conversationId);
      const socket = getMessagesSocket();
      if (socket) socket.emit('dm:read', { conversationId });
    } catch (err) {
      // silent
    }
  }, [conversationId, markConversationRead]);

  // ── socket events ──────────────────────────────────────────────────
  useEffect(() => {
    const socket = getMessagesSocket();
    if (!socket) return;

    const onMessage = (message) => {
      if (message.conversationId !== conversationId) return;
      setMessages((prev) => [message, ...prev]);
      // If screen is focused, mark as read immediately
      markRead();
    };

    const onTyping = (data) => {
      if (data.conversationId === conversationId && data.userId !== user?.id) {
        setIsTyping(true);
      }
    };

    const onStopTyping = (data) => {
      if (data.conversationId === conversationId && data.userId !== user?.id) {
        setIsTyping(false);
      }
    };

    const onRead = (data) => {
      if (data.conversationId === conversationId && data.userId !== user?.id) {
        setLastReadAt(data.readAt || new Date().toISOString());
      }
    };

    const onDeleted = (data) => {
      if (data.conversationId === conversationId) {
        setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
      }
    };

    socket.on('dm:message', onMessage);
    socket.on('dm:typing', onTyping);
    socket.on('dm:stop_typing', onStopTyping);
    socket.on('dm:read', onRead);
    socket.on('dm:deleted', onDeleted);

    return () => {
      socket.off('dm:message', onMessage);
      socket.off('dm:typing', onTyping);
      socket.off('dm:stop_typing', onStopTyping);
      socket.off('dm:read', onRead);
      socket.off('dm:deleted', onDeleted);
    };
  }, [conversationId, user?.id, markRead]);

  // ── load older messages ────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[messages.length - 1];
    const older = await fetchMessages(oldest?.createdAt || oldest?.id);
    setMessages((prev) => [...prev, ...older]);
    setLoadingMore(false);
  }, [loadingMore, hasMore, messages, fetchMessages]);

  // ── send message ───────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const content = text.trim();
    if (!content) return;
    setText('');

    // Optimistic message
    const tempId = `temp_${Date.now()}`;
    const optimistic = {
      id: tempId,
      conversationId,
      senderId: user?.id,
      type: 'text',
      content,
      createdAt: new Date().toISOString(),
      _sending: true,
    };
    setMessages((prev) => [optimistic, ...prev]);

    // Stop typing
    const socket = getMessagesSocket();
    if (socket) socket.emit('dm:stop_typing', { conversationId });

    try {
      const { data } = await api.post(`/messages/${conversationId}/messages`, {
        type: 'text',
        content,
      });
      // Replace optimistic with real message
      setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));
    } catch (err) {
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  }, [text, conversationId, user?.id]);

  // ── typing indicator ───────────────────────────────────────────────
  const handleTextChange = useCallback(
    (value) => {
      setText(value);

      const socket = getMessagesSocket();
      if (!socket) return;

      const now = Date.now();
      if (now - lastTypingEmitRef.current > 500) {
        socket.emit('dm:typing', { conversationId });
        lastTypingEmitRef.current = now;
      }

      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('dm:stop_typing', { conversationId });
      }, 2000);
    },
    [conversationId]
  );

  // ── delete message ─────────────────────────────────────────────────
  const handleLongPress = useCallback(
    (message) => {
      if (message.senderId !== user?.id) return;
      Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/messages/${conversationId}/messages/${message.id}`);
              setMessages((prev) => prev.filter((m) => m.id !== message.id));
            } catch (err) {
              Alert.alert('Error', 'Failed to delete message.');
            }
          },
        },
      ]);
    },
    [conversationId, user?.id]
  );

  // ── render message ─────────────────────────────────────────────────
  const renderMessage = useCallback(
    ({ item, index }) => {
      const isMine = item.senderId === user?.id;
      // Because list is inverted, the "previous" message is at index+1
      const prevMessage = messages[index + 1];
      const showDay = shouldShowDaySeparator(item, prevMessage);

      // Read receipt: show on the last sent message if the other user has read it
      const isLastSentByMe =
        isMine && (index === 0 || messages.slice(0, index).every((m) => m.senderId !== user?.id));
      const showReadReceipt =
        isLastSentByMe && lastReadAt && new Date(lastReadAt) >= new Date(item.createdAt);

      return (
        <View>
          {/* Day separator (rendered below because list is inverted) */}
          {showDay && (
            <View style={styles.daySeparator}>
              <View style={styles.daySeparatorLine} />
              <Text style={styles.daySeparatorText}>{getDayLabel(item.createdAt)}</Text>
              <View style={styles.daySeparatorLine} />
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            onLongPress={() => handleLongPress(item)}
            delayLongPress={500}
            style={[styles.messageBubbleRow, isMine ? styles.myRow : styles.theirRow]}
          >
            {/* Video share */}
            {item.type === 'video_share' ? (
              <View style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble, styles.videoBubble]}>
                {item.thumbnailUrl && (
                  <Image source={{ uri: item.thumbnailUrl }} style={styles.videoThumb} />
                )}
                <View style={styles.videoPlayOverlay}>
                  <Ionicons name="play-circle" size={36} color="rgba(255,255,255,0.9)" />
                </View>
                {item.content ? (
                  <Text style={[styles.messageText, isMine && styles.myText]}>{item.content}</Text>
                ) : null}
              </View>
            ) : item.type === 'image' ? (
              <View style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble, styles.imageBubble]}>
                <Image source={{ uri: item.content || item.imageUrl }} style={styles.imagePreview} />
              </View>
            ) : (
              <View style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}>
                <Text style={[styles.messageText, isMine && styles.myText]}>{item.content}</Text>
              </View>
            )}

            <Text style={[styles.messageTime, isMine && styles.myTime]}>
              {formatMessageTime(item.createdAt)}
              {item._sending && '  Sending...'}
            </Text>

            {showReadReceipt && <Text style={styles.readReceipt}>Read</Text>}
          </TouchableOpacity>
        </View>
      );
    },
    [user?.id, messages, lastReadAt, handleLongPress]
  );

  // ── render ─────────────────────────────────────────────────────────
  const webContainerStyle =
    Platform.OS === 'web' ? { maxWidth: 500, alignSelf: 'center', width: '100%' } : {};

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerProfile}>
          {otherUser.avatarUrl ? (
            <Image source={{ uri: otherUser.avatarUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarFallback}>
              <Text style={styles.headerAvatarText}>
                {(otherUser.username || '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.headerName}>
              {otherUser.displayName || otherUser.username}
            </Text>
            {otherOnline && <Text style={styles.headerOnline}>Online</Text>}
          </View>
        </View>

        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={[styles.chatArea, webContainerStyle]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primaryDim} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            inverted
            contentContainerStyle={styles.messagesList}
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primaryDim}
                  style={{ paddingVertical: spacing.md }}
                />
              ) : null
            }
            ListHeaderComponent={
              isTyping ? <TypingIndicator username={otherUser.displayName || otherUser.username} /> : null
            }
          />
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Message..."
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={handleTextChange}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!text.trim()}
            activeOpacity={0.7}
          >
            <Ionicons
              name="paper-plane"
              size={20}
              color={text.trim() ? '#fff' : colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  headerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  headerName: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  headerOnline: {
    color: colors.success,
    fontSize: fontSize.xs,
  },

  // Chat area
  chatArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  // Day separator
  daySeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  daySeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  daySeparatorText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },

  // Message rows
  messageBubbleRow: {
    marginVertical: 3,
    maxWidth: '78%',
  },
  myRow: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  theirRow: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },

  // Bubbles
  bubble: {
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  myBubble: {
    backgroundColor: colors.primaryDim,
    borderBottomRightRadius: 6,
  },
  theirBubble: {
    backgroundColor: colors.surfaceContainer,
    borderBottomLeftRadius: 6,
  },
  messageText: {
    color: colors.text,
    fontSize: fontSize.md,
    lineHeight: 20,
  },
  myText: {
    color: '#fff',
  },
  messageTime: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
    marginHorizontal: 4,
  },
  myTime: {
    textAlign: 'right',
  },
  readReceipt: {
    color: colors.secondary,
    fontSize: fontSize.xs,
    marginTop: 1,
    marginRight: 4,
  },

  // Video share
  videoBubble: {
    padding: 0,
    overflow: 'hidden',
  },
  videoThumb: {
    width: 200,
    height: 260,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },

  // Image
  imageBubble: {
    padding: 0,
    overflow: 'hidden',
  },
  imagePreview: {
    width: 200,
    height: 200,
    borderRadius: 20,
  },

  // Typing indicator
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  typingText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontStyle: 'italic',
  },
  typingDot: {
    color: colors.textMuted,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginLeft: 1,
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm + 2 : spacing.sm,
    color: colors.text,
    fontSize: fontSize.md,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.surfaceContainerHigh,
  },
});
