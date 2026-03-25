import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { View, Text, Animated, Easing, StyleSheet, Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Bezier helpers
// ---------------------------------------------------------------------------

function quadBezier(t, p0, p1, p2) {
  const mt = 1 - t;
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
}

function cubicBezier(t, p0, p1, p2, p3) {
  const mt = 1 - t;
  return (
    mt * mt * mt * p0 +
    3 * mt * mt * t * p1 +
    3 * mt * t * t * p2 +
    t * t * t * p3
  );
}

function getPosition(t, screenWidth, screenHeight) {
  const startX = screenWidth + 100;
  const endX = -150;
  const midX = screenWidth * 0.5;
  const startY = screenHeight * 0.35;
  const peakY = screenHeight * 0.3;
  const endY = screenHeight * 0.35;

  // X uses a cubic bezier for smooth ease-through
  const cx1 = startX - (startX - midX) * 0.4;
  const cx2 = endX + (midX - endX) * 0.4;
  const x = cubicBezier(t, startX, cx1, cx2, endX);

  // Y uses a quadratic bezier for the gentle arc
  const y = quadBezier(t, startY, peakY, endY);

  return { x, y };
}

// ---------------------------------------------------------------------------
// Particle system (lightweight)
// ---------------------------------------------------------------------------

function createParticle(x, y, color) {
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.3 + Math.random() * 0.8;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 0.4,
    life: 1.0,
    decay: 0.015 + Math.random() * 0.025,
    radius: 1.5 + Math.random() * 2.5,
    color,
  };
}

// ---------------------------------------------------------------------------
// Trail Canvas (web only – renders ribbon + particles)
// ---------------------------------------------------------------------------

const TrailCanvas = React.memo(function TrailCanvas({
  positions,
  particles,
  trailColor,
  canvasWidth,
  canvasHeight,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // --- Draw ribbon trail ---
    const pts = positions;
    if (pts.length >= 2) {
      for (let i = 1; i < pts.length; i++) {
        const progress = i / pts.length;
        const alpha = progress * 0.7;
        const width = progress * 6 + 1;

        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = hexToRgba(trailColor, alpha);
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      // Secondary thinner highlight trail
      if (pts.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y - 1);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y - 1);
        }
        ctx.strokeStyle = hexToRgba('#ffffff', 0.15);
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }

    // --- Draw particles ---
    for (const p of particles) {
      if (p.life <= 0) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(p.color, p.life * 0.8);
      ctx.fill();
    }
  }, [positions, particles, trailColor, canvasWidth, canvasHeight]);

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
// Helpers
// ---------------------------------------------------------------------------

