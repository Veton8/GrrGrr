import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import GlowEffect from './GlowEffect';
import ParticleSystem from './ParticleSystem';

/**
 * AnimationSequencer - timeline-based animation coordinator.
 *
 * Accepts an array of timed steps and orchestrates them against a
 * master clock that begins when `active` flips to true.
 *
 * Props
 * ─────
 * @param {Array}    timeline      - array of { time, type, config } steps
 * @param {boolean}  active        - start the sequence
 * @param {Function} onComplete    - fires when all steps have finished
 * @param {number}   screenWidth
 * @param {number}   screenHeight
 *
 * Timeline step types
 * ────────────────────
 * icon      - emoji/text at (x,y) with scale-in animation
 * text      - label (e.g. "LEGENDARY GIFT") with fade-in
 * flash     - full-screen colour flash that fades out
 * glow      - renders GlowEffect at position
 * shake     - triggers ScreenShake (parent must wrap with ScreenShake)
 * particles - spawns a ParticleSystem burst
 */

const EFFECT_DEFAULT_DURATION = 1200;

// ── Individual effect renderers ──────────────────────────────────────

function IconEffect({ config, onDone }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dur = config.duration || EFFECT_DEFAULT_DURATION;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, {
          toValue: config.scale || 1.4,
          friction: 4,
          tension: 100,
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: false,
        }),
      ]),
      Animated.delay(dur * 0.5),
      Animated.timing(opacity, {
        toValue: 0,
        duration: dur * 0.3,
        useNativeDriver: false,
      }),
    ]);

    anim.start(({ finished }) => {
      if (finished && onDone) onDone();
    });

    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.effectAbsolute,
        {
          left: (config.x || 0) - 40,
          top: (config.y || 0) - 40,
          opacity,
          transform: [{ scale }],
        },
      ]}
    >
      <Text style={[styles.iconText, { fontSize: config.fontSize || 64 }]}>
        {config.emoji || config.text || '🎁'}
      </Text>
    </Animated.View>
  );
}

function TextEffect({ config, onDone }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const dur = config.duration || EFFECT_DEFAULT_DURATION;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: dur * 0.25,
          useNativeDriver: false,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: dur * 0.3,
          useNativeDriver: false,
        }),
      ]),
      Animated.delay(dur * 0.45),
      Animated.timing(opacity, {
        toValue: 0,
        duration: dur * 0.25,
        useNativeDriver: false,
      }),
    ]);

    anim.start(({ finished }) => {
      if (finished && onDone) onDone();
    });

    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.effectAbsolute,
        {
          left: config.x != null ? config.x : '10%',
          top: config.y != null ? config.y : '40%',
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Text
        style={[
          styles.labelText,
          {
            color: config.color || '#ffe792',
            fontSize: config.fontSize || 28,
            textShadowColor: config.shadowColor || 'rgba(0,0,0,0.6)',
          },
        ]}
      >
        {config.text || ''}
      </Text>
    </Animated.View>
  );
}

function FlashEffect({ config, onDone }) {
  const opacity = useRef(new Animated.Value(0.85)).current;
  const dur = config.duration || 400;

  useEffect(() => {
    const anim = Animated.timing(opacity, {
      toValue: 0,
      duration: dur,
      useNativeDriver: false,
    });

    anim.start(({ finished }) => {
      if (finished && onDone) onDone();
    });

    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: config.color || '#ffffff',
          opacity,
        },
      ]}
    />
  );
}

function GlowEffectWrapper({ config, onDone }) {
  const dur = config.duration || EFFECT_DEFAULT_DURATION;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (onDone) onDone();
    }, dur);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GlowEffect
      color={config.color || '#d394ff'}
      intensity={config.intensity || 0.7}
      size={config.size || 250}
      x={config.x || 0}
      y={config.y || 0}
      animated={config.animated !== false}
    />
  );
}

