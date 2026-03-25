import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useRef,
  useCallback,
} from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import AnimationSequencer from './AnimationSequencer';
import GlowEffect from './GlowEffect';

/**
 * AnimationLayer - full-screen overlay that sits on top of the live stream
 * and manages a queue of gift animations.
 *
 * - Tier 1-2 (small/cheap) gifts stack simultaneously (max 3 at once)
 * - Tier 3+ (big/expensive) gifts play sequentially via a FIFO queue
 *
 * Expose `triggerGift(giftConfig)` through ref.
 *
 * giftConfig shape:
 *   { emoji, name, cost, tier, senderName, color }
 *
 * Props
 * ─────
 * @param {number} screenWidth
 * @param {number} screenHeight
 */

const MAX_SMALL_CONCURRENT = 3;
const SMALL_ANIM_DURATION = 2200;
const BIG_ANIM_DURATION = 3800;

// ── Small gift banner (tier 1-2) ─────────────────────────────────────

function SmallGiftAnimation({ gift, index, screenWidth, onComplete }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-screenWidth * 0.5)).current;
  const scale = useRef(new Animated.Value(0.6)).current;

  React.useEffect(() => {
    const anim = Animated.sequence([
      // Slide in from left + fade in
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.spring(translateX, {
          toValue: 0,
          friction: 7,
          tension: 80,
          useNativeDriver: false,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          tension: 90,
          useNativeDriver: false,
        }),
      ]),
      // Hold
      Animated.delay(SMALL_ANIM_DURATION * 0.5),
      // Fade out
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(translateX, {
          toValue: screenWidth * 0.3,
          duration: 400,
          useNativeDriver: false,
        }),
      ]),
    ]);

    anim.start(({ finished }) => {
      if (finished && onComplete) onComplete();
    });

    return () => anim.stop();
  }, []);

  const topOffset = 120 + index * 64;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.smallBanner,
        {
          top: topOffset,
          opacity,
          transform: [{ translateX }, { scale }],
        },
      ]}
    >
      <Text style={styles.smallEmoji}>{gift.emoji || '🎁'}</Text>
      <View style={styles.smallInfo}>
        <Text style={styles.smallSender} numberOfLines={1}>
          {gift.senderName || 'Someone'}
        </Text>
        <Text style={[styles.smallName, { color: gift.color || '#d394ff' }]}>
          sent {gift.name || 'a gift'}
        </Text>
      </View>
    </Animated.View>
  );
}

// ── Big gift full-screen (tier 3+) ──────────────────────────────────

function BigGiftAnimation({ gift, screenWidth, screenHeight, onComplete }) {
  const centerX = screenWidth / 2;
  const centerY = screenHeight / 2;

  const timeline = React.useMemo(
    () => [
      {
        time: 0,
        type: 'flash',
        config: {
          color: gift.color || '#d394ff',
          duration: 350,
        },
      },
      {
        time: 50,
        type: 'glow',
        config: {
          color: gift.color || '#d394ff',
          intensity: 0.8,
          size: 350,
          x: centerX,
          y: centerY,
          animated: true,
          duration: BIG_ANIM_DURATION - 400,
        },
      },
      {
        time: 200,
        type: 'icon',
        config: {
          emoji: gift.emoji || '🎁',
          x: centerX,
          y: centerY - 30,
          scale: 1.8,
          fontSize: 80,
          duration: BIG_ANIM_DURATION - 600,
        },
      },
      {
        time: 400,
        type: 'particles',
        config: {
          x: centerX,
          y: centerY,
          count: 40,
          spread: 160,
          colors: [gift.color || '#d394ff', '#00eefc', '#ffe792', '#ffffff'],
          emoji: gift.emoji,
          duration: BIG_ANIM_DURATION - 600,
        },
      },
      {
        time: 600,
        type: 'text',
        config: {
          text: `${gift.senderName || 'Someone'} sent`,
          x: centerX - 100,
          y: centerY + 60,
          fontSize: 18,
          color: '#ffffff',
          duration: BIG_ANIM_DURATION - 800,
        },
      },
      {
        time: 650,
        type: 'text',
        config: {
          text: gift.name || 'Gift',
          x: centerX - 80,
          y: centerY + 90,
          fontSize: 26,
          color: gift.color || '#ffe792',
          duration: BIG_ANIM_DURATION - 900,
        },
      },
    ],
    [gift, centerX, centerY],
  );

  return (
    <AnimationSequencer
      timeline={timeline}
      active
      onComplete={onComplete}
      screenWidth={screenWidth}
      screenHeight={screenHeight}
    />
  );
}

