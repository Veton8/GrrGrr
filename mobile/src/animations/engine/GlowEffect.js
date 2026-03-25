import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';

const PULSE_DURATION = 1200;

/**
 * GlowEffect - renders a soft radial glow (light bloom).
 *
 * On web this uses a CSS radial-gradient with blur; on native it falls
 * back to a simple semi-transparent circle with shadow.
 *
 * Props
 * ─────
 * @param {string}  color     - glow colour
 * @param {number}  intensity - 0-1 controlling size & opacity
 * @param {number}  size      - diameter in px (default 200)
 * @param {number}  x         - centre X position
 * @param {number}  y         - centre Y position
 * @param {boolean} animated  - pulse the glow when true
 * @param {object}  style     - additional styles merged onto the container
 */
export default function GlowEffect({
  color = '#d394ff',
  intensity = 0.6,
  size = 200,
  x = 0,
  y = 0,
  animated = false,
  style,
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const loopRef = useRef(null);

  useEffect(() => {
    if (animated) {
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: PULSE_DURATION / 2,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.85,
            duration: PULSE_DURATION / 2,
            useNativeDriver: false,
          }),
        ]),
      );
      loopRef.current.start();
    } else {
      pulseAnim.setValue(1);
      if (loopRef.current) {
        loopRef.current.stop();
        loopRef.current = null;
      }
    }

    return () => {
      if (loopRef.current) {
        loopRef.current.stop();
        loopRef.current = null;
      }
    };
  }, [animated]);

  const effectiveSize = size * intensity;
  const half = effectiveSize / 2;
  const opacity = Math.min(intensity, 0.9);

  const animatedScale = animated ? pulseAnim : 1;

  const baseStyle = {
    position: 'absolute',
    left: x - half,
    top: y - half,
    width: effectiveSize,
    height: effectiveSize,
  };

  if (Platform.OS === 'web') {
    // Web: CSS radial gradient + blur for a convincing bloom
    const webStyle = {
      ...baseStyle,
      borderRadius: effectiveSize / 2,
      background: `radial-gradient(circle, ${color} 0%, ${color}88 30%, ${color}33 60%, transparent 100%)`,
      opacity,
      filter: `blur(${effectiveSize * 0.18}px)`,
      pointerEvents: 'none',
      transform: [{ scale: animatedScale }],
    };

    return (
      <Animated.View
        style={[webStyle, style]}
        pointerEvents="none"
      />
    );
  }

  // Native fallback: coloured circle with shadow
  const nativeStyle = {
    ...baseStyle,
    borderRadius: effectiveSize / 2,
    backgroundColor: color,
    opacity: opacity * 0.5,
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: opacity,
    shadowRadius: effectiveSize * 0.4,
    elevation: 20,
    transform: [{ scale: animatedScale }],
  };

  return (
    <Animated.View
      style={[nativeStyle, style]}
      pointerEvents="none"
    />
  );
}