function ShakeEffect({ config, onDone }) {
  // Shake is handled externally via the shakeActive state
  // exposed through the onShake callback in config.
  // Here we just fire the callback and signal completion after duration.
  const dur = config.duration || 500;

  useEffect(() => {
    if (typeof config.onShake === 'function') {
      config.onShake(true, config.intensity || 5, dur);
    }

    const timer = setTimeout(() => {
      if (typeof config.onShake === 'function') {
        config.onShake(false);
      }
      if (onDone) onDone();
    }, dur);

    return () => {
      clearTimeout(timer);
      if (typeof config.onShake === 'function') {
        config.onShake(false);
      }
    };
  }, []);

  return null;
}

function ParticlesEffect({ config, onDone, screenWidth, screenHeight }) {
  const dur = config.duration || 1500;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (onDone) onDone();
    }, dur);
    return () => clearTimeout(timer);
  }, []);

  const particleConfig = React.useMemo(() => ({
    mode: 'burst',
    count: config.count || 30,
    origin: {
      x: (config.x != null ? config.x : screenWidth / 2) / screenWidth,
      y: (config.y != null ? config.y : screenHeight / 2) / screenHeight,
    },
    spread: { x: config.spread || 120, y: config.spread || 120 },
    velocity: { min: 2, max: 8 },
    angle: { min: 0, max: 360 },
    size: { min: 3, max: 10 },
    lifetime: { min: 800, max: dur },
    gravity: 0.05,
    colors: config.colors || ['#d394ff', '#00eefc', '#ffe792'],
    shapes: ['circle', 'star'],
    glow: true,
    glowIntensity: 12,
    blendMode: 'lighter',
  }), [config, screenWidth, screenHeight, dur]);

  return (
    <ParticleSystem
      config={particleConfig}
      active={true}
      width={screenWidth}
      height={screenHeight}
      style={StyleSheet.absoluteFill}
    />
  );
}

// ── Component map ────────────────────────────────────────────────────

const RENDERERS = {
  icon: IconEffect,
  text: TextEffect,
  flash: FlashEffect,
  glow: GlowEffectWrapper,
  shake: ShakeEffect,
  particles: ParticlesEffect,
};

// ── Main sequencer ───────────────────────────────────────────────────

export default function AnimationSequencer({
  timeline = [],
  active = false,
  onComplete,
  screenWidth,
  screenHeight,
}) {
  const [activeEffects, setActiveEffects] = useState([]);
  const timersRef = useRef([]);
  const idCounter = useRef(0);
  const activeRef = useRef(false);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const removeEffect = useCallback((effectId) => {
    setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
  }, []);

  // Start / stop the sequence
  useEffect(() => {
    if (active && timeline.length > 0) {
      activeRef.current = true;
      idCounter.current = 0;
      setActiveEffects([]);

      // Find latest step time + a generous buffer for the effect duration
      let maxEndTime = 0;

      timeline.forEach((step) => {
        const id = ++idCounter.current;
        const effectEndTime = step.time + (step.config?.duration || EFFECT_DEFAULT_DURATION);
        if (effectEndTime > maxEndTime) maxEndTime = effectEndTime;

        const timer = setTimeout(() => {
          if (!activeRef.current) return;

          setActiveEffects((prev) => [
            ...prev,
            { id, type: step.type, config: step.config },
          ]);
        }, step.time);

        timersRef.current.push(timer);
      });

      // Fire onComplete after all effects should have finished
      const completeTimer = setTimeout(() => {
        if (activeRef.current && onComplete) {
          onComplete();
        }
        activeRef.current = false;
      }, maxEndTime + 200);
      timersRef.current.push(completeTimer);
    }

    if (!active) {
      activeRef.current = false;
      clearTimers();
      setActiveEffects([]);
    }

    return () => {
      activeRef.current = false;
      clearTimers();
    };
  }, [active, timeline, onComplete, clearTimers]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  if (activeEffects.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {activeEffects.map((effect) => {
        const Renderer = RENDERERS[effect.type];
        if (!Renderer) return null;

        return (
          <Renderer
            key={effect.id}
            config={effect.config || {}}
            onDone={() => removeEffect(effect.id)}
            screenWidth={screenWidth}
            screenHeight={screenHeight}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  effectAbsolute: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    textAlign: 'center',
  },
  labelText: {
    fontWeight: '900',
    letterSpacing: 2,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    textAlign: 'center',
  },
});