// ── Main layer ───────────────────────────────────────────────────────

const AnimationLayer = forwardRef(function AnimationLayer(
  { screenWidth = 400, screenHeight = 800 },
  ref,
) {
  // Small gifts (tier 1-2): rendered simultaneously, max 3
  const [smallAnimations, setSmallAnimations] = useState([]);
  // Big gifts (tier 3+): queued, played one at a time
  const [activeBigGift, setActiveBigGift] = useState(null);
  const bigQueueRef = useRef([]);
  const idCounter = useRef(0);
  const playingBig = useRef(false);

  // ── Queue management ──────────────────────────────────────────

  const playNextBig = useCallback(() => {
    if (bigQueueRef.current.length === 0) {
      playingBig.current = false;
      setActiveBigGift(null);
      return;
    }

    playingBig.current = true;
    const next = bigQueueRef.current.shift();
    setActiveBigGift(next);
  }, []);

  const handleBigComplete = useCallback(() => {
    setActiveBigGift(null);
    // Small delay before the next big gift so they don't blend together
    setTimeout(() => playNextBig(), 300);
  }, [playNextBig]);

  const handleSmallComplete = useCallback((animId) => {
    setSmallAnimations((prev) => prev.filter((a) => a.id !== animId));
  }, []);

  // ── Public API ────────────────────────────────────────────────

  useImperativeHandle(
    ref,
    () => ({
      triggerGift(giftConfig) {
        if (!giftConfig) return;

        const id = ++idCounter.current;
        const entry = { id, ...giftConfig };

        if ((giftConfig.tier || 1) >= 3) {
          // Big gift: queue it
          bigQueueRef.current.push(entry);
          if (!playingBig.current) {
            playNextBig();
          }
        } else {
          // Small gift: stack up to MAX_SMALL_CONCURRENT
          setSmallAnimations((prev) => {
            if (prev.length >= MAX_SMALL_CONCURRENT) {
              // Drop the oldest to make room
              const trimmed = prev.slice(1);
              return [...trimmed, entry];
            }
            return [...prev, entry];
          });
        }
      },
    }),
    [playNextBig],
  );

  // Nothing to render
  if (smallAnimations.length === 0 && !activeBigGift) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {/* Small gift banners */}
      {smallAnimations.map((anim, idx) => (
        <SmallGiftAnimation
          key={anim.id}
          gift={anim}
          index={idx}
          screenWidth={screenWidth}
          onComplete={() => handleSmallComplete(anim.id)}
        />
      ))}

      {/* Big gift full-screen */}
      {activeBigGift && (
        <BigGiftAnimation
          key={activeBigGift.id}
          gift={activeBigGift}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          onComplete={handleBigComplete}
        />
      )}
    </View>
  );
});

export default AnimationLayer;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  smallBanner: {
    position: 'absolute',
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(21, 6, 41, 0.75)',
    borderRadius: 24,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(211, 148, 255, 0.2)',
    maxWidth: 260,
  },
  smallEmoji: {
    fontSize: 28,
    marginRight: 8,
  },
  smallInfo: {
    flexShrink: 1,
  },
  smallSender: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  smallName: {
    fontSize: 13,
    fontWeight: '600',
  },
});
