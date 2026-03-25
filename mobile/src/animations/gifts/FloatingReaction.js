import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

// ---------------------------------------------------------------------------
// Reaction theme definitions
// ---------------------------------------------------------------------------
const REACTION_THEMES = {
  heart: {
    emoji: '\u2764\uFE0F',
    colors: ['#ff1493', '#ff69b4', '#ff6b9d'],
    particleBehavior: 'orbit',
  },
  flame: {
    emoji: '\uD83D\uDD25',
    colors: ['#ff4500', '#ff6347', '#ffa500'],
    particleBehavior: 'fall',
  },
  star: {
    emoji: '\u2B50',
    colors: ['#ffd700', '#ffe792', '#ffffff'],
    particleBehavior: 'twinkle',
  },
  clap: {
    emoji: '\uD83D\uDC4F',
    colors: ['#ffd700', '#ffec8b', '#fffacd'],
    particleBehavior: 'burst',
  },
  laugh: {
    emoji: '\uD83D\uDE02',
    colors: ['#ffd700', '#ff8c00', '#ffe792'],
    particleBehavior: 'bounce',
  },
};

const ANIMATION_DURATION = 2000;
const ICON_SIZE = 40;
const SPARKLE_CANVAS_SIZE = 80; // canvas extends beyond the icon on each side
const PARTICLE_COUNT = 4;

// ---------------------------------------------------------------------------
// Sparkle canvas — draws tiny particles behind the floating emoji (web only)
// ---------------------------------------------------------------------------
function useSparkleCanvas(theme, duration) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const cx = SPARKLE_CANVAS_SIZE / 2;
    const cy = SPARKLE_CANVAS_SIZE / 2;

    // Pre-compute particle seeds
    const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      angle: (Math.PI * 2 * i) / PARTICLE_COUNT + Math.random() * 0.5,
      radius: 16 + Math.random() * 8,
      size: 2 + Math.random() * 2,
      speed: 1.5 + Math.random() * 1.5,
      color: theme.colors[i % theme.colors.length],
      phaseOffset: Math.random() * Math.PI * 2,
    }));

    const draw = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const globalAlpha = 1 - progress;

      ctx.clearRect(0, 0, SPARKLE_CANVAS_SIZE, SPARKLE_CANVAS_SIZE);

      for (const p of particles) {
        const t = elapsed / 1000;
        let x, y, alpha;

        switch (theme.particleBehavior) {
          case 'orbit': {
            const a = p.angle + t * p.speed;
            x = cx + Math.cos(a) * p.radius;
            y = cy + Math.sin(a) * p.radius;
            alpha = globalAlpha * (0.6 + 0.4 * Math.sin(t * 4 + p.phaseOffset));
            break;
          }
          case 'fall': {
            // Embers drift outward and fall down
            const drift = Math.sin(t * 2 + p.phaseOffset) * 8;
            x = cx + drift + (p.angle - Math.PI) * 4;
            y = cy + (t * 30 * p.speed) % SPARKLE_CANVAS_SIZE;
            alpha = globalAlpha * (0.5 + 0.5 * Math.random());
            break;
          }
          case 'twinkle': {
            const a = p.angle + t * p.speed * 0.5;
            x = cx + Math.cos(a) * p.radius;
            y = cy + Math.sin(a) * p.radius;
            // Sharp twinkle blink
            alpha = globalAlpha * (Math.sin(t * 8 + p.phaseOffset) > 0.3 ? 1 : 0.15);
            break;
          }
          case 'bounce': {
            const a = p.angle + t * p.speed * 0.8;
            const bounceY = Math.abs(Math.sin(t * 5 + p.phaseOffset)) * 10;
            x = cx + Math.cos(a) * p.radius;
            y = cy + Math.sin(a) * p.radius - bounceY;
            alpha = globalAlpha * (0.6 + 0.4 * Math.sin(t * 3 + p.phaseOffset));
            break;
          }
          case 'burst':
          default: {
            const a = p.angle + t * p.speed * 0.3;
            x = cx + Math.cos(a) * p.radius;
            y = cy + Math.sin(a) * p.radius;
            alpha = globalAlpha * (0.5 + 0.5 * Math.sin(t * 3 + p.phaseOffset));
            break;
          }
        }

        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(draw);
      }
    };

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [theme, duration]);

  return canvasRef;
}

// ---------------------------------------------------------------------------
// Clap burst canvas — radial yellow lines that fade out quickly (web only)
// ---------------------------------------------------------------------------
function ClapBurstCanvas({ colors }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const size = SPARKLE_CANVAS_SIZE;
    const cx = size / 2;
    const cy = size / 2;
    const lineCount = 10;
    const burstDuration = 400;
    const start = performance.now();

    const draw = (timestamp) => {
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / burstDuration, 1);
      const alpha = 1 - progress;
      const reach = 8 + progress * 28;

      ctx.clearRect(0, 0, size, size);
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 1.5;

      for (let i = 0; i < lineCount; i++) {
        const angle = (Math.PI * 2 * i) / lineCount;
        const innerR = 6 + progress * 6;
        const outerR = innerR + reach;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
        ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
        ctx.strokeStyle = colors[i % colors.length];
        ctx.stroke();
      }

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(draw);
      }
    };

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [colors]);

  return (
    <canvas
      ref={canvasRef}
      width={SPARKLE_CANVAS_SIZE}
      height={SPARKLE_CANVAS_SIZE}
      style={styles.burstCanvas}
    />
  );
}

