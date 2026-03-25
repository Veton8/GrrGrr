import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, Animated, StyleSheet, Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Silver-tier gift definitions
// ---------------------------------------------------------------------------

export const SILVER_GIFTS = {
  sportscar: { emoji: '\u{1F3CE}\u{FE0F}', name: 'Sports Car', color: '#ff4500', glowColor: '#ff6347' },
  diamondring: { emoji: '\u{1F48D}', name: 'Diamond Ring', color: '#87ceeb', glowColor: '#add8e6' },
  rocket: { emoji: '\u{1F680}', name: 'Rocket', color: '#ff6347', glowColor: '#ff4500' },
  treasurechest: { emoji: '\u{1F3F4}\u{200D}\u{2620}\u{FE0F}', name: 'Treasure Chest', color: '#ffd700', glowColor: '#daa520' },
};

// ---------------------------------------------------------------------------
// Particle renderers — gift-specific drawing logic
// ---------------------------------------------------------------------------

const PARTICLE_RENDERERS = {
  sportscar: {
    colors: ['#ff4500', '#ff6347', '#ffd700', '#ffffff'],
    create(cx, cy, angle, speed) {
      return {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed + 2.0, // bias rightward for speed-line feel
        vy: Math.sin(angle) * speed * 0.3,
        width: 15 + Math.random() * 15,
        height: 2 + Math.random() * 1,
        life: 1.0,
        decay: 0.012 + Math.random() * 0.008,
        color: null, // assigned below
      };
    },
    draw(ctx, p) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      // Motion blur: draw a fading tail behind the streak
      const tailLen = p.width * 0.6;
      const grad = ctx.createLinearGradient(p.x - tailLen, p.y, p.x + p.width, p.y);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.3, p.color);
      grad.addColorStop(1, p.color);
      ctx.fillStyle = grad;
      ctx.fillRect(p.x - tailLen, p.y - p.height / 2, p.width + tailLen, p.height);
      ctx.restore();
    },
  },

  diamondring: {
    colors: ['#87ceeb', '#add8e6', '#ffffff', '#e0e0ff', '#b0c4de'],
    create(cx, cy, angle, speed) {
      const stationary = Math.random() < 0.35;
      return {
        x: stationary ? cx + (Math.random() - 0.5) * 300 : cx,
        y: stationary ? cy + (Math.random() - 0.5) * 300 : cy,
        vx: stationary ? 0 : Math.cos(angle) * speed,
        vy: stationary ? 0 : Math.sin(angle) * speed,
        size: 4 + Math.random() * 4,
        life: 1.0,
        decay: 0.008 + Math.random() * 0.008,
        color: null,
        flickerSpeed: 5 + Math.random() * 15,
        flickerOffset: Math.random() * Math.PI * 2,
        stationary,
      };
    },
    draw(ctx, p, time) {
      ctx.save();
      // Oscillating opacity for twinkle effect
      const flicker = 0.3 + 0.7 * Math.abs(Math.sin(time * p.flickerSpeed + p.flickerOffset));
      ctx.globalAlpha = p.life * flicker;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.PI / 4); // rotated square = diamond
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    },
  },

  rocket: {
    colors: ['#ff4500', '#ff6347', '#ffa500', '#ff8c00', '#ffff00'],
    create(cx, cy, _angle, _speed) {
      const spread = (Math.random() - 0.5) * 1.5;
      return {
        x: cx + (Math.random() - 0.5) * 40,
        y: cy + 30 + Math.random() * 20, // spawn below icon
        vx: spread,
        vy: 0.5 + Math.random() * 1.5, // fall downward
        radius: 3 + Math.random() * 5,
        initialRadius: 0, // set after creation
        life: 1.0,
        decay: 0.015 + Math.random() * 0.01,
        color: null,
        gravity: 0.04,
      };
    },
    draw(ctx, p) {
      ctx.save();
      ctx.globalAlpha = p.life * 0.9;
      // Particles shrink as they age
      const r = p.radius * p.life;
      if (r < 0.5) { ctx.restore(); return; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.restore();
    },
  },

  treasurechest: {
    colors: ['#ffd700', '#daa520', '#f0e68c', '#ffec8b', '#b8860b'],
    create(cx, cy, angle, speed) {
      return {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed * 1.2,
        vy: -Math.abs(Math.sin(angle) * speed) - 2.5, // burst upward
        radius: 3 + Math.random() * 3.5,
        life: 1.0,
        decay: 0.007 + Math.random() * 0.006,
        color: null,
        gravity: 0.06,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        spin: Math.random() < 0.5, // some coins spin
      };
    },
    draw(ctx, p) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.translate(p.x, p.y);
      if (p.spin) {
        ctx.rotate(p.rotation);
      }
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      // Coin highlight
      ctx.beginPath();
      ctx.arc(-p.radius * 0.2, -p.radius * 0.2, p.radius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fill();
      ctx.restore();
    },
  },
};

// ---------------------------------------------------------------------------
// Canvas particle system
// ---------------------------------------------------------------------------

