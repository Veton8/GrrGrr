import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Platform,
} from 'react-native';

// ---------------------------------------------------------------------------
// Particle Burst Canvas – draws 6-8 dots that expand outward and fade
// ---------------------------------------------------------------------------

function ParticleBurstCanvas({ trigger, color, size = 80, intensity = 1 }) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    if (trigger === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    const particleCount = Math.min(6 + Math.floor(intensity * 2), 12);
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.4;
      const speed = 1.5 + Math.random() * 2 * intensity;
      const radius = 2 + Math.random() * 2 * Math.min(intensity, 3);
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: radius,
        alpha: 1,
        color: i % 2 === 0 ? color : '#ffffff',
      });
    }

    let frame = 0;
    const maxFrames = 25;

    const animate = () => {
      frame++;
      if (frame > maxFrames) {
        ctx.clearRect(0, 0, size, size);
        return;
      }
      ctx.clearRect(0, 0, size, size);
      const progress = frame / maxFrames;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.alpha = Math.max(0, 1 - progress * 1.2);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 - progress * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      animFrameRef.current = requestAnimationFrame(animate);
    };

    cancelAnimationFrame(animFrameRef.current);
    animate();

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [trigger, color, size, intensity]);

  if (Platform.OS !== 'web') return null;

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        position: 'absolute',
        top: -size / 2,
        left: -size / 2,
        width: size,
        height: size,
        pointerEvents: 'none',
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Fire Effect Canvas – persistent flame-colored particles rising from text
// ---------------------------------------------------------------------------

function FireEffectCanvas({ active, intensity = 1, color = '#ff6e84', width = 60, height = 50 }) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const particlesRef = useRef([]);

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(animFrameRef.current);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);
      }
      particlesRef.current = [];
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const flameColors = [
      '#ff4500',
      '#ff6347',
      '#ff8c00',
      '#ffa500',
      '#ffd700',
      color,
    ];

    const spawnParticle = () => {
      const baseCount = 3 + Math.floor(intensity * 2);
      return {
        x: width / 2 + (Math.random() - 0.5) * width * 0.7,
        y: height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -(1 + Math.random() * 2 * Math.min(intensity, 3)),
        r: 2 + Math.random() * 3 * Math.min(intensity, 2.5),
        life: 1,
        decay: 0.02 + Math.random() * 0.03,
        color: flameColors[Math.floor(Math.random() * flameColors.length)],
      };
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      const particles = particlesRef.current;

      // Spawn new particles
      const spawnCount = Math.min(3 + Math.floor(intensity), 8);
      while (particles.length < spawnCount * 2) {
        particles.push(spawnParticle());
      }

      // Update and draw
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        p.vx += (Math.random() - 0.5) * 0.3;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life * 0.8;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [active, intensity, color, width, height]);

  if (Platform.OS !== 'web' || !active) return null;

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        bottom: '100%',
        left: '50%',
        marginLeft: -width / 2,
        width,
        height,
        pointerEvents: 'none',
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Border Glow Overlay – full-screen border pulse at x20+
// ---------------------------------------------------------------------------

function BorderGlowOverlay({ active, color, screenWidth, screenHeight }) {
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const loopRef = useRef(null);

  useEffect(() => {
    if (active) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0.7,
            duration: 600,
            useNativeDriver: false,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.2,
            duration: 600,
            useNativeDriver: false,
          }),
        ]),
      );
      loopRef.current = pulse;
      pulse.start();
    } else {
      if (loopRef.current) loopRef.current.stop();
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }

    return () => {
      if (loopRef.current) loopRef.current.stop();
    };
  }, [active, opacityAnim]);

  if (!active) return null;

  const thickness = 3;
  const barStyle = {
    position: 'absolute',
    backgroundColor: color,
    pointerEvents: 'none',
  };

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: screenWidth,
        height: screenHeight,
        opacity: opacityAnim,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {/* Top */}
      <View style={[barStyle, { top: 0, left: 0, right: 0, height: thickness }]} />
      {/* Bottom */}
      <View style={[barStyle, { bottom: 0, left: 0, right: 0, height: thickness }]} />
      {/* Left */}
      <View style={[barStyle, { top: 0, left: 0, bottom: 0, width: thickness }]} />
      {/* Right */}
      <View style={[barStyle, { top: 0, right: 0, bottom: 0, width: thickness }]} />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// ComboCounter – main visible component
// ---------------------------------------------------------------------------

