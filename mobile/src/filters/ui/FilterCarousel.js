import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../../utils/theme';

/* ───────────── Data ───────────── */

const CATEGORIES = [
  { id: 'funny', label: 'Funny' },
  { id: 'fantasy', label: 'Fantasy' },
  { id: 'effects', label: 'Effects' },
];

const FILTERS = [
  { id: 'none', name: 'None', emoji: '\u2715', category: null },
  // Funny
  { id: 'dog', name: 'Dog', emoji: '\uD83D\uDC15', category: 'funny' },
  { id: 'cat', name: 'Cat', emoji: '\uD83D\uDC31', category: 'funny' },
  { id: 'sunglasses', name: 'Shades', emoji: '\uD83D\uDE0E', category: 'funny' },
  // Fantasy
  { id: 'crown', name: 'Crown', emoji: '\uD83D\uDC51', category: 'fantasy' },
  { id: 'devil', name: 'Devil', emoji: '\uD83D\uDE08', category: 'fantasy' },
  { id: 'angel', name: 'Angel', emoji: '\uD83D\uDE07', category: 'fantasy' },
  // Effects
  { id: 'flameAura', name: 'Flame', emoji: '\uD83D\uDD25', category: 'effects' },
  { id: 'sparkleFrame', name: 'Sparkle', emoji: '\u2728', category: 'effects' },
];

/* ───────────── Category Tab ───────────── */

function CategoryTab({ category, isActive, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.tab}>
      <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
        {category.label}
      </Text>
      {isActive && <View style={styles.tabUnderline} />}
    </Pressable>
  );
}

/* ───────────── Filter Item ───────────── */

function FilterItem({ filter, isSelected, onSelect }) {
  const scaleAnim = useRef(new Animated.Value(isSelected ? 1 : 0.9)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isSelected ? 1 : 0.9,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [isSelected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Brief name flash on selection
  useEffect(() => {
    if (isSelected) {
      nameOpacity.setValue(1);
      const timeout = setTimeout(() => {
        Animated.timing(nameOpacity, {
          toValue: 0,
          duration: 400,
          delay: 1100,
          useNativeDriver: true,
        }).start();
      }, 0);
      return () => clearTimeout(timeout);
    } else {
      nameOpacity.setValue(0);
    }
  }, [isSelected]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.itemWrapper}>
      <Pressable onPress={() => onSelect(filter.id)}>
        <Animated.View
          style={[
            styles.filterCircle,
            isSelected && styles.filterCircleSelected,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Text style={styles.emoji}>{filter.emoji}</Text>
        </Animated.View>
      </Pressable>
      <Animated.Text
        style={[styles.filterName, { opacity: nameOpacity }]}
        numberOfLines={1}
      >
        {filter.name}
      </Animated.Text>
    </View>
  );
}

/* ───────────── Main Carousel ───────────── */

export default function FilterCarousel({
  selectedFilter,
  onSelectFilter,
  selectedCategory,
  onSelectCategory,
}) {
  const visibleFilters = FILTERS.filter(
    (f) => f.category === null || f.category === selectedCategory,
  );

  const handleSelectCategory = useCallback(
    (catId) => {
      onSelectCategory(catId);
    },
    [onSelectCategory],
  );

  return (
    <View style={styles.container}>
      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
      >
        {CATEGORIES.map((cat) => (
          <CategoryTab
            key={cat.id}
            category={cat}
            isActive={selectedCategory === cat.id}
            onPress={() => handleSelectCategory(cat.id)}
          />
        ))}
      </ScrollView>

      {/* Filter items */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {visibleFilters.map((f) => (
          <FilterItem
            key={f.id}
            filter={f}
            isSelected={selectedFilter === f.id}
            onSelect={onSelectFilter}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/* ───────────── Styles ───────────── */

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },

  /* tabs */
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 20,
    marginBottom: 12,
  },
  tab: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.primary,
  },
  tabUnderline: {
    marginTop: 4,
    width: '100%',
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },

  /* filter items */
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 14,
    alignItems: 'flex-start',
  },
  itemWrapper: {
    alignItems: 'center',
    width: 72,
  },
  filterCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.glass,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCircleSelected: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 6,
  },
  emoji: {
    fontSize: 28,
  },
  filterName: {
    fontSize: 11,
    color: colors.text,
    marginTop: 6,
    textAlign: 'center',
  },
});