function hexToRgba(hex, alpha) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  const n = parseInt(c, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function avatarBgFromLetter(letter) {
  const charCode = (letter || 'A').toUpperCase().charCodeAt(0);
  const hue = ((charCode - 65) * 37) % 360;
  return `hsl(${hue}, 60%, 45%)`;
}

// ---------------------------------------------------------------------------
// SweepAnimation Component
// ---------------------------------------------------------------------------

export function SweepAnimation({
  gift,
  sender,
  id,
  index = 0,
  screenWidth,
  screenHeight,
  onComplete,
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  const [trailPositions, setTrailPositions] = useState([]);
  const [particles, setParticles] = useState([]);
  const [currentPos, setCurrentPos] = useState({ x: screenWidth + 100, y: screenHeight * 0.35 });

  const positionsRef = useRef([]);
  const particlesRef = useRef([]);
  const particleFrameRef = useRef(null);
  const hasPulsed = useRef(false);
  const hasShownText = useRef(false);
  const mountedRef = useRef(true);

  const verticalOffset = index * 70;

  // Particle tick loop
  const tickParticles = useCallback(() => {
    if (!mountedRef.current) return;

    const alive = [];
    for (const p of particlesRef.current) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.02; // gentle gravity
      p.life -= p.decay;
      if (p.life > 0) alive.push(p);
    }
    particlesRef.current = alive;
    setParticles([...alive]);

    particleFrameRef.current = requestAnimationFrame(tickParticles);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // -- Listen to progress for position tracking --
    const listenerId = progress.addListener(({ value: t }) => {
      if (!mountedRef.current) return;

      const pos = getPosition(t, screenWidth, screenHeight);
      pos.y += verticalOffset;

      setCurrentPos({ x: pos.x, y: pos.y });

      // Accumulate trail (keep last 15 positions)
      positionsRef.current.push({ x: pos.x, y: pos.y });
      if (positionsRef.current.length > 15) {
        positionsRef.current = positionsRef.current.slice(-15);
      }
      setTrailPositions([...positionsRef.current]);

      // Spawn particles along the trail (8-12 over the lifetime)
      if (Math.random() < 0.18) {
        const newP = createParticle(pos.x, pos.y, gift.trailColor);
        particlesRef.current.push(newP);
      }

      // Icon pulse at midpoint
      if (t >= 0.4 && t <= 0.6 && !hasPulsed.current) {
        hasPulsed.current = true;
        Animated.sequence([
          Animated.spring(iconScale, {
            toValue: 1.3,
            friction: 5,
            tension: 200,
            useNativeDriver: false,
          }),
          Animated.spring(iconScale, {
            toValue: 1.0,
            friction: 4,
            tension: 120,
            useNativeDriver: false,
          }),
        ]).start();
      }

      // Show text pill when near center
      if (t >= 0.35 && !hasShownText.current) {
        hasShownText.current = true;
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }).start();
      }
    });

    // -- Start particle animation loop --
    particleFrameRef.current = requestAnimationFrame(tickParticles);

    // -- Main sweep animation --
    const sweepAnim = Animated.timing(progress, {
      toValue: 1,
      duration: 2500,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    });

    // -- Rotation loop --
    const rotationAnim = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2500,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );

    rotationAnim.start();
    sweepAnim.start(({ finished }) => {
      if (finished && mountedRef.current) {
        rotationAnim.stop();
        onComplete && onComplete(id);
      }
    });

    return () => {
      mountedRef.current = false;
      progress.removeListener(listenerId);
      sweepAnim.stop();
      rotationAnim.stop();
      if (particleFrameRef.current) {
        cancelAnimationFrame(particleFrameRef.current);
      }
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Interpolate rotation
  const rotateInterpolation = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const iconSize = 80;
  const avatarSize = 30;
  const groupLeftOffset = -(avatarSize + 8 + 60); // avatar + gap + some username space to the left

  return (
    <View style={[styles.container, { width: screenWidth, height: screenHeight }]} pointerEvents="none">
      {/* Trail canvas */}
      <TrailCanvas
        positions={trailPositions}
        particles={particles}
        trailColor={gift.trailColor}
        canvasWidth={screenWidth}
        canvasHeight={screenHeight}
      />

      {/* Glow div behind icon */}
      {Platform.OS === 'web' && (
        <div
          style={{
            position: 'absolute',
            left: currentPos.x - 60,
            top: currentPos.y - 60,
            width: 120,
            height: 120,
            borderRadius: 60,
            background: `radial-gradient(circle, ${hexToRgba(gift.glowColor, 0.45)} 0%, ${hexToRgba(gift.glowColor, 0.12)} 45%, transparent 70%)`,
            pointerEvents: 'none',
            filter: 'blur(4px)',
          }}
        />
      )}

      {/* Sweep group: avatar + username + icon */}
      <View
        style={[
          styles.sweepGroup,
          {
            left: currentPos.x + groupLeftOffset,
            top: currentPos.y - iconSize / 2,
          },
        ]}
      >
        {/* Avatar circle */}
        <View
          style={[
            styles.avatar,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              borderColor: gift.trailColor,
              backgroundColor: avatarBgFromLetter(sender.avatarLetter),
            },
          ]}
        >
          <Text style={styles.avatarText}>{sender.avatarLetter}</Text>
        </View>

        {/* Username */}
        <Text style={styles.username} numberOfLines={1}>
          {sender.username}
        </Text>

        {/* Gift icon with rotation + scale */}
        <Animated.View
          style={{
            width: iconSize,
            height: iconSize,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [
              { rotate: rotateInterpolation },
              { scale: iconScale },
            ],
          }}
        >
          <Text style={styles.emoji}>{gift.emoji}</Text>
        </Animated.View>
      </View>

      {/* Text pill: "[username] sent [gift name]" */}
      <Animated.View
        style={[
          styles.textPill,
          {
            opacity: textOpacity,
            top: currentPos.y + iconSize / 2 + 6,
            left: currentPos.x - 80,
          },
        ]}
      >
        <Text style={styles.textPillLabel}>
          {sender.username} sent {gift.name}
        </Text>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SweepAnimationManager
// ---------------------------------------------------------------------------

export function SweepAnimationManager({
  sweeps = [],
  screenWidth,
  screenHeight,
  onSweepComplete,
}) {
  // Track which index slots are occupied
  const slotsRef = useRef(new Map()); // id -> index
  const freeSlots = useRef([]); // recycled slot indices
  const nextSlot = useRef(0);

  // Build active list with assigned indices
  const activeSweeps = useMemo(() => {
    const currentIds = new Set(sweeps.map((s) => s.id));

    // Release slots for sweeps that are no longer in the list
    for (const [existingId] of slotsRef.current) {
      if (!currentIds.has(existingId)) {
        const freedIndex = slotsRef.current.get(existingId);
        freeSlots.current.push(freedIndex);
        slotsRef.current.delete(existingId);
      }
    }

    // Sort free slots so we reuse lowest first
    freeSlots.current.sort((a, b) => a - b);

    return sweeps.map((s) => {
      if (!slotsRef.current.has(s.id)) {
        const slotIndex =
          freeSlots.current.length > 0
            ? freeSlots.current.shift()
            : nextSlot.current++;
        slotsRef.current.set(s.id, slotIndex);
      }
      return {
        ...s,
        index: slotsRef.current.get(s.id),
      };
    });
  }, [sweeps]);

  const handleComplete = useCallback(
    (id) => {
      // Free the slot
      const idx = slotsRef.current.get(id);
      if (idx !== undefined) {
        freeSlots.current.push(idx);
        freeSlots.current.sort((a, b) => a - b);
        slotsRef.current.delete(id);
      }
      onSweepComplete && onSweepComplete(id);
    },
    [onSweepComplete]
  );

  return (
    <View
      style={[styles.managerContainer, { width: screenWidth, height: screenHeight }]}
      pointerEvents="none"
    >
      {activeSweeps.map((s) => (
        <SweepAnimation
          key={s.id}
          id={s.id}
          gift={s.gift}
          sender={s.sender}
          index={s.index}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          onComplete={handleComplete}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Preset gift definitions
// ---------------------------------------------------------------------------

export const GIFT_TYPES = {
  Rose: { emoji: '\u{1F339}', name: 'Rose', trailColor: '#ff1493', glowColor: '#ff69b4' },
  Wand: { emoji: '\u{1FA84}', name: 'Wand', trailColor: '#d394ff', glowColor: '#aa30fa' },
  Pizza: { emoji: '\u{1F355}', name: 'Pizza', trailColor: '#ff8c00', glowColor: '#ffa500' },
  Music: { emoji: '\u{1F3B5}', name: 'Music', trailColor: '#00eefc', glowColor: '#00deec' },
  Sunglasses: { emoji: '\u{1F60E}', name: 'Sunglasses', trailColor: '#ffd700', glowColor: '#ffe792' },
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  managerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  sweepGroup: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  username: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 80,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  emoji: {
    fontSize: 48,
    textAlign: 'center',
  },
  textPill: {
    position: 'absolute',
    backgroundColor: '#150629cc',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  textPillLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default SweepAnimation;
