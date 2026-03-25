import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../utils/theme';

const BEAUTY_OPTIONS = [
  { id: 'skinSmoothing', name: 'Smooth', icon: 'brush-outline' },
  { id: 'faceBrightening', name: 'Brighten', icon: 'sunny-outline' },
  { id: 'faceSlimming', name: 'Slim', icon: 'resize-outline' },
  { id: 'eyeEnlarge', name: 'Eyes', icon: 'eye-outline' },
  { id: 'lipColor', name: 'Lips', icon: 'color-palette-outline' },
];

const LIP_COLORS = [
  { key: 'classicRed', color: '#cc2936' },
  { key: 'rosePink', color: '#e87da0' },
  { key: 'berry', color: '#8e2462' },
  { key: 'nude', color: '#c89b7b' },
  { key: 'coral', color: '#f4845f' },
];

/* ───────────── Custom Slider ───────────── */

function IntensitySlider({ value, onValueChange }) {
  const trackRef = useRef(null);
  const [trackWidth, setTrackWidth] = useState(0);

  const handleLayout = useCallback((e) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const handlePress = useCallback(
    (e) => {
      if (trackWidth === 0) return;
      const x = e.nativeEvent.locationX;
      const clamped = Math.max(0, Math.min(100, Math.round((x / trackWidth) * 100)));
      onValueChange(clamped);
    },
    [trackWidth, onValueChange],
  );

  const fraction = value / 100;

  return (
    <View style={styles.sliderContainer}>
      <Text style={styles.sliderValue}>{value}</Text>
      <Pressable
        ref={trackRef}
        style={styles.sliderTrack}
        onLayout={handleLayout}
        onPress={handlePress}
        onMoveShouldSetResponder={() => true}
        onResponderMove={handlePress}
      >
        {/* filled portion */}
        <View
          style={[
            styles.sliderFill,
            { width: `${fraction * 100}%` },
          ]}
        />
        {/* thumb */}
        {trackWidth > 0 && (
          <View
            style={[
              styles.sliderThumb,
              { left: fraction * trackWidth - 8 },
            ]}
          />
        )}
      </Pressable>
    </View>
  );
}

/* ───────────── Lip Color Swatches ───────────── */

function LipColorSwatches({ selectedLipColor, onLipColorChange }) {
  return (
    <View style={styles.swatchRow}>
      {LIP_COLORS.map((lc) => {
        const selected = selectedLipColor === lc.key;
        return (
          <Pressable
            key={lc.key}
            onPress={() => onLipColorChange(lc.key)}
            style={[
              styles.swatch,
              { backgroundColor: lc.color },
              selected && styles.swatchSelected,
            ]}
          />
        );
      })}
    </View>
  );
}

/* ───────────── Main Panel ───────────── */

export default function BeautyPanel({
  activeFilters = {},
  onToggleFilter,
  onIntensityChange,
  onLipColorChange,
  selectedLipColor,
}) {
  const activeIds = Object.keys(activeFilters);
  const hasActive = activeIds.length > 0;

  // Track which filter's slider is shown (first active, or last toggled)
  const [focusedId, setFocusedId] = useState(null);

  // Keep focusedId in sync: if it was deactivated, pick first active
  useEffect(() => {
    if (focusedId && activeFilters[focusedId] == null) {
      setFocusedId(activeIds.length > 0 ? activeIds[0] : null);
    } else if (!focusedId && activeIds.length > 0) {
      setFocusedId(activeIds[0]);
    }
  }, [activeFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animated height for controls section
  const heightAnim = useRef(new Animated.Value(hasActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(heightAnim, {
      toValue: hasActive ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [hasActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const controlsHeight = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, focusedId === 'lipColor' ? 100 : 56],
  });

  const handleToggle = useCallback(
    (id) => {
      onToggleFilter(id);
      // if activating, focus it
      if (activeFilters[id] == null) {
        setFocusedId(id);
      }
    },
    [activeFilters, onToggleFilter],
  );

  return (
    <View style={styles.panel}>
      {/* Toggle buttons row */}
      <View style={styles.row}>
        {BEAUTY_OPTIONS.map((opt) => {
          const isActive = activeFilters[opt.id] != null;
          return (
            <Pressable
              key={opt.id}
              onPress={() => handleToggle(opt.id)}
              style={styles.buttonWrapper}
            >
              <View
                style={[
                  styles.toggleBtn,
                  isActive ? styles.toggleActive : styles.toggleInactive,
                ]}
              >
                <Ionicons
                  name={opt.icon}
                  size={20}
                  color={isActive ? '#ffffff' : colors.textMuted}
                />
              </View>
              <Text
                style={[
                  styles.label,
                  isActive && styles.labelActive,
                ]}
                numberOfLines={1}
              >
                {opt.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Controls: slider (+ lip swatches) */}
      <Animated.View style={[styles.controls, { height: controlsHeight }]}>
        {focusedId && activeFilters[focusedId] != null && (
          <>
            <IntensitySlider
              value={activeFilters[focusedId]}
              onValueChange={(v) => onIntensityChange(focusedId, v)}
            />
            {focusedId === 'lipColor' && (
              <LipColorSwatches
                selectedLipColor={selectedLipColor}
                onLipColorChange={onLipColorChange}
              />
            )}
          </>
        )}
      </Animated.View>
    </View>
  );
}

/* ───────────── Styles ───────────── */

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.glass,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.glassBorder,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-start',
  },
  buttonWrapper: {
    alignItems: 'center',
    width: 56,
  },
  toggleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: colors.primaryDim,
  },
  toggleInactive: {
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  label: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  labelActive: {
    color: colors.primary,
  },

  /* controls area */
  controls: {
    overflow: 'hidden',
    marginTop: 12,
    paddingHorizontal: 8,
  },

  /* slider */
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
  },
  sliderValue: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    width: 30,
    textAlign: 'right',
    marginRight: 10,
  },
  sliderTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: 'center',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  sliderThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#ffffff',
    top: -5,
  },

  /* lip swatches */
  swatchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 14,
  },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: '#ffffff',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
});