// ---------------------------------------------------------------------------
// FloatingReaction — single floating emoji with sparkle particles
// ---------------------------------------------------------------------------
function FloatingReaction({
  type = 'heart',
  id,
  screenWidth,
  screenHeight,
  startX,
  startY,
  onComplete,
}) {
  const theme = REACTION_THEMES[type] || REACTION_THEMES.heart;

  // Animated values
  const translateY = useRef(new Animated.Value(0)).current;
  const wobbleX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const animationsRef = useRef([]);

  // Random X offset for fan-out when multiple reactions fire
  const randomOffsetX = useMemo(() => (Math.random() - 0.5) * 60, []);

  const sparkleCanvasRef = useSparkleCanvas(theme, ANIMATION_DURATION);

  const cleanUp = useCallback(() => {
    animationsRef.current.forEach((a) => a.stop());
    animationsRef.current = [];
  }, []);

  useEffect(() => {
    const floatDistance = -screenHeight * 0.5;

    // Main upward float
    const floatAnim = Animated.timing(translateY, {
      toValue: floatDistance,
      duration: ANIMATION_DURATION,
      useNativeDriver: false,
    });

    // Sine-wave wobble via looped sequence: right -> left -> right -> center
    const wobbleCycleDuration = 333; // ~3 Hz
    const wobbleAmp = 20;
    const wobbleAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(wobbleX, {
          toValue: wobbleAmp,
          duration: wobbleCycleDuration,
          useNativeDriver: false,
        }),
        Animated.timing(wobbleX, {
          toValue: -wobbleAmp,
          duration: wobbleCycleDuration * 2,
          useNativeDriver: false,
        }),
        Animated.timing(wobbleX, {
          toValue: 0,
          duration: wobbleCycleDuration,
          useNativeDriver: false,
        }),
      ]),
    );

    // Scale: grow to 1.2x at midpoint, shrink back
    const scaleAnim = Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.2,
        duration: 800,
        useNativeDriver: false,
      }),
      Animated.timing(scale, {
        toValue: 1.0,
        duration: 1200,
        useNativeDriver: false,
      }),
    ]);

    // Opacity: 1 -> 0 over full duration
    const opacityAnim = Animated.timing(opacity, {
      toValue: 0,
      duration: ANIMATION_DURATION,
      useNativeDriver: false,
    });

    // Store references for cleanup
    animationsRef.current = [floatAnim, wobbleAnim, scaleAnim, opacityAnim];

    // Start all in parallel; call onComplete when the main float finishes
    Animated.parallel([floatAnim, wobbleAnim, scaleAnim, opacityAnim]).start(
      ({ finished }) => {
        if (finished && onComplete) {
          onComplete();
        }
      },
    );

    return cleanUp;
  }, [
    translateY,
    wobbleX,
    scale,
    opacity,
    screenHeight,
    onComplete,
    cleanUp,
  ]);

  const isWeb = Platform.OS === 'web';

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.reactionContainer,
        {
          left: startX + randomOffsetX - SPARKLE_CANVAS_SIZE / 2,
          top: startY - SPARKLE_CANVAS_SIZE / 2,
          width: SPARKLE_CANVAS_SIZE,
          height: SPARKLE_CANVAS_SIZE,
          opacity,
          transform: [{ translateX: wobbleX }, { translateY }, { scale }],
        },
      ]}
    >
      {/* Sparkle particles canvas (behind the emoji) */}
      {isWeb && (
        <canvas
          ref={sparkleCanvasRef}
          width={SPARKLE_CANVAS_SIZE}
          height={SPARKLE_CANVAS_SIZE}
          style={styles.sparkleCanvas}
        />
      )}

      {/* Clap burst overlay */}
      {isWeb && type === 'clap' && <ClapBurstCanvas colors={theme.colors} />}

      {/* Emoji icon */}
      <Animated.Text
        style={[
          styles.emoji,
          { fontSize: ICON_SIZE, lineHeight: ICON_SIZE + 4 },
        ]}
      >
        {theme.emoji}
      </Animated.Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// FloatingReactionManager — renders and manages multiple simultaneous
// FloatingReaction instances with fan-out
// ---------------------------------------------------------------------------
function FloatingReactionManager({
  reactions = [],
  screenWidth,
  screenHeight,
  onReactionComplete,
}) {
  // Default spawn position near the gift button (bottom-right)
  const defaultStartX = screenWidth - 60;
  const defaultStartY = screenHeight - 120;

  const handleComplete = useCallback(
    (id) => {
      if (onReactionComplete) {
        onReactionComplete(id);
      }
    },
    [onReactionComplete],
  );

  return (
    <View style={styles.managerContainer} pointerEvents="none">
      {reactions.map((reaction) => (
        <FloatingReaction
          key={reaction.id}
          id={reaction.id}
          type={reaction.type}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          startX={defaultStartX}
          startY={defaultStartY}
          onComplete={() => handleComplete(reaction.id)}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  reactionContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  emoji: {
    textAlign: 'center',
    position: 'absolute',
  },
  sparkleCanvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
  },
  burstCanvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
  },
  managerContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
});

export { FloatingReaction, FloatingReactionManager, REACTION_THEMES };
export default FloatingReaction;
