import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { colors, spacing, fontSize } from '../../utils/theme';

export default function CommentsScreen({ route, navigation }) {
  const { videoId } = route.params;
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchComments();
  }, []);

  const fetchComments = async () => {
    try {
      const { data } = await api.get(`/feed/${videoId}/comments`);
      setComments(data);
    } catch (err) {
      console.error(err);
    }
  };

  const sendComment = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      await api.post(`/feed/${videoId}/comments`, { content: text.trim() });
      setText('');
      fetchComments();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Comments</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.comment}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(item.username || '?')[0].toUpperCase()}</Text>
            </View>
            <View style={styles.commentBody}>
              <Text style={styles.username}>{item.username}</Text>
              <Text style={styles.commentText}>{item.content}</Text>
              <Text style={styles.time}>{formatTime(item.created_at)}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No comments yet. Be the first!</Text>
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Add a comment..."
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity onPress={sendComment} disabled={loading || !text.trim()}>
            <Ionicons
              name="send"
              size={24}
              color={text.trim() ? colors.primary : colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  comment: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: colors.text, fontWeight: '700', fontSize: fontSize.sm },
  commentBody: { flex: 1 },
  username: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },
  commentText: { color: colors.text, fontSize: fontSize.md, marginTop: 2 },
  time: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 4 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 24,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: fontSize.md,
    maxHeight: 80,
  },
});
