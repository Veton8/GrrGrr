import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { colors, spacing, fontSize } from '../../utils/theme';

const PREF_LABELS = [
  { key: 'likes', label: 'Likes', icon: 'heart', desc: 'When someone likes your video' },
  { key: 'comments', label: 'Comments', icon: 'chatbubble', desc: 'When someone comments on your video' },
  { key: 'new_followers', label: 'New Followers', icon: 'person-add', desc: 'When someone follows you' },
  { key: 'live_started', label: 'Live Streams', icon: 'radio', desc: 'When someone you follow goes live' },
  { key: 'gifts', label: 'Gifts', icon: 'gift', desc: 'When you receive a gift' },
  { key: 'mentions', label: 'Mentions', icon: 'at', desc: 'When someone mentions you' },
  { key: 'direct_messages', label: 'Direct Messages', icon: 'mail', desc: 'When you receive a message' },
];

export default function NotificationSettingsScreen({ navigation }) {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrefs();
  }, []);

  const fetchPrefs = async () => {
    try {
      const { data } = await api.get('/notifications/preferences');
      setPrefs(data.preferences);
    } catch (err) {
      console.warn('Failed to fetch prefs:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePref = async (key) => {
    const newValue = !prefs[key];
    setPrefs((prev) => ({ ...prev, [key]: newValue }));
    try {
      await api.put('/notifications/preferences', { preferences: { [key]: newValue } });
    } catch {
      // Revert on failure
      setPrefs((prev) => ({ ...prev, [key]: !newValue }));
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionLabel}>Push Notifications</Text>
        {PREF_LABELS.map(({ key, label, icon, desc }) => (
          <View key={key} style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <Ionicons name={icon} size={20} color={colors.primary} style={styles.prefIcon} />
              <View>
                <Text style={styles.prefLabel}>{label}</Text>
                <Text style={styles.prefDesc}>{desc}</Text>
              </View>
            </View>
            <Switch
              value={prefs?.[key] ?? true}
              onValueChange={() => togglePref(key)}
              trackColor={{ false: colors.surfaceContainerHigh, true: colors.primaryDim }}
              thumbColor={prefs?.[key] ? colors.primary : colors.textMuted}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 8 },
  headerTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700', marginLeft: spacing.sm },
  scrollContent: { padding: spacing.md },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  prefLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing.md },
  prefIcon: { marginRight: spacing.sm },
  prefLabel: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  prefDesc: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
});