export function ComboCounter({
  count,
  x,
  y,
  giftEmoji,
  color = '#d394ff',
  screenWidth,
  screenHeight,
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [burstTrigger, setBurstTrigger] = useState(0);
  const prevCountRef = useRef(count);

  // Determine tier effects
  const isFireActive = count >= 5;
  const isGold = count >= 10;
  const isBorderGlow = count >= 20;

  // Fire intensity scales with combo count
  const fireIntensity = useMemo(() => {
    if (count < 5) return 0;
    if (count < 10) return 1;
    if (count < 20) return 2;
    return 3;
  }, [count]);

  // Particle burst intensity
  const burstIntensity = useMemo(() => {
    if (count < 5) return 1;
    if (count < 10) return 1.5;
    if (count < 20) return 2;
    return 3;
  }, [count]);

  // Base font size scales slightly with combo level
  const fontSize = useMemo(() => {
    if (count < 5) return 28;
    if (count < 10) return 32;
    if (count < 20) return 36;
    return 40;
  }, [count]);

  // Spring animation + particle burst on count change
  useEffect(() => {
    if (count <= 1) return;
    if (count !== prevCountRef.current) {
      prevCountRef.current = count;

      // Reset scale and spring
      scaleAnim.setValue(1.5);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: false,
      }).start();

      // Trigger particle burst
      setBurstTrigger((prev) => prev + 1);
    }
  }, [count, scaleAnim]);

  if (count < 2) return null;

  const textColor = isGold ? '#ffd700' : '#ffffff';
  const textShadow = isGold
    ? '0 0 12px #ffd700, 0 0 24px #ffaa00, 0 0 4px #fff8e1'
    : '0 0 6px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.6)';

  return (
    <>
      {/* Border glow at x20+ */}
      <BorderGlowOverlay
        active={isBorderGlow}
        color={color}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
      />

      {/* Combo counter positioned at sweep location */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: x,
          top: y,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: scaleAnim }],
          zIndex: 1000,
        }}
      >
        {/* Fire effect above text */}
        <FireEffectCanvas
          active={isFireActive}
          intensity={fireIntensity}
          color={color}
          width={70}
          height={55}
        />

        {/* Particle burst on each increment */}
        <ParticleBurstCanvas
          trigger={burstTrigger}
          color={color}
          size={100}
          intensity={burstIntensity}
        />

        {/* Gift emoji hint */}
        <Text
          style={{
            fontSize: 14,
            textAlign: 'center',
            marginBottom: 2,
          }}
        >
          {giftEmoji}
        </Text>

        {/* Counter text */}
        <Text
          style={{
            fontWeight: 'bold',
            fontSize,
            color: textColor,
            textAlign: 'center',
            ...(Platform.OS === 'web' && {
              textShadow,
              userSelect: 'none',
            }),
          }}
        >
          x{count}
        </Text>
      </Animated.View>
    </>
  );
}

// ---------------------------------------------------------------------------
// useComboTracker – hook managing combo state for all user+gift pairs
// ---------------------------------------------------------------------------

export function useComboTracker() {
  const [combos, setCombos] = useState(new Map());
  const timersRef = useRef(new Map());

  const recordGift = useCallback((userId, giftName, giftEmoji, color, x = 200, y = 300) => {
    const key = `${userId}::${giftName}`;
    let newCount = 1;

    setCombos((prev) => {
      const next = new Map(prev);
      const existing = next.get(key);

      if (existing) {
        newCount = existing.count + 1;
        next.set(key, {
          ...existing,
          count: newCount,
          lastTime: Date.now(),
          emoji: giftEmoji,
          color,
          x: x ?? existing.x,
          y: y ?? existing.y,
        });
      } else {
        newCount = 1;
        next.set(key, {
          count: 1,
          x,
          y,
          emoji: giftEmoji,
          color,
          lastTime: Date.now(),
          userId,
          giftName,
        });
      }

      return next;
    });

    // Reset / restart the 3-second inactivity timer
    if (timersRef.current.has(key)) {
      clearTimeout(timersRef.current.get(key));
    }

    timersRef.current.set(
      key,
      setTimeout(() => {
        setCombos((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        timersRef.current.delete(key);
      }, 3000),
    );

    return newCount;
  }, []);

  const removeComboDone = useCallback((key) => {
    if (timersRef.current.has(key)) {
      clearTimeout(timersRef.current.get(key));
      timersRef.current.delete(key);
    }
    setCombos((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, []);

  return { combos, recordGift, removeComboDone };
}

// ---------------------------------------------------------------------------
// ComboOverlay – renders all active ComboCounters
// ---------------------------------------------------------------------------

export function ComboOverlay({ combos, screenWidth, screenHeight }) {
  const entries = useMemo(() => Array.from(combos.entries()), [combos]);

  if (entries.length === 0) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        ...StyleSheet.absoluteFillObject,
        zIndex: 999,
      }}
    >
      {entries.map(([key, combo]) => (
        <ComboCounter
          key={key}
          count={combo.count}
          x={combo.x}
          y={combo.y}
          giftEmoji={combo.emoji}
          color={combo.color}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
        />
      ))}
    </View>
  );
}

export default ComboCounter;
