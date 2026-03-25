import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../../utils/theme';

export default function InboxScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Inbox</Text>
      <View style={styles.empty}>
        <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyText}>No messages yet</Text>
        <Text style={styles.emptySubtext}>Messages and notifications will appear here</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
    padding: spacing.md,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: { color: colors.textSecondary, fontSize: fontSize.lg },
  emptySubtext: { color: colors.textMuted, fontSize: fontSize.md },
});
