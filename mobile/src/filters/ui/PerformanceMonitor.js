import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../utils/theme';

function StatRow({ icon, label, value, valueColor }) {
  return (
    <View style={styles.statRow}>
      <Ionicons name={icon} size={10} color={colors.textMuted} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueColor && { color: valueColor }]}>
        {value}
      </Text>
    </View>
  );
}

export default function PerformanceMonitor({
  detectionFps = 0,
  renderTimeMs = 0,
  activeFilterCount = 0,
  visible,
}) {
  // Only render in dev mode when visible
  if (!visible) return null;

  // Refresh display on a 500ms cadence
  const [tick, setTick] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTick((t) => t + 1);
    }, 500);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Color-code FPS: green >= 24, yellow >= 15, red < 15
  const fpsColor =
    detectionFps >= 24
      ? colors.secondary
      : detectionFps >= 15
        ? colors.tertiary
        : '#ff5c5c';

  // Color-code render time: green < 8, yellow < 16, red >= 16
  const renderColor =
    renderTimeMs < 8
      ? colors.secondary
      : renderTimeMs < 16
        ? colors.tertiary
        : '#ff5c5c';

  return (
    <View style={styles.overlay}>
      <StatRow
        icon="speedometer-outline"
        label="FPS"
        value={Math.round(detectionFps)}
        valueColor={fpsColor}
      />
      <StatRow
        icon="timer-outline"
        label="Render"
        value={`${renderTimeMs.toFixed(1)}ms`}
        valueColor={renderColor}
      />
      <StatRow
        icon="layers-outline"
        label="Filters"
        value={activeFilterCount}
        valueColor={colors.text}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 48,
    right: 12,
    backgroundColor: colors.glass,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    opacity: 0.85,
    minWidth: 120,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
    gap: 6,
  },
  statLabel: {
    fontSize: 9,
    color: colors.textMuted,
    flex: 1,
  },
  statValue: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
});
