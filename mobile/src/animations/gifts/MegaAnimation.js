import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { View, Text, Animated, Easing, StyleSheet, Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Gold gift definitions
// ---------------------------------------------------------------------------

export const GOLD_GIFTS = {
  goldenlion: { emoji: '\u{1F981}', name: 'Golden Lion', color: '#ffd700', tintColor: 'rgba(255,215,0,0.15)' },
  crystalpalace: { emoji: '\u{1F3F0}', name: 'Crystal Palace', color: '#a0a0ff', tintColor: 'rgba(160,160,255,0.12)' },
  privatejet: { emoji: '\u2708\uFE0F', name: 'Private Jet', color: '#87ceeb', tintColor: 'rgba(135,206,235,0.1)' },
  galaxyportal: { emoji: '\u{1F30C}', name: 'Galaxy Portal', color: '#d394ff', tintColor: 'rgba(211,148,255,0.15)' },
  dragon: { emoji: '\u{1F409}', name: 'Dragon', color: '#ff4500', tintColor: 'rgba(255,69,0,0.15)' },
};

// ---------------------------------------------------------------------------
// Particle shapes
// ---------------------------------------------------------------------------

const SHAPE_CIRCLE = 'circle';
const SHAPE_DIAMOND = 'diamond';
const SHAPE_LINE = 'line';
const SHAPE_STAR = 'star';

// ---------------------------------------------------------------------------
// Particle helpers
// ---------------------------------------------------------------------------

function createBurstParticle(cx, cy, colors) {
  const angle = Math.random() * Math.PI * 2;
  const speed = 2 + Math.random() * 6;
  const size = 2 + Math.random() * 13;
  return {
    x: cx,
    y: cy,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size,
    color: colors[Math.floor(Math.random() * colors.length)],
    opacity: 1,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.1,
    lifetime: 1.0,
    maxLifetime: 1.0,
    gravity: 0.05,
    shape: SHAPE_CIRCLE,
  };
}

function createAmbientParticle(screenWidth, screenHeight) {
  return {
    x: Math.random() * screenWidth,
    y: Math.random() * screenHeight,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -0.2 - Math.random() * 0.3,
    size: 1 + Math.random() * 2.5,
    color: 'rgba(255,255,255,0.4)',
    opacity: 0.2 + Math.random() * 0.4,
    rotation: 0,
    rotationSpeed: 0,
    lifetime: 3 + Math.random() * 4,
    maxLifetime: 3 + Math.random() * 4,
    gravity: 0,
    shape: SHAPE_CIRCLE,
  };
}

// Gift-specific particle factories
const giftParticleFactories = {
  goldenlion(cx, cy, screenWidth, screenHeight) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 2.5;
    const colors = ['#ffd700', '#daa520', '#f0e68c', '#ff8c00', '#fff8dc'];
    return {
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: 1,
      rotation: 0,
      rotationSpeed: 0,
      lifetime: 1.5 + Math.random() * 1.5,
      maxLifetime: 1.5 + Math.random() * 1.5,
      gravity: 0.08,
      shape: SHAPE_CIRCLE,
    };
  },

  crystalpalace(cx, cy, screenWidth, screenHeight) {
    const colors = ['#e0e0ff', '#c0c0ff', '#a0a0ff', '#87ceeb', '#ffffff', '#f0e0ff'];
    const isLarge = Math.random() < 0.25;
    const size = isLarge ? 15 + Math.random() * 5 : 4 + Math.random() * 8;
    return {
      x: Math.random() * screenWidth,
      y: screenHeight + 10,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -(1.5 + Math.random() * 2.5),
      size,
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: 1,
      rotation: Math.PI / 4,
      rotationSpeed: isLarge ? 0.01 + Math.random() * 0.02 : 0.03 + Math.random() * 0.05,
      lifetime: 2.0 + Math.random() * 1.5,
      maxLifetime: 2.0 + Math.random() * 1.5,
      gravity: 0,
      shape: SHAPE_DIAMOND,
    };
  },

  privatejet(cx, cy, screenWidth, screenHeight) {
    const colors = ['#ffffff', '#e0e0e0', '#87ceeb', '#add8e6'];
    const roll = Math.random();
    if (roll < 0.4) {
      // Speed lines
      return {
        x: screenWidth + 10,
        y: Math.random() * screenHeight,
        vx: -(8 + Math.random() * 6),
        vy: (Math.random() - 0.5) * 0.3,
        size: 2 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 0.6 + Math.random() * 0.4,
        rotation: 0,
        rotationSpeed: 0,
        lifetime: 0.8 + Math.random() * 0.6,
        maxLifetime: 0.8 + Math.random() * 0.6,
        gravity: 0,
        shape: SHAPE_LINE,
      };
    } else if (roll < 0.7) {
      // Cloud particles
      return {
        x: screenWidth + 30,
        y: Math.random() * screenHeight,
        vx: -(2 + Math.random() * 2),
        vy: (Math.random() - 0.5) * 0.2,
        size: 30 + Math.random() * 20,
        color: 'rgba(255,255,255,0.15)',
        opacity: 0.15 + Math.random() * 0.15,
        rotation: 0,
        rotationSpeed: 0,
        lifetime: 2.5 + Math.random(),
        maxLifetime: 2.5 + Math.random(),
        gravity: 0,
        shape: SHAPE_CIRCLE,
      };
    } else {
      // Exhaust trail from icon
      return {
        x: cx + 30,
        y: cy + (Math.random() - 0.5) * 20,
        vx: 2 + Math.random() * 3,
        vy: (Math.random() - 0.5) * 1.5,
        size: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 0.7,
        rotation: 0,
        rotationSpeed: 0,
        lifetime: 0.8 + Math.random() * 0.5,
        maxLifetime: 0.8 + Math.random() * 0.5,
        gravity: 0.02,
        shape: SHAPE_CIRCLE,
      };
    }
  },

  galaxyportal(cx, cy, screenWidth, screenHeight) {
    const colors = ['#d394ff', '#aa30fa', '#9400d3', '#4b0082', '#00eefc', '#ffffff'];
    const roll = Math.random();
    if (roll < 0.6) {
      // Swirling vortex particle
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 140;
      return {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        size: 2 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 1,
        rotation: angle,
        rotationSpeed: 0.04 + Math.random() * 0.03,
        lifetime: 2.0 + Math.random() * 1.5,
        maxLifetime: 2.0 + Math.random() * 1.5,
        gravity: 0,
        shape: SHAPE_CIRCLE,
        _vortex: true,
        _cx: cx,
        _cy: cy,
        _dist: dist,
        _angle: angle,
        _radialV: -(0.3 + Math.random() * 0.4),
      };
    } else {
      // Twinkle star
      return {
        x: Math.random() * screenWidth,
        y: Math.random() * screenHeight,
        vx: 0,
        vy: 0,
        size: 2 + Math.random() * 2,
        color: '#ffffff',
        opacity: Math.random(),
        rotation: 0,
        rotationSpeed: 0,
        lifetime: 1.0 + Math.random() * 1.5,
        maxLifetime: 1.0 + Math.random() * 1.5,
        gravity: 0,
        shape: SHAPE_STAR,
        _twinkle: true,
        _twinkleSpeed: 3 + Math.random() * 5,
      };
    }
  },

  dragon(cx, cy, screenWidth, screenHeight) {
    const fireColors = ['#ff0000', '#ff4500', '#ff6347', '#ffa500', '#ff8c00', '#ffff00'];
    const roll = Math.random();
    if (roll < 0.55) {
      // Fire rain from top
      return {
        x: Math.random() * screenWidth,
        y: -10,
        vx: (Math.random() - 0.5) * 1,
        vy: 3 + Math.random() * 4,
        size: 3 + Math.random() * 6,
        color: fireColors[Math.floor(Math.random() * fireColors.length)],
        opacity: 1,
        rotation: Math.random() * Math.PI,
        rotationSpeed: (Math.random() - 0.5) * 0.1,
        lifetime: 1.5 + Math.random() * 1.0,
        maxLifetime: 1.5 + Math.random() * 1.0,
        gravity: 0.1,
        shape: Math.random() < 0.5 ? SHAPE_CIRCLE : SHAPE_LINE,
      };
    } else {
      // Rising embers from bottom
      return {
        x: Math.random() * screenWidth,
        y: screenHeight + 5,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -(1.5 + Math.random() * 2.5),
        size: 2 + Math.random() * 4,
        color: fireColors[Math.floor(Math.random() * Math.min(4, fireColors.length))],
        opacity: 0.9,
        rotation: 0,
        rotationSpeed: 0,
        lifetime: 1.5 + Math.random() * 1.5,
        maxLifetime: 1.5 + Math.random() * 1.5,
        gravity: -0.02,
        shape: SHAPE_CIRCLE,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// Canvas renderer (web only)
// ---------------------------------------------------------------------------

function drawStar(ctx, x, y, size, rotation) {
  const spikes = 5;
  const outerRadius = size;
  const innerRadius = size * 0.45;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
    else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function renderParticles(ctx, particles, width, height) {
  ctx.clearRect(0, 0, width, height);

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.opacity <= 0) continue;

    ctx.globalAlpha = Math.max(0, Math.min(1, p.opacity));

    if (p.shape === SHAPE_CIRCLE) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.shape === SHAPE_DIAMOND) {
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.lineTo(p.size * 0.6, 0);
      ctx.lineTo(0, p.size);
      ctx.lineTo(-p.size * 0.6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (p.shape === SHAPE_LINE) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1, p.size * 0.4);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.size * 4, p.y);
      ctx.stroke();
    } else if (p.shape === SHAPE_STAR) {
      ctx.fillStyle = p.color;
      drawStar(ctx, p.x, p.y, p.size, p.rotation);
    }
  }

  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Flash effect
// ---------------------------------------------------------------------------

function renderFlash(ctx, cx, cy, progress, width, height) {
  if (progress <= 0 || progress >= 1) return;
  const radius = progress * 400;
  const alpha = Math.max(0, 1 - progress);
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
  gradient.addColorStop(0.4, `rgba(255,255,255,${alpha * 0.5})`);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

// ---------------------------------------------------------------------------
// Full-screen particle canvas component
// ---------------------------------------------------------------------------

const MegaCanvas = React.memo(function MegaCanvas({
  canvasWidth,
  canvasHeight,
  particlesRef,
  flashRef,
  iconCenterRef,
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = (time) => {
      const dt = lastTimeRef.current ? Math.min((time - lastTimeRef.current) / 1000, 0.05) : 0.016;
      lastTimeRef.current = time;

      const particles = particlesRef.current;
      const center = iconCenterRef.current;

      // Update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Vortex particles (galaxy portal)
        if (p._vortex) {
          p._angle += p.rotationSpeed;
          p._dist += p._radialV * dt * 60;
          if (p._dist < 5) p._dist = 5;
          p.x = p._cx + Math.cos(p._angle) * p._dist;
          p.y = p._cy + Math.sin(p._angle) * p._dist;
        } else {
          p.x += p.vx * dt * 60;
          p.y += p.vy * dt * 60 + p.gravity * dt * 60;
        }

        // Twinkle
        if (p._twinkle) {
          p.opacity = 0.3 + Math.abs(Math.sin(time * 0.001 * p._twinkleSpeed)) * 0.7;
        }

        p.rotation += p.rotationSpeed;
        p.lifetime -= dt;

        if (!p._twinkle) {
          p.opacity = Math.max(0, p.lifetime / p.maxLifetime);
        }

        if (p.lifetime <= 0) {
          particles.splice(i, 1);
        }
      }

      // Render
      renderParticles(ctx, particles, canvasWidth, canvasHeight);

      // Flash overlay
      const flash = flashRef.current;
      if (flash > 0 && flash < 1) {
        renderFlash(ctx, center.x, center.y, flash, canvasWidth, canvasHeight);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [canvasWidth, canvasHeight, particlesRef, flashRef, iconCenterRef]);

  if (Platform.OS !== 'web') return null;

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: canvasWidth,
        height: canvasHeight,
        pointerEvents: 'none',
      }}
    />
  );
});

// ---------------------------------------------------------------------------
// Shake sequence generator
// ---------------------------------------------------------------------------

function buildShakeSequence(shakeAnim) {
  const steps = [8, -7, 6, -5, 4, -3, 2, -1];
  const perStep = 50; // 400ms / 8 steps
  const sequence = [];

  for (let i = 0; i < steps.length; i++) {
    sequence.push(
      Animated.timing(shakeAnim, {
        toValue: steps[i],
        duration: perStep,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
  }

  sequence.push(
    Animated.timing(shakeAnim, {
      toValue: 0,
      duration: 20,
      useNativeDriver: false,
    })
  );

  return Animated.sequence(sequence);
}

// ---------------------------------------------------------------------------
// Glow component
// ---------------------------------------------------------------------------

function Glow({ glowScale, giftColor, glowColorAnim }) {
  if (Platform.OS !== 'web') return null;

  const size = 260;

  const animatedStyle = {
    position: 'absolute',
    width: size,
    height: size,
    borderRadius: size / 2,
    transform: [{ scale: glowScale }],
  };

  return (
    <Animated.View style={animatedStyle}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          background: `radial-gradient(circle, ${giftColor}88 0%, ${giftColor}44 40%, transparent 70%)`,
        }}
      />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Prismatic glow for Crystal Palace
// ---------------------------------------------------------------------------

function PrismaticGlow({ visible, scale }) {
  const colorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.timing(colorAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [visible, colorAnim]);

  if (Platform.OS !== 'web' || !visible) return null;

  const size = 280;

  const hue = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        transform: [{ scale }],
        opacity: 0.6,
      }}
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          background: 'radial-gradient(circle, rgba(200,200,255,0.7) 0%, rgba(160,160,255,0.3) 40%, transparent 70%)',
          filter: hue.interpolate({
            inputRange: [0, 1],
            outputRange: ['hue-rotate(0deg)', 'hue-rotate(360deg)'],
          }),
        }}
      />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// MegaAnimation Component
// ---------------------------------------------------------------------------

export default function MegaAnimation({
  gift,
  sender,
  screenWidth,
  screenHeight,
  onComplete,
}) {
  const giftDef = GOLD_GIFTS[gift.type] || GOLD_GIFTS.goldenlion;
  const emoji = gift.emoji || giftDef.emoji;
  const giftName = gift.name || giftDef.name;
  const giftColor = giftDef.color;
  const tintColor = giftDef.tintColor;

  // Animated values
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const iconTranslateY = useRef(new Animated.Value(screenHeight + 100)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const iconOpacity = useRef(new Animated.Value(1)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  const usernameScale = useRef(new Animated.Value(0)).current;
  const usernameOpacity = useRef(new Animated.Value(0)).current;
  const giftNameOpacity = useRef(new Animated.Value(0)).current;
  const giftNameTranslateY = useRef(new Animated.Value(20)).current;
  const textScale = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;

  // Mutable refs
  const particlesRef = useRef([]);
  const flashRef = useRef(0);
  const iconCenterRef = useRef({ x: screenWidth / 2, y: screenHeight / 2 });
  const giftSpawnIntervalRef = useRef(null);
  const completedRef = useRef(false);

  const centerX = screenWidth / 2;
  const centerY = screenHeight * 0.4;

  useEffect(() => {
    iconCenterRef.current = { x: centerX, y: centerY };
  }, [centerX, centerY]);

  // ------- Master timeline -------
  useEffect(() => {
    const particles = particlesRef.current;
    particles.length = 0;

    // 0ms: Overlay fade in
    Animated.timing(overlayOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();

    // 0ms: Spawn ambient particles
    for (let i = 0; i < 25; i++) {
      particles.push(createAmbientParticle(screenWidth, screenHeight));
    }

    // Ambient replenish interval
    const ambientInterval = setInterval(() => {
      if (particles.length < 200) {
        particles.push(createAmbientParticle(screenWidth, screenHeight));
      }
    }, 200);

    // 200ms: Icon enters from bottom
    const iconEnterTimer = setTimeout(() => {
      Animated.timing(iconTranslateY, {
        toValue: 0,
        duration: 300,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
        useNativeDriver: false,
      }).start();
    }, 200);

    // 500ms: Burst explosion + flash
    const burstTimer = setTimeout(() => {
      const burstColors = [giftColor, '#ffffff', '#fffacd', '#ffeedd', giftColor];
      for (let i = 0; i < 160; i++) {
        particles.push(createBurstParticle(centerX, centerY, burstColors));
      }
      // Flash
      flashRef.current = 0.01;
      const flashStart = performance.now();
      const flashDuration = 400;
      const flashLoop = () => {
        const elapsed = performance.now() - flashStart;
        const progress = Math.min(1, elapsed / flashDuration);
        flashRef.current = progress;
        if (progress < 1) requestAnimationFrame(flashLoop);
        else flashRef.current = 1;
      };
      requestAnimationFrame(flashLoop);
    }, 500);

    // 600ms: Screen shake
    const shakeTimer = setTimeout(() => {
      buildShakeSequence(shakeX).start();
    }, 600);

    // 700ms: Icon spring settle + glow loop
    const settleTimer = setTimeout(() => {
      Animated.spring(iconScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: false,
      }).start();

      // Glow pulse loop
      const glowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowScale, {
            toValue: 1.2,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(glowScale, {
            toValue: 1.0,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      );
      glowLoop.start();

      // Store for cleanup
      settleTimer._glowLoop = glowLoop;
    }, 700);

    // 1000ms: Text appears
    const textTimer = setTimeout(() => {
      Animated.spring(usernameScale, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: false,
      }).start();
      Animated.timing(usernameOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();

      Animated.timing(giftNameOpacity, {
        toValue: 1,
        duration: 400,
        delay: 100,
        useNativeDriver: false,
      }).start();
      Animated.timing(giftNameTranslateY, {
        toValue: 0,
        duration: 400,
        delay: 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    }, 1000);

    // 1200ms - 3500ms: Gift-specific particles
    const giftEffectTimer = setTimeout(() => {
      const factory = giftParticleFactories[gift.type];
      if (!factory) return;

      // Spawn rate depends on gift type
      const spawnRates = {
        goldenlion: { interval: 70, count: 1 },
        crystalpalace: { interval: 80, count: 2 },
        privatejet: { interval: 50, count: 2 },
        galaxyportal: { interval: 60, count: 2 },
        dragon: { interval: 40, count: 3 },
      };
      const rate = spawnRates[gift.type] || { interval: 60, count: 2 };

      giftSpawnIntervalRef.current = setInterval(() => {
        for (let i = 0; i < rate.count; i++) {
          if (particles.length < 500) {
            particles.push(factory(centerX, centerY, screenWidth, screenHeight));
          }
        }
      }, rate.interval);
    }, 1200);

    // 3500ms: Wind down
    const windDownTimer = setTimeout(() => {
      if (giftSpawnIntervalRef.current) {
        clearInterval(giftSpawnIntervalRef.current);
        giftSpawnIntervalRef.current = null;
      }
    }, 3500);

    // 4000ms: Fade out icon + text
    const fadeOutTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(iconOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: false,
        }),
        Animated.timing(iconScale, {
          toValue: 0.5,
          duration: 500,
          easing: Easing.in(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: false,
        }),
        Animated.timing(textScale, {
          toValue: 0.5,
          duration: 500,
          easing: Easing.in(Easing.ease),
          useNativeDriver: false,
        }),
      ]).start();
    }, 4000);

    // 4500ms: Overlay fade out
    const overlayFadeTimer = setTimeout(() => {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }, 4500);

    // 5000ms: Complete
    const completeTimer = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete && onComplete();
      }
    }, 5000);

    return () => {
      clearInterval(ambientInterval);
      clearTimeout(iconEnterTimer);
      clearTimeout(burstTimer);
      clearTimeout(shakeTimer);
      clearTimeout(settleTimer);
      clearTimeout(textTimer);
      clearTimeout(giftEffectTimer);
      clearTimeout(windDownTimer);
      clearTimeout(fadeOutTimer);
      clearTimeout(overlayFadeTimer);
      clearTimeout(completeTimer);
      if (giftSpawnIntervalRef.current) clearInterval(giftSpawnIntervalRef.current);
      particles.length = 0;
    };
  }, [
    gift.type,
    screenWidth,
    screenHeight,
    centerX,
    centerY,
    giftColor,
    overlayOpacity,
    iconTranslateY,
    iconScale,
    iconOpacity,
    shakeX,
    glowScale,
    usernameScale,
    usernameOpacity,
    giftNameOpacity,
    giftNameTranslateY,
    textOpacity,
    textScale,
    onComplete,
  ]);

  // ------- Render -------
  const overlayBg = overlayOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)'],
  });

  const isCrystal = gift.type === 'crystalpalace';

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.root]} pointerEvents="none">
      {/* Tinted overlay */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: overlayOpacity }]}>
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: tintColor }]} />
      </Animated.View>

      {/* Shake wrapper */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { transform: [{ translateX: shakeX }] },
        ]}
      >
        {/* Canvas layer */}
        <MegaCanvas
          canvasWidth={screenWidth}
          canvasHeight={screenHeight}
          particlesRef={particlesRef}
          flashRef={flashRef}
          iconCenterRef={iconCenterRef}
        />

        {/* Center content (glow + icon + text) */}
        <View style={[styles.centerContainer, { top: centerY - 130 }]}>
          {/* Glow */}
          <View style={styles.glowContainer}>
            {isCrystal ? (
              <PrismaticGlow visible={true} scale={glowScale} />
            ) : (
              <Glow glowScale={glowScale} giftColor={giftColor} />
            )}
          </View>

          {/* Username text */}
          <Animated.View
            style={[
              styles.textRow,
              {
                opacity: Animated.multiply(usernameOpacity, textOpacity),
                transform: [
                  { scale: Animated.multiply(usernameScale, textScale) },
                ],
              },
            ]}
          >
            <Text style={[styles.usernameText, { color: giftColor }]}>
              {sender.username}
            </Text>
          </Animated.View>

          {/* Icon */}
          <Animated.View
            style={[
              styles.iconContainer,
              {
                opacity: iconOpacity,
                transform: [
                  { translateY: iconTranslateY },
                  { scale: iconScale },
                ],
              },
            ]}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </Animated.View>

          {/* Gift name text */}
          <Animated.View
            style={[
              styles.textRow,
              {
                opacity: Animated.multiply(giftNameOpacity, textOpacity),
                transform: [
                  { translateY: giftNameTranslateY },
                  { scale: textScale },
                ],
              },
            ]}
          >
            <Text style={styles.giftNameText}>{giftName}</Text>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    zIndex: 1001,
    pointerEvents: 'none',
  },
  centerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 200,
  },
  emoji: {
    fontSize: 120,
    textAlign: 'center',
    lineHeight: 200,
  },
  textRow: {
    alignItems: 'center',
    marginVertical: 4,
  },
  usernameText: {
    fontSize: 24,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  giftNameText: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});

// ---------------------------------------------------------------------------
// MegaAnimationManager — queued single-play manager
// ---------------------------------------------------------------------------

export function MegaAnimationManager({ megas, screenWidth, screenHeight, onMegaComplete }) {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const processedIdsRef = useRef(new Set());

  // Enqueue new megas
  useEffect(() => {
    if (!megas || megas.length === 0) return;

    const newItems = megas.filter((m) => {
      const id = m.id || `${m.gift?.type}_${m.sender?.username}_${Date.now()}`;
      if (processedIdsRef.current.has(id)) return false;
      processedIdsRef.current.add(id);
      return true;
    });

    if (newItems.length > 0) {
      setQueue((prev) => [...prev, ...newItems]);
    }
  }, [megas]);

  // Play next from queue
  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
  }, [current, queue]);

  const handleComplete = useCallback(() => {
    const finished = current;
    setCurrent(null);
    if (onMegaComplete && finished) {
      onMegaComplete(finished);
    }
  }, [current, onMegaComplete]);

  if (!current) return null;

  return (
    <MegaAnimation
      gift={current.gift}
      sender={current.sender}
      screenWidth={screenWidth}
      screenHeight={screenHeight}
      onComplete={handleComplete}
    />
  );
}
