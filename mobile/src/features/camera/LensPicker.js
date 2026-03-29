import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Lens picker for Snap Camera Kit lenses.
 * Shows a horizontal scrollable list of available AR lenses.
 */
export default function LensPicker({
  lenses = [],
  activeLensId,
  onSelectLens,
  onClear,
  isLoading,
}) {
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#fff" />
        <Text style={styles.loadingText}>Loading lenses...</Text>
      </View>
    );
  }

  if (lenses.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>No AR lenses available</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {/* "None" option to clear lens */}
      <TouchableOpacity
        style={[styles.item, !activeLensId && styles.itemActive]}
        onPress={onClear}
        activeOpacity={0.7}
      >
        <View style={[styles.iconCircle, !activeLensId && styles.iconCircleActive]}>
          <Ionicons
            name="ban-outline"
            size={22}
            color={!activeLensId ? '#fff' : 'rgba(255,255,255,0.7)'}
          />
        </View>
        <Text style={[styles.label, !activeLensId && styles.labelActive]}>None</Text>
      </TouchableOpacity>

      {/* Snap lenses */}
      {lenses.map((lens) => {
        const active = lens.id === activeLensId;
        return (
          <TouchableOpacity
            key={lens.id}
            style={[styles.item, active && styles.itemActive]}
            onPress={() => onSelectLens(lens)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, active && styles.iconCircleActive]}>
              {lens.iconUrl ? (
                <Image
                  source={{ uri: lens.iconUrl }}
                  style={styles.lensIcon}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons
                  name="sparkles"
                  size={22}
                  color={active ? '#fff' : 'rgba(255,255,255,0.7)'}
                />
              )}
            </View>
            <Text
              style={[styles.label, active && styles.labelActive]}
              numberOfLines={1}
            >
              {lens.name || 'Lens'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginLeft: 8,
  },
  item: {
    alignItems: 'center',
    width: 68,
    paddingVertical: 6,
  },
  itemActive: {},
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  iconCircleActive: {
    backgroundColor: 'rgba(255, 252, 0, 0.4)',
    borderColor: '#FFFC00',
  },
  lensIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  label: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 3,
    textAlign: 'center',
  },
  labelActive: {
    color: '#fff',
  },
});
