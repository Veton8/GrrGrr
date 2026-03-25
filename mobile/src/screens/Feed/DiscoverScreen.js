import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../../utils/theme';

const { width } = Dimensions.get('window');
const TILE_SIZE = (width - spacing.sm * 4) / 3;

export default function DiscoverScreen({ navigation }) {
  const [search, setSearch] = useState('');

  // Placeholder trending data
  const trending = [
    { id: '1', tag: '#dance', count: '2.4M' },
    { id: '2', tag: '#comedy', count: '1.8M' },
    { id: '3', tag: '#battle', count: '950K' },
    { id: '4', tag: '#music', count: '3.1M' },
    { id: '5', tag: '#challenge', count: '1.2M' },
    { id: '6', tag: '#viral', count: '5.7M' },
    { id: '7', tag: '#gaming', count: '2.1M' },
    { id: '8', tag: '#cooking', count: '890K' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users, videos, sounds..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <Text style={styles.sectionTitle}>Trending</Text>
      <FlatList
        data={trending}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.trendItem}>
            <View style={styles.trendIcon}>
              <Ionicons name="trending-up" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.trendTag}>{item.tag}</Text>
              <Text style={styles.trendCount}>{item.count} views</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        ListFooterComponent={<View style={{ height: 100 }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    margin: spacing.md,
    borderRadius: 24,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.md,
    paddingVertical: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  trendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  trendIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(170, 48, 250, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendTag: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  trendCount: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
});