function CanvasParticles({ screenWidth, screenHeight, giftType, centerX, centerY, active }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const frameRef = useRef(null);
  const startTimeRef = useRef(null);
  const burstFlags = useRef({ first: false, second: false });
  const activeRef = useRef(active);

  activeRef.current = active;

  const renderer = PARTICLE_RENDERERS[giftType] || PARTICLE_RENDERERS.sportscar;

  const spawnBurst = useCallback((count, velocity) => {
    const cx = centerX;
    const cy = centerY;
    const colors = renderer.colors;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = velocity + Math.random() * (velocity * 0.5);
      const p = renderer.create(cx, cy, angle, speed);
      p.color = colors[Math.floor(Math.random() * colors.length)];
      if (p.initialRadius !== undefined && p.initialRadius === 0) {
        p.initialRadius = p.radius;
      }
      particlesRef.current.push(p);
    }
  }, [centerX, centerY, renderer]);

  const spawnContinuous = useCallback(() => {
    const cx = centerX;
    const cy = centerY;
    const colors = renderer.colors;
    const count = 2 + Math.floor(Math.random() * 3);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2;
      const p = renderer.create(cx, cy, angle, speed);
      p.color = colors[Math.floor(Math.random() * colors.length)];
      if (p.initialRadius !== undefined && p.initialRadius === 0) {
        p.initialRadius = p.radius;
      }
      particlesRef.current.push(p);
    }
  }, [centerX, centerY, renderer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = screenWidth;
    canvas.height = screenHeight;
    startTimeRef.current = performance.now();
    burstFlags.current = { first: false, second: false };
    particlesRef.current = [];

    let continuousInterval = null;

    const tick = () => {
      if (!activeRef.current) return;

      const now = performance.now();
      const elapsed = now - startTimeRef.current;
      const time = elapsed / 1000; // seconds for flicker calculations

      // First burst at 200ms
      if (elapsed >= 200 && !burstFlags.current.first) {
        burstFlags.current.first = true;
        spawnBurst(50, 4.5);
      }

      // Second burst at 600ms
      if (elapsed >= 600 && !burstFlags.current.second) {
        burstFlags.current.second = true;
        spawnBurst(30, 2.5);
      }

      // Start continuous gift-specific particles at 200ms
      if (elapsed >= 200 && elapsed < 2000 && !continuousInterval) {
        continuousInterval = setInterval(() => {
          if (activeRef.current) spawnContinuous();
        }, 80);
      }

      // Stop continuous spawning after 2000ms
      if (elapsed >= 2000 && continuousInterval) {
        clearInterval(continuousInterval);
        continuousInterval = null;
      }

      // Update particles
      const particles = particlesRef.current;
      ctx.clearRect(0, 0, screenWidth, screenHeight);
      ctx.globalCompositeOperation = 'lighter';

      let alive = 0;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life -= p.decay;
        if (p.life <= 0) continue;

        // Position update
        p.x += p.vx;
        p.y += p.vy;

        // Gravity (for rocket and treasure chest)
        if (p.gravity) {
          p.vy += p.gravity;
        }

        // Spin for treasure chest coins
        if (p.spin && p.rotationSpeed) {
          p.rotation += p.rotationSpeed;
        }

        // Slight drag for smoother movement
        p.vx *= 0.995;
        if (!p.gravity) {
          p.vy *= 0.995;
        }

        renderer.draw(ctx, p, time);
        particles[alive] = p;
        alive++;
      }
      particles.length = alive;

      ctx.globalCompositeOperation = 'source-over';
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (continuousInterval) clearInterval(continuousInterval);
    };
  }, [screenWidth, screenHeight, spawnBurst, spawnContinuous, renderer]);

  if (Platform.OS !== 'web') return null;

  return (
    <canvas
      ref={canvasRef}
      width={screenWidth}
      height={screenHeight}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: screenWidth,
        height: screenHeight,
        pointerEvents: 'none',
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// FullscreenBurst — main animation component
// ---------------------------------------------------------------------------

function FullscreenBurst({ gift, sender, screenWidth, screenHeight, onComplete }) {
  const mountedRef = useRef(true);
  const timersRef = useRef([]);
  const animationsRef = useRef([]);

  // Animated values
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const iconOpacity = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(15)).current;

  const [particlesActive, setParticlesActive] = useState(false);

  const giftDef = SILVER_GIFTS[gift.type] || {
    emoji: gift.emoji,
    name: gift.name,
    color: '#ffffff',
    glowColor: '#cccccc',
  };

  const centerX = screenWidth / 2;
  const centerY = screenHeight / 2;

  const addTimer = useCallback((fn, delay) => {
    const id = setTimeout(() => {
      if (mountedRef.current) fn();
    }, delay);
    timersRef.current.push(id);
    return id;
  }, []);

  const trackAnim = useCallback((anim) => {
    animationsRef.current.push(anim);
    return anim;
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // 0ms: Overlay fades in
    const overlayAnim = Animated.timing(overlayOpacity, {
      toValue: 0.3,
      duration: 300,
      useNativeDriver: false,
    });
    trackAnim(overlayAnim);
    overlayAnim.start();

    // 100ms: Icon springs in
    addTimer(() => {
      const springAnim = Animated.spring(iconScale, {
        toValue: 1.0,
        friction: 5,
        tension: 200,
        useNativeDriver: false,
      });
      trackAnim(springAnim);
      springAnim.start();
    }, 100);

    // 200ms: Particles start
    addTimer(() => {
      setParticlesActive(true);
    }, 200);

    // 400ms: Glow intensifies
    addTimer(() => {
      const glowAnim = Animated.timing(glowOpacity, {
        toValue: 0.85,
        duration: 300,
        useNativeDriver: false,
      });
      trackAnim(glowAnim);
      glowAnim.start();
    }, 400);

    // 500ms: Text fades in with slide
    addTimer(() => {
      const textAnim = Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }),
      ]);
      trackAnim(textAnim);
      textAnim.start();
    }, 500);

    // 2000ms: Everything fades out
    addTimer(() => {
      const fadeOutAnim = Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: false,
        }),
        Animated.timing(iconOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: false,
        }),
        Animated.spring(iconScale, {
          toValue: 0.8,
          friction: 8,
          tension: 100,
          useNativeDriver: false,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: false,
        }),
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: false,
        }),
      ]);
      trackAnim(fadeOutAnim);
      fadeOutAnim.start();

      setParticlesActive(false);
    }, 2000);

    // 2500ms: Complete
    addTimer(() => {
      if (mountedRef.current && onComplete) {
        onComplete();
      }
    }, 2500);

    return () => {
      mountedRef.current = false;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      animationsRef.current.forEach((a) => a.stop());
      animationsRef.current = [];
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.root]} pointerEvents="none">
      {/* Dark overlay */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: '#000', opacity: overlayOpacity },
        ]}
      />

      {/* Canvas particles */}
      <CanvasParticles
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        giftType={gift.type}
        centerX={centerX}
        centerY={centerY}
        active={particlesActive}
      />

      {/* Glow behind icon */}
      {Platform.OS === 'web' && (
        <Animated.View
          style={[
            styles.glowContainer,
            {
              left: centerX - 150,
              top: centerY - 150,
              opacity: glowOpacity,
            },
          ]}
        >
          <div
            style={{
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${giftDef.glowColor}88 0%, ${giftDef.color}44 40%, transparent 70%)`,
              filter: 'blur(20px)',
            }}
          />
        </Animated.View>
      )}

      {/* Gift icon */}
      <Animated.View
        style={[
          styles.iconContainer,
          {
            left: centerX - 75,
            top: centerY - 75,
            opacity: iconOpacity,
            transform: [{ scale: iconScale }],
          },
        ]}
      >
        <Text style={styles.iconEmoji}>{giftDef.emoji}</Text>
      </Animated.View>

      {/* Sender text */}
      <Animated.View
        style={[
          styles.textContainer,
          {
            top: centerY + 85,
            opacity: textOpacity,
            transform: [{ translateY: textTranslateY }],
          },
        ]}
      >
        <Animated.Text style={styles.senderName}>
          {sender.username}
        </Animated.Text>
        <Animated.Text style={[styles.giftLabel, { color: giftDef.color }]}>
          sent {giftDef.name}
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// FullscreenBurstManager — queued playback, one at a time
// ---------------------------------------------------------------------------

export function FullscreenBurstManager({ bursts, screenWidth, screenHeight, onBurstComplete }) {
  const [queue, setQueue] = useState([]);
  const [activeBurst, setActiveBurst] = useState(null);
  const queueRef = useRef([]);

  // Sync incoming bursts into the internal queue
  useEffect(() => {
    if (!bursts || bursts.length === 0) return;

    const newItems = bursts.filter(
      (b) =>
        !queueRef.current.some((q) => q.id === b.id) &&
        (!activeBurst || activeBurst.id !== b.id)
    );

    if (newItems.length > 0) {
      queueRef.current = [...queueRef.current, ...newItems];
      setQueue([...queueRef.current]);
    }
  }, [bursts, activeBurst]);

  // Play next in queue when no active burst
  useEffect(() => {
    if (activeBurst || queueRef.current.length === 0) return;

    const next = queueRef.current.shift();
    setQueue([...queueRef.current]);
    setActiveBurst(next);
  }, [activeBurst, queue]);

  const handleComplete = useCallback(() => {
    const completedId = activeBurst?.id;
    setActiveBurst(null);
    if (completedId && onBurstComplete) {
      onBurstComplete(completedId);
    }
  }, [activeBurst, onBurstComplete]);

  if (!activeBurst) return null;

  return (
    <FullscreenBurst
      key={activeBurst.id}
      gift={activeBurst.gift}
      sender={activeBurst.sender}
      screenWidth={screenWidth}
      screenHeight={screenHeight}
      onComplete={handleComplete}
    />
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    zIndex: 1000,
  },
  glowContainer: {
    position: 'absolute',
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    position: 'absolute',
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 100,
    textAlign: 'center',
  },
  textContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  senderName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    marginBottom: 4,
  },
  giftLabel: {
    fontSize: 20,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});

export default FullscreenBurst;
