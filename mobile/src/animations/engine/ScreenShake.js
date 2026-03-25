import React, { useEffect, useRef, useCallback } from 'react';
import { Animated } from 'react-native';

const SHAKE_STEPS = 8;

/**
 * ScreenShake - wraps children and applies rapid translateX oscillation.
 *
 * Uses the core Animated API (no Reanimated) with useNativeDriver: false
 * for full Expo Web compatibility.
 *
 * Props
 * ─────
 * @param {boolean} active    - triggers a shake when set to true
 * @param {number}  intensity - 1-10 controlling magnitude (default 5)
 * @param {number}  duration  - total shake duration in ms (default 500)
 * @param {React.ReactNode} children
 */
export default function ScreenShake({
  active = false,
  intensity = 5,
  duration = 500,
  children,
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);

  const runShake = useCallback(() => {
    // Cancel any in-progress shake
    if (animRef.current) {
      animRef.current.stop();
    }

    const magnitude = intensity * 1.5; // max ~15px at intensity 10
    const stepDuration = duration / SHAKE_STEPS;

    // Build a sequence of rapid left/right offsets with decay
    const steps = [];
    for (let i = 0; i < SHAKE_STEPS; i++) {
      const decay = 1 - i / SHAKE_STEPS; // taper off
      const direction = i % 2 === 0 ? 1 : -1;
      // Add slight randomness so each shake feels organic
      const offset = direction * magnitude * decay * (0.7 + Math.random() * 0.3);

      steps.push(
        Animated.timing(translateX, {
          toValue: offset,
          duration: stepDuration,
          useNativeDriver: false,
        }),
      );
    }

    // Return to rest position
    steps.push(
      Animated.timing(translateX, {
        toValue: 0,
        duration: stepDuration * 0.5,
        useNativeDriver: false,
      }),
    );

    animRef.current = Animated.sequence(steps);
    animRef.current.start(({ finished }) => {
      if (finished) {
        translateX.setValue(0);
      }
      animRef.current = null;
    });
  }, [intensity, duration, translateX]);

  useEffect(() => {
    if (active) {
      runShake();
    }

    return () => {
      if (animRef.current) {
        animRef.current.stop();
        animRef.current = null;
      }
      translateX.setValue(0);
    };
  }, [active]);

  return (
    <Animated.View style={{ flex: 1, transform: [{ translateX }] }}>
      {children}
    </Animated.View>
  );
}
