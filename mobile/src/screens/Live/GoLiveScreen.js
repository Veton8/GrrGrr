import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../../utils/theme';

export default function GoLiveScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [selectedFilter, setSelectedFilter] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const filters = [
    { id: 'beauty', label: 'Beauty', icon: 'sparkles' },
    { id: 'funny', label: 'Funny', icon: 'happy' },
    { id: 'cool', label: 'Cool', icon: 'snow' },
    { id: 'vintage', label: 'Vintage', icon: 'film' },
  ];

  // Pulsing Go LIVE button
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1000,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <View style={styles.container}>
      {/* Mock camera preview */}
      <View style={styles.cameraPreview}>
        <View style={styles.cameraInner}>
          <Ionicons name="camera" size={80} color={colors.textMuted} style={{ opacity: 0.3 }} />
          <Text style={styles.cameraHint}>Camera preview</Text>
        </View>
      </View>

      {/* Top bar */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Go Live</Text>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      {/* Camera controls (right side) */}
      <View style={styles.cameraControls}>
        <TouchableOpacity style={styles.cameraControlBtn}>
          <View style={styles.controlCircle}>
            <Ionicons name="camera-reverse-outline" size={22} color={colors.text} />
          </View>
          <Text style={styles.cameraControlLabel}>Flip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cameraControlBtn}>
          <View style={styles.controlCircle}>
            <Ionicons name="flash-outline" size={22} color={colors.text} />
          </View>
          <Text style={styles.cameraControlLabel}>Flash</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cameraControlBtn}>
          <View style={styles.controlCircle}>
            <Ionicons name="timer-outline" size={22} color={colors.text} />
          </View>
          <Text style={styles.cameraControlLabel}>Timer</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom controls */}
      <SafeAreaView style={styles.bottomSection} edges={['bottom']}>
        {/* Filter chips row */}
        <View style={styles.filtersRow}>
          {filters.map((filter) => {
            const isActive = selectedFilter === filter.id;
            return (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                ]}
                onPress={() =>
                  setSelectedFilter(isActive ? null : filter.id)
                }
              >
                <Ionicons
                  name={filter.icon}
                  size={14}
                  color={isActive ? '#fff' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.filterLabel,
                    isActive && styles.filterLabelActive,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Title input */}
        <TextInput
          style={styles.titleInput}
          placeholder="Add a title for your stream..."
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />

        {/* Action row */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn}>
            <View style={styles.actionBtnCircle}>
              <Ionicons name="color-wand-outline" size={22} color={colors.text} />
            </View>
            <Text style={styles.actionLabel}>Effects</Text>
          </TouchableOpacity>

          {/* Go Live button */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity style={styles.goLiveButton} activeOpacity={0.8}>
              <View style={styles.goLiveInner}>
                <Ionicons name="radio" size={26} color="#fff" />
                <Text style={styles.goLiveText}>Go LIVE</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity style={styles.actionBtn}>
            <View style={styles.actionBtnCircle}>
              <Ionicons name="people-outline" size={22} color={colors.text} />
            </View>
            <Text style={styles.actionLabel}>Battle</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cameraPreview: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraInner: {
    flex: 1,
    backgroundColor: colors.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraHint: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
    opacity: 0.5,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },

  // Camera controls
  cameraControls: {
    position: 'absolute',
    right: spacing.md,
    top: 120,
    gap: spacing.lg,
    alignItems: 'center',
  },
  cameraControlBtn: {
    alignItems: 'center',
    gap: 6,
  },
  controlCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraControlLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },

  // Bottom section
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    gap: spacing.md,
  },

  // Filter chips
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.glass,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  filterChipActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  filterLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  filterLabelActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // Title input
  titleInput: {
    backgroundColor: colors.glass,
    borderRadius: 14,
    padding: spacing.md,
    color: colors.text,
    fontSize: fontSize.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.md,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 6,
  },
  actionBtnCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },

  // Go Live button
  goLiveButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  goLiveInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryDim,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    elevation: 8,
    shadowColor: colors.primaryDim,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  goLiveText: {
    color: '#fff',
    fontSize: fontSize.xs,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
