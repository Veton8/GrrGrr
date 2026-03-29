import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { colors, spacing, fontSize } from '../../utils/theme';

export default function ContactPickerModal({ route, navigation }) {
  const { videoId, thumbnailUrl, caption } = route.params || {};
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null); // userId being sent to

  // Fetch recent conversations + followers as contacts
  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const { data } = await api.get('/messages/contacts');
      setContacts(data);
    } catch (err) {
      // Fallback: load conversations
      try {
        const { data } = await api.get('/messages');
        const users = data.map((c) => {
          const other = c.participants?.find((p) => p.id !== c.currentUserId) || c.participants?.[0];
          return other ? { ...other, conversationId: c.id } : null;
        }).filter(Boolean);
        setContacts(users);
      } catch (e) {
        console.error('[ContactPicker] Failed to load contacts:', e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const filtered = search.trim()
    ? contacts.filter(
        (c) =>
          c.username?.toLowerCase().includes(search.toLowerCase()) ||
          c.displayName?.toLowerCase().includes(search.toLowerCase())
      )
    : contacts;

  const handleSelect = useCallback(
    async (contact) => {
      if (sending) return;
      setSending(contact.id);

      try {
        // Create or get conversation
        let convId = contact.conversationId;
        if (!convId) {
          const { data } = await api.post('/messages', { participantId: contact.id });
          convId = data.id;
        }

        // Send video share message
        await api.post(`/messages/${convId}/messages`, {
          type: 'video_share',
          content: caption || '',
          videoId,
          thumbnailUrl,
        });

        Alert.alert('Sent!', `Video shared with ${contact.displayName || contact.username}`);
        navigation.goBack();
      } catch (err) {
        Alert.alert('Error', 'Failed to share video. Please try again.');
      } finally {
        setSending(null);
      }
    },
    [videoId, thumbnailUrl, caption, sending, navigation]
  );

  const renderContact = ({ item }) => (
    <TouchableOpacity
      style={styles.contactRow}
      activeOpacity={0.7}
      onPress={() => handleSelect(item)}
      disabled={sending === item.id}
    >
      {item.avatarUrl ? (
        <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarFallbackText}>
            {(item.username || '?')[0].toUpperCase()}
          </Text>
        </View>
      )}

      <View style={styles.contactInfo}>
        <Text style={styles.contactName} numberOfLines={1}>
          {item.displayName || item.username}
        </Text>
        <Text style={styles.contactUsername} numberOfLines={1}>
          @{item.username}
        </Text>
      </View>

      {sending === item.id ? (
        <ActivityIndicator size="small" color={colors.primaryDim} />
      ) : (
        <View style={styles.sendIcon}>
          <Ionicons name="paper-plane-outline" size={18} color={colors.primary} />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Video</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryDim} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderContact}
          contentContainerStyle={filtered.length === 0 ? { flex: 1 } : { paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                {search.trim() ? 'No contacts found' : 'No contacts yet'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  headerTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderRadius: 12,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm + 2 : spacing.xs,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.xs : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    gap: spacing.sm + 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  contactUsername: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: 1,
  },
  sendIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
  },
});
