/**
 * GiftAnimations.js
 *
 * Animation presets for 10 gift tiers in the live-streaming app.
 * Each preset returns a timeline array (for AnimationSequencer),
 * particle configs (for ParticleSystem), total duration, tier, and
 * whether the animation is full-screen.
 */

// ---------------------------------------------------------------------------
// Theme color palettes
// ---------------------------------------------------------------------------
const COLORS = {
  rose:     ['#ff69b4', '#ff1493', '#ff6b9d'],
  heart:    ['#ff0000', '#ff3333', '#ff6666', '#ff1493'],
  star:     ['#ffe792', '#efc900', '#ffd700', '#fff8dc'],
  fire:     ['#ff4500', '#ff6347', '#ffa500', '#ff8c00', '#ff0000'],
  diamond:  ['#00eefc', '#00deec', '#87ceeb', '#add8e6', '#ffffff'],
  crown:    ['#ffd700', '#ffe792', '#efc900', '#daa520', '#ffffff'],
  rocket:   ['#ff4500', '#ff6347', '#ffa500', '#ffff00', '#ffffff'],
  castle:   ['#d394ff', '#aa30fa', '#9400d3', '#8a2be2', '#ffffff'],
  lion:     ['#ffd700', '#ffe792', '#ff8c00', '#ff4500', '#ffffff'],
  universe: ['#d394ff', '#00eefc', '#ffe792', '#ff6e84', '#ffffff', '#aa30fa', '#00deec'],
};

// ---------------------------------------------------------------------------
// Helper: center coordinates
// ---------------------------------------------------------------------------
function cx(screenWidth) { return screenWidth / 2; }
function cy(screenHeight) { return screenHeight / 2; }

// ============================= TIER 1 =====================================
// Rose (1 coin) - Simple scale-up, tiny pink burst, fade out. 1.5s
// ==========================================================================
export function createRoseAnimation(screenWidth, screenHeight, senderName) {
  const midX = cx(screenWidth);
  const midY = cy(screenHeight);

  return {
    timeline: [
      {
        time: 0,
        type: 'icon',
        config: {
          emoji: '\uD83C\uDF39',
          x: midX,
          y: midY,
          scale: 0,
          duration: 600,
          rotation: 0,
        },
      },
      {
        time: 0,
        type: 'icon',
        config: {
          emoji: '\uD83C\uDF39',
          x: midX,
          y: midY,
          scale: 1.2,
          duration: 600,
          rotation: 15,
        },
      },
      {
        time: 300,
        type: 'particles',
        config: {
          mode: 'burst',
          count: 12,
          origin: { x: 0.5, y: 0.5 },
          spread: { x: 40, y: 40 },
          velocity: { min: 60, max: 140 },
          angle: { min: 0, max: 360 },
          size: { min: 3, max: 6 },
          lifetime: { min: 600, max: 900 },
          gravity: 30,
          colors: COLORS.rose,
          shapes: ['circle'],
          glow: false,
          glowIntensity: 0,
          blendMode: 'normal',
          delay: 0,
        },
      },
      {
        time: 900,
        type: 'icon',
        config: {
          emoji: '\uD83C\uDF39',
          x: midX,
          y: midY,
          scale: 0,
          duration: 600,
          rotation: 30,
        },
      },
      {
        time: 900,
        type: 'text',
        config: {
          text: senderName,
          x: midX,
          y: midY + 60,
          fontSize: 14,
          color: '#ff69b4',
          duration: 600,
          glow: false,
        },
      },
    ],
    particles: [
      {
        mode: 'burst',
        count: 12,
        origin: { x: 0.5, y: 0.5 },
        spread: { x: 40, y: 40 },
        velocity: { min: 60, max: 140 },
        angle: { min: 0, max: 360 },
        size: { min: 3, max: 6 },
        lifetime: { min: 600, max: 900 },
        gravity: 30,
        colors: COLORS.rose,
        shapes: ['circle'],
        glow: false,
        glowIntensity: 0,
        blendMode: 'normal',
        delay: 300,
      },
    ],
    duration: 1500,
    tier: 1,
    fullScreen: false,
  };
}

// ============================= TIER 2 =====================================
// Heart (5 coins) - Bounce in, red heart particles float up. 2s
// ==========================================================================
export function createHeartAnimation(screenWidth, screenHeight, senderName) {
  const midX = cx(screenWidth);
  const midY = cy(screenHeight);

  return {
    timeline: [
      // Bounce in: overshoot then settle
      {
        time: 0,
        type: 'icon',
        config: {
          emoji: '\u2764\uFE0F',
          x: midX,
          y: midY + 80,
          scale: 0,
          duration: 300,
          rotation: 0,
        },
      },
      {
        time: 300,
        type: 'icon',
        config: {
          emoji: '\u2764\uFE0F',
          x: midX,
          y: midY - 20,
          scale: 1.4,
          duration: 200,
          rotation: -10,
        },
      },
      {
        time: 500,
        type: 'icon',
        config: {
          emoji: '\u2764\uFE0F',
          x: midX,
          y: midY,
          scale: 1.0,
          duration: 200,
          rotation: 0,
        },
      },
      // Heart particles float upward
      {
        time: 400,
        type: 'particles',
        config: {
          mode: 'stream',
          count: 18,
          origin: { x: 0.5, y: 0.55 },
          spread: { x: 60, y: 20 },
          velocity: { min: 40, max: 100 },
          angle: { min: 250, max: 290 },
          size: { min: 4, max: 8 },
          lifetime: { min: 800, max: 1200 },
          gravity: -15,
          colors: COLORS.heart,
          shapes: ['heart'],
          glow: false,
          glowIntensity: 0,
          blendMode: 'normal',
          delay: 0,
        },
      },
      // Sender name
      {
        time: 600,
        type: 'text',
        config: {
          text: senderName,
          x: midX,
          y: midY + 60,
          fontSize: 14,
          color: '#ff3333',
          duration: 800,
          glow: false,
        },
      },
      // Fade out
      {
        time: 1400,
        type: 'icon',
        config: {
          emoji: '\u2764\uFE0F',
          x: midX,
          y: midY - 30,
          scale: 0,
          duration: 600,
          rotation: 10,
        },
      },
    ],
    particles: [
      {
        mode: 'stream',
        count: 18,
        origin: { x: 0.5, y: 0.55 },
        spread: { x: 60, y: 20 },
        velocity: { min: 40, max: 100 },
        angle: { min: 250, max: 290 },
        size: { min: 4, max: 8 },
        lifetime: { min: 800, max: 1200 },
        gravity: -15,
        colors: COLORS.heart,
        shapes: ['heart'],
        glow: false,
        glowIntensity: 0,
        blendMode: 'normal',
        delay: 400,
      },
    ],
    duration: 2000,
    tier: 2,
    fullScreen: false,
  };
}

// ============================= TIER 3 =====================================
// Star (10 coins) - Spin in, yellow star particles burst outward. 2s
// ==========================================================================
export function createStarAnimation(screenWidth, screenHeight, senderName) {
  const midX = cx(screenWidth);
  const midY = cy(screenHeight);

  return {
    timeline: [
      // Spin in from zero scale
      {
        time: 0,
        type: 'icon',
        config: {
          emoji: '\u2B50',
          x: midX,
          y: midY,
          scale: 0,
          duration: 500,
          rotation: 0,
        },
      },
      {
        time: 500,
        type: 'icon',
        config: {
          emoji: '\u2B50',
          x: midX,
          y: midY,
          scale: 1.3,
          duration: 300,
          rotation: 720,
        },
      },
      // Star particle burst on arrival
      {
        time: 500,
        type: 'particles',
        config: {
          mode: 'burst',
          count: 24,
          origin: { x: 0.5, y: 0.5 },
          spread: { x: 20, y: 20 },
          velocity: { min: 100, max: 250 },
          angle: { min: 0, max: 360 },
          size: { min: 4, max: 10 },
          lifetime: { min: 600, max: 1000 },
          gravity: 20,
          colors: COLORS.star,
          shapes: ['star'],
          glow: true,
          glowIntensity: 0.4,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Subtle glow
      {
        time: 500,
        type: 'glow',
        config: {
          color: '#ffd700',
          x: midX,
          y: midY,
          size: 80,
          intensity: 0.5,
          duration: 800,
        },
      },
      // Sender name
      {
        time: 700,
        type: 'text',
        config: {
          text: senderName,
          x: midX,
          y: midY + 65,
          fontSize: 16,
          color: '#ffd700',
          duration: 800,
          glow: false,
        },
      },
      // Fade out
      {
        time: 1400,
        type: 'icon',
        config: {
          emoji: '\u2B50',
          x: midX,
          y: midY,
          scale: 0,
          duration: 600,
          rotation: 1080,
        },
      },
    ],
    particles: [
      {
        mode: 'burst',
        count: 24,
        origin: { x: 0.5, y: 0.5 },
        spread: { x: 20, y: 20 },
        velocity: { min: 100, max: 250 },
        angle: { min: 0, max: 360 },
        size: { min: 4, max: 10 },
        lifetime: { min: 600, max: 1000 },
        gravity: 20,
        colors: COLORS.star,
        shapes: ['star'],
        glow: true,
        glowIntensity: 0.4,
        blendMode: 'screen',
        delay: 500,
      },
    ],
    duration: 2000,
    tier: 3,
    fullScreen: true,
  };
}

// ============================= TIER 4 =====================================
// Fire (25 coins) - Orange glow, fire particles stream up. 2.5s
// ==========================================================================
export function createFireAnimation(screenWidth, screenHeight, senderName) {
  const midX = cx(screenWidth);
  const midY = cy(screenHeight);

  return {
    timeline: [
      // Icon appears with growing glow
      {
        time: 0,
        type: 'icon',
        config: {
          emoji: '\uD83D\uDD25',
          x: midX,
          y: midY,
          scale: 0.3,
          duration: 400,
          rotation: 0,
        },
      },
      {
        time: 0,
        type: 'glow',
        config: {
          color: '#ff6347',
          x: midX,
          y: midY,
          size: 40,
          intensity: 0.3,
          duration: 500,
        },
      },
      {
        time: 400,
        type: 'icon',
        config: {
          emoji: '\uD83D\uDD25',
          x: midX,
          y: midY,
          scale: 1.3,
          duration: 300,
          rotation: -5,
        },
      },
      {
        time: 400,
        type: 'glow',
        config: {
          color: '#ff4500',
          x: midX,
          y: midY,
          size: 120,
          intensity: 0.7,
          duration: 1200,
        },
      },
      // Fire particles streaming upward
      {
        time: 300,
        type: 'particles',
        config: {
          mode: 'stream',
          count: 40,
          origin: { x: 0.5, y: 0.55 },
          spread: { x: 30, y: 10 },
          velocity: { min: 80, max: 200 },
          angle: { min: 255, max: 285 },
          size: { min: 3, max: 9 },
          lifetime: { min: 500, max: 1000 },
          gravity: -40,
          colors: COLORS.fire,
          shapes: ['circle', 'triangle'],
          glow: true,
          glowIntensity: 0.6,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Secondary ember burst
      {
        time: 800,
        type: 'particles',
        config: {
          mode: 'burst',
          count: 16,
          origin: { x: 0.5, y: 0.45 },
          spread: { x: 50, y: 30 },
          velocity: { min: 40, max: 120 },
          angle: { min: 230, max: 310 },
          size: { min: 2, max: 5 },
          lifetime: { min: 400, max: 800 },
          gravity: -20,
          colors: ['#ffff00', '#ffa500', '#ff4500'],
          shapes: ['circle'],
          glow: true,
          glowIntensity: 0.8,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Sender name
      {
        time: 800,
        type: 'text',
        config: {
          text: senderName,
          x: midX,
          y: midY + 70,
          fontSize: 16,
          color: '#ff6347',
          duration: 1000,
          glow: true,
        },
      },
      // Fade
      {
        time: 1800,
        type: 'icon',
        config: {
          emoji: '\uD83D\uDD25',
          x: midX,
          y: midY - 20,
          scale: 0,
          duration: 700,
          rotation: 10,
        },
      },
    ],
    particles: [
      {
        mode: 'stream',
        count: 40,
        origin: { x: 0.5, y: 0.55 },
        spread: { x: 30, y: 10 },
        velocity: { min: 80, max: 200 },
        angle: { min: 255, max: 285 },
        size: { min: 3, max: 9 },
        lifetime: { min: 500, max: 1000 },
        gravity: -40,
        colors: COLORS.fire,
        shapes: ['circle', 'triangle'],
        glow: true,
        glowIntensity: 0.6,
        blendMode: 'screen',
        delay: 300,
      },
      {
        mode: 'burst',
        count: 16,
        origin: { x: 0.5, y: 0.45 },
        spread: { x: 50, y: 30 },
        velocity: { min: 40, max: 120 },
        angle: { min: 230, max: 310 },
        size: { min: 2, max: 5 },
        lifetime: { min: 400, max: 800 },
        gravity: -20,
        colors: ['#ffff00', '#ffa500', '#ff4500'],
        shapes: ['circle'],
        glow: true,
        glowIntensity: 0.8,
        blendMode: 'screen',
        delay: 800,
      },
    ],
    duration: 2500,
    tier: 4,
    fullScreen: true,
  };
}

// ============================= TIER 5 =====================================
// Diamond (50 coins) - Cyan glow pulse, diamond sparkle particles. 2.5s
// ==========================================================================
export function createDiamondAnimation(screenWidth, screenHeight, senderName) {
  const midX = cx(screenWidth);
  const midY = cy(screenHeight);

  return {
    timeline: [
      // Glow builds before icon appears
      {
        time: 0,
        type: 'glow',
        config: {
          color: '#00eefc',
          x: midX,
          y: midY,
          size: 20,
          intensity: 0.2,
          duration: 400,
        },
      },
      {
        time: 200,
        type: 'icon',
        config: {
          emoji: '\uD83D\uDC8E',
          x: midX,
          y: midY,
          scale: 0,
          duration: 400,
          rotation: 0,
        },
      },
      // Icon fully visible with pulsing glow
      {
        time: 600,
        type: 'icon',
        config: {
          emoji: '\uD83D\uDC8E',
          x: midX,
          y: midY,
          scale: 1.4,
          duration: 300,
          rotation: 15,
        },
      },
      {
        time: 400,
        type: 'glow',
        config: {
          color: '#00deec',
          x: midX,
          y: midY,
          size: 140,
          intensity: 0.8,
          duration: 600,
        },
      },
      // Glow pulse 2
      {
        time: 1000,
        type: 'glow',
        config: {
          color: '#87ceeb',
          x: midX,
          y: midY,
          size: 100,
          intensity: 0.5,
          duration: 500,
        },
      },
      // Diamond sparkle particles
      {
        time: 500,
        type: 'particles',
        config: {
          mode: 'burst',
          count: 30,
          origin: { x: 0.5, y: 0.5 },
          spread: { x: 30, y: 30 },
          velocity: { min: 60, max: 200 },
          angle: { min: 0, max: 360 },
          size: { min: 3, max: 8 },
          lifetime: { min: 600, max: 1200 },
          gravity: 10,
          colors: COLORS.diamond,
          shapes: ['diamond', 'circle'],
          glow: true,
          glowIntensity: 0.7,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Secondary twinkle burst
      {
        time: 1000,
        type: 'particles',
        config: {
          mode: 'burst',
          count: 15,
          origin: { x: 0.5, y: 0.5 },
          spread: { x: 80, y: 80 },
          velocity: { min: 20, max: 80 },
          angle: { min: 0, max: 360 },
          size: { min: 2, max: 5 },
          lifetime: { min: 400, max: 800 },
          gravity: 5,
          colors: ['#ffffff', '#add8e6', '#00eefc'],
          shapes: ['diamond'],
          glow: true,
          glowIntensity: 1.0,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Sender name
      {
        time: 800,
        type: 'text',
        config: {
          text: senderName,
          x: midX,
          y: midY + 70,
          fontSize: 16,
          color: '#00eefc',
          duration: 1000,
          glow: true,
        },
      },
      // Fade out
      {
        time: 1800,
        type: 'icon',
        config: {
          emoji: '\uD83D\uDC8E',
          x: midX,
          y: midY,
          scale: 0,
          duration: 700,
          rotation: -15,
        },
      },
    ],
    particles: [
      {
        mode: 'burst',
        count: 30,
        origin: { x: 0.5, y: 0.5 },
        spread: { x: 30, y: 30 },
        velocity: { min: 60, max: 200 },
        angle: { min: 0, max: 360 },
        size: { min: 3, max: 8 },
        lifetime: { min: 600, max: 1200 },
        gravity: 10,
        colors: COLORS.diamond,
        shapes: ['diamond', 'circle'],
        glow: true,
        glowIntensity: 0.7,
        blendMode: 'screen',
        delay: 500,
      },
      {
        mode: 'burst',
        count: 15,
        origin: { x: 0.5, y: 0.5 },
        spread: { x: 80, y: 80 },
        velocity: { min: 20, max: 80 },
        angle: { min: 0, max: 360 },
        size: { min: 2, max: 5 },
        lifetime: { min: 400, max: 800 },
        gravity: 5,
        colors: ['#ffffff', '#add8e6', '#00eefc'],
        shapes: ['diamond'],
        glow: true,
        glowIntensity: 1.0,
        blendMode: 'screen',
        delay: 1000,
      },
    ],
    duration: 2500,
    tier: 5,
    fullScreen: true,
  };
}

// ============================= TIER 6 =====================================
// Crown (100 coins) - Drops from top, gold trail, crown glow. 3s
// ==========================================================================
export function createCrownAnimation(screenWidth, screenHeight, senderName) {
  const midX = cx(screenWidth);
  const midY = cy(screenHeight);

  return {
    timeline: [
      // Crown drops from top
      {
        time: 0,
        type: 'icon',
        config: {
          emoji: '\uD83D\uDC51',
          x: midX,
          y: -40,
          scale: 1.0,
          duration: 600,
          rotation: -20,
        },
      },
      // Gold trail as crown descends
      {
        time: 0,
        type: 'particles',
        config: {
          mode: 'trail',
          count: 30,
          origin: { x: 0.5, y: 0.0 },
          spread: { x: 15, y: 10 },
          velocity: { min: 20, max: 60 },
          angle: { min: 80, max: 100 },
          size: { min: 3, max: 7 },
          lifetime: { min: 400, max: 800 },
          gravity: 30,
          colors: COLORS.crown,
          shapes: ['circle', 'star'],
          glow: true,
          glowIntensity: 0.6,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Crown lands at center
      {
        time: 600,
        type: 'icon',
        config: {
          emoji: '\uD83D\uDC51',
          x: midX,
          y: midY,
          scale: 1.5,
          duration: 200,
          rotation: 0,
        },
      },
      // Impact glow
      {
        time: 600,
        type: 'glow',
        config: {
          color: '#ffd700',
          x: midX,
          y: midY,
          size: 160,
          intensity: 0.9,
          duration: 800,
        },
      },
      // Impact burst
      {
        time: 600,
        type: 'particles',
        config: {
          mode: 'burst',
          count: 35,
          origin: { x: 0.5, y: 0.5 },
          spread: { x: 20, y: 20 },
          velocity: { min: 80, max: 220 },
          angle: { min: 0, max: 360 },
          size: { min: 4, max: 10 },
          lifetime: { min: 600, max: 1200 },
          gravity: 25,
          colors: COLORS.crown,
          shapes: ['star', 'circle'],
          glow: true,
          glowIntensity: 0.7,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Settle
      {
        time: 800,
        type: 'icon',
        config: {
          emoji: '\uD83D\uDC51',
          x: midX,
          y: midY,
          scale: 1.2,
          duration: 300,
          rotation: 5,
        },
      },
      // Floating gold dust
      {
        time: 1200,
        type: 'particles',
        config: {
          mode: 'stream',
          count: 20,
          origin: { x: 0.5, y: 0.5 },
          spread: { x: 100, y: 60 },
          velocity: { min: 10, max: 50 },
          angle: { min: 240, max: 300 },
          size: { min: 2, max: 5 },
          lifetime: { min: 500, max: 1000 },
          gravity: -10,
          colors: ['#ffd700', '#ffe792', '#ffffff'],
          shapes: ['circle'],
          glow: true,
          glowIntensity: 0.5,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Sender name with glow
      {
        time: 1000,
        type: 'text',
        config: {
          text: senderName,
          x: midX,
          y: midY + 75,
          fontSize: 18,
          color: '#ffd700',
          duration: 1200,
          glow: true,
        },
      },
      // Fade out
      {
        time: 2200,
        type: 'icon',
        config: {
          emoji: '\uD83D\uDC51',
          x: midX,
          y: midY - 40,
          scale: 0,
          duration: 800,
          rotation: 20,
        },
      },
    ],
    particles: [
      {
        mode: 'trail',
        count: 30,
        origin: { x: 0.5, y: 0.0 },
        spread: { x: 15, y: 10 },
        velocity: { min: 20, max: 60 },
        angle: { min: 80, max: 100 },
        size: { min: 3, max: 7 },
        lifetime: { min: 400, max: 800 },
        gravity: 30,
        colors: COLORS.crown,
        shapes: ['circle', 'star'],
        glow: true,
        glowIntensity: 0.6,
        blendMode: 'screen',
        delay: 0,
      },
      {
        mode: 'burst',
        count: 35,
        origin: { x: 0.5, y: 0.5 },
        spread: { x: 20, y: 20 },
        velocity: { min: 80, max: 220 },
        angle: { min: 0, max: 360 },
        size: { min: 4, max: 10 },
        lifetime: { min: 600, max: 1200 },
        gravity: 25,
        colors: COLORS.crown,
        shapes: ['star', 'circle'],
        glow: true,
        glowIntensity: 0.7,
        blendMode: 'screen',
        delay: 600,
      },
      {
        mode: 'stream',
        count: 20,
        origin: { x: 0.5, y: 0.5 },
        spread: { x: 100, y: 60 },
        velocity: { min: 10, max: 50 },
        angle: { min: 240, max: 300 },
        size: { min: 2, max: 5 },
        lifetime: { min: 500, max: 1000 },
        gravity: -10,
        colors: ['#ffd700', '#ffe792', '#ffffff'],
        shapes: ['circle'],
        glow: true,
        glowIntensity: 0.5,
        blendMode: 'screen',
        delay: 1200,
      },
    ],
    duration: 3000,
    tier: 6,
    fullScreen: true,
  };
}

// ============================= TIER 7 =====================================
// Rocket (200 coins) - EPIC. Flies across screen, trail, flash, debris. 3.5s
// ==========================================================================
export function createRocketAnimation(screenWidth, screenHeight, senderName) {
  const midX = cx(screenWidth);
  const midY = cy(screenHeight);

  return {
    timeline: [
      // Rocket enters from bottom-left
      {
        time: 0,
        type: 'icon',
        config: {
          emoji: '\uD83D\uDE80',
          x: 0,
          y: screenHeight,
          scale: 1.2,
          duration: 800,
          rotation: -45,
        },
      },
      // Exhaust trail
      {
        time: 0,
        type: 'particles',
        config: {
          mode: 'trail',
          count: 60,
          origin: { x: 0.0, y: 1.0 },
          spread: { x: 10, y: 10 },
          velocity: { min: 30, max: 100 },
          angle: { min: 110, max: 160 },
          size: { min: 3, max: 8 },
          lifetime: { min: 300, max: 700 },
          gravity: 15,
          colors: COLORS.rocket,
          shapes: ['circle'],
          glow: true,
          glowIntensity: 0.8,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Rocket reaches center
      {
        time: 800,
        type: 'icon',
        config: {
          emoji: '\uD83D\uDE80',
          x: midX,
          y: midY,
          scale: 1.6,
          duration: 200,
          rotation: -45,
        },
      },
      // IMPACT: screen flash
      {
        time: 1000,
        type: 'flash',
        config: {
          color: '#ffffff',
          opacity: 0.9,
          duration: 300,
        },
      },
      // Screen shake on impact
      {
        time: 1000,
        type: 'shake',
        config: {
          intensity: 12,
          duration: 500,
        },
      },
      // Explosion glow
      {
        time: 1000,
        type: 'glow',
        config: {
          color: '#ff4500',
          x: midX,
          y: midY,
          size: 200,
          intensity: 1.0,
          duration: 800,
        },
      },
      // Debris burst - wave 1
      {
        time: 1000,
        type: 'particles',
        config: {
          mode: 'burst',
          count: 50,
          origin: { x: 0.5, y: 0.5 },
          spread: { x: 20, y: 20 },
          velocity: { min: 150, max: 400 },
          angle: { min: 0, max: 360 },
          size: { min: 4, max: 12 },
          lifetime: { min: 600, max: 1400 },
          gravity: 40,
          colors: COLORS.rocket,
          shapes: ['circle', 'triangle', 'star'],
          glow: true,
          glowIntensity: 0.9,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Debris burst - wave 2 (slower, outward drift)
      {
        time: 1300,
        type: 'particles',
        config: {
          mode: 'burst',
          count: 30,
          origin: { x: 0.5, y: 0.5 },
          spread: { x: 60, y: 60 },
          velocity: { min: 40, max: 120 },
          angle: { min: 0, max: 360 },
          size: { min: 2, max: 6 },
          lifetime: { min: 500, max: 1000 },
          gravity: 20,
          colors: ['#ff6347', '#ffa500', '#ffff00'],
          shapes: ['circle'],
          glow: true,
          glowIntensity: 0.5,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Sender name after explosion settles
      {
        time: 1500,
        type: 'text',
        config: {
          text: senderName,
          x: midX,
          y: midY + 80,
          fontSize: 20,
          color: '#ff6347',
          duration: 1200,
          glow: true,
        },
      },
      // Smoke particles lingering
      {
        time: 1600,
        type: 'particles',
        config: {
          mode: 'stream',
          count: 20,
          origin: { x: 0.5, y: 0.5 },
          spread: { x: 80, y: 60 },
          velocity: { min: 5, max: 30 },
          angle: { min: 250, max: 290 },
          size: { min: 6, max: 14 },
          lifetime: { min: 600, max: 1200 },
          gravity: -5,
          colors: ['#888888', '#aaaaaa', '#cccccc'],
          shapes: ['circle'],
          glow: false,
          glowIntensity: 0,
          blendMode: 'normal',
          delay: 0,
        },
      },
    ],
    particles: [
      {
        mode: 'trail',
        count: 60,
        origin: { x: 0.0, y: 1.0 },
        spread: { x: 10, y: 10 },
        velocity: { min: 30, max: 100 },
        angle: { min: 110, max: 160 },
        size: { min: 3, max: 8 },
        lifetime: { min: 300, max: 700 },
        gravity: 15,
        colors: COLORS.rocket,
        shapes: ['circle'],
        glow: true,
        glowIntensity: 0.8,
        blendMode: 'screen',
        delay: 0,
      },
      {
        mode: 'burst',
        count: 50,
        origin: { x: 0.5, y: 0.5 },
        spread: { x: 20, y: 20 },
        velocity: { min: 150, max: 400 },
        angle: { min: 0, max: 360 },
        size: { min: 4, max: 12 },
        lifetime: { min: 600, max: 1400 },
        gravity: 40,
        colors: COLORS.rocket,
        shapes: ['circle', 'triangle', 'star'],
        glow: true,
        glowIntensity: 0.9,
        blendMode: 'screen',
        delay: 1000,
      },
      {
        mode: 'burst',
        count: 30,
        origin: { x: 0.5, y: 0.5 },
        spread: { x: 60, y: 60 },
        velocity: { min: 40, max: 120 },
        angle: { min: 0, max: 360 },
        size: { min: 2, max: 6 },
        lifetime: { min: 500, max: 1000 },
        gravity: 20,
        colors: ['#ff6347', '#ffa500', '#ffff00'],
        shapes: ['circle'],
        glow: true,
        glowIntensity: 0.5,
        blendMode: 'screen',
        delay: 1300,
      },
      {
        mode: 'stream',
        count: 20,
        origin: { x: 0.5, y: 0.5 },
        spread: { x: 80, y: 60 },
        velocity: { min: 5, max: 30 },
        angle: { min: 250, max: 290 },
        size: { min: 6, max: 14 },
        lifetime: { min: 600, max: 1200 },
        gravity: -5,
        colors: ['#888888', '#aaaaaa', '#cccccc'],
        shapes: ['circle'],
        glow: false,
        glowIntensity: 0,
        blendMode: 'normal',
        delay: 1600,
      },
    ],
    duration: 3500,
    tier: 7,
    fullScreen: true,
  };
}

// ============================= TIER 8 =====================================
// Castle (500 coins) - EPIC. Materializes with purple build-up, magic
// particle streams, screen shake. 4s
// ==========================================================================
export function createCastleAnimation(screenWidth, screenHeight, senderName) {
  const midX = cx(screenWidth);
  const midY = cy(screenHeight);

  return {
    timeline: [
      // Purple glow builds from nothing
      {
        time: 0,
        type: 'glow',
        config: {
          color: '#9400d3',
          x: midX,
          y: midY,
          size: 30,
          intensity: 0.2,
          duration: 600,
        },
      },
      // Magic particle streams converging to center
      {
        time: 0,
        type: 'particles',
        config: {
          mode: 'stream',
          count: 40,
          origin: { x: 0.0, y: 0.0 },
          spread: { x: 20, y: 20 },
          velocity: { min: 100, max: 200 },
          angle: { min: 130, max: 140 },
          size: { min: 3, max: 7 },
          lifetime: { min: 600, max: 1000 },
          gravity: 0,
          colors: COLORS.castle,
          shapes: ['circle', 'diamond'],
          glow: true,
          glowIntensity: 0.6,
          blendMode: 'screen',
          delay: 0,
        },
      },
      {
        time: 100,
        type: 'particles',
        config: {
          mode: 'stream',
          count: 40,
          origin: { x: 1.0, y: 0.0 },
          spread: { x: 20, y: 20 },
          velocity: { min: 100, max: 200 },
          angle: { min: 220, max: 230 },
          size: { min: 3, max: 7 },
          lifetime: { min: 600, max: 1000 },
          gravity: 0,
          colors: COLORS.castle,
          shapes: ['circle', 'diamond'],
          glow: true,
          glowIntensity: 0.6,
          blendMode: 'screen',
          delay: 0,
        },
      },
      {
        time: 200,
        type: 'particles',
        config: {
          mode: 'stream',
          count: 30,
          origin: { x: 0.5, y: 1.0 },
          spread: { x: 40, y: 10 },
          velocity: { min: 100, max: 200 },
          angle: { min: 265, max: 275 },
          size: { min: 3, max: 7 },
          lifetime: { min: 600, max: 1000 },
          gravity: 0,
          colors: COLORS.castle,
          shapes: ['circle', 'star'],
          glow: true,
          glowIntensity: 0.6,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Glow intensifies
      {
        time: 600,
        type: 'glow',
        config: {
          color: '#aa30fa',
          x: midX,
          y: midY,
          size: 180,
          intensity: 0.9,
          duration: 800,
        },
      },
      // Flash as castle materializes
      {
        time: 1000,
        type: 'flash',
        config: {
          color: '#d394ff',
          opacity: 0.7,
          duration: 250,
        },
      },
      // Castle appears
      {
        time: 1000,
        type: 'icon',
        config: {
          emoji: '\uD83C\uDFF0',
          x: midX,
          y: midY,
          scale: 0,
          duration: 400,
          rotation: 0,
        },
      },
      {
        time: 1400,
        type: 'icon',
        config: {
          emoji: '\uD83C\uDFF0',
          x: midX,
          y: midY,
          scale: 1.8,
          duration: 300,
          rotation: 0,
        },
      },
      // Screen shake on materialization
      {
        time: 1200,
        type: 'shake',
        config: {
          intensity: 10,
          duration: 600,
        },
      },
      // Magic aura particles
      {
        time: 1400,
        type: 'particles',
        config: {
          mode: 'burst',
          count: 45,
          origin: { x: 0.5, y: 0.5 },
          spread: { x: 30, y: 30 },
          velocity: { min: 80, max: 250 },
          angle: { min: 0, max: 360 },
          size: { min: 4, max: 10 },
          lifetime: { min: 700, max: 1400 },
          gravity: 15,
          colors: COLORS.castle,
          shapes: ['star', 'diamond', 'circle'],
          glow: true,
          glowIntensity: 0.8,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Floating magic dust
      {
        time: 2000,
        type: 'particles',
        config: {
          mode: 'stream',
          count: 25,
          origin: { x: 0.5, y: 0.5 },
          spread: { x: 120, y: 80 },
          velocity: { min: 10, max: 40 },
          angle: { min: 0, max: 360 },
          size: { min: 2, max: 5 },
          lifetime: { min: 600, max: 1000 },
          gravity: -8,
          colors: ['#d394ff', '#ffffff', '#aa30fa'],
          shapes: ['circle', 'diamond'],
          glow: true,
          glowIntensity: 0.6,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Sender name with glow
      {
        time: 1800,
        type: 'text',
        config: {
          text: senderName,
          x: midX,
          y: midY + 90,
          fontSize: 20,
          color: '#d394ff',
          duration: 1400,
          glow: true,
        },
      },
      // Persistent glow behind castle
      {
        time: 1400,
        type: 'glow',
        config: {
          color: '#8a2be2',
          x: midX,
          y: midY,
          size: 150,
          intensity: 0.6,
          duration: 1600,
        },
      },
      // Fade out
      {
        time: 3200,
        type: 'icon',
        config: {
          emoji: '\uD83C\uDFF0',
          x: midX,
          y: midY,
          scale: 0,
          duration: 800,
          rotation: 0,
        },
      },
    ],
    particles: [
      {
        mode: 'stream',
        count: 40,
        origin: { x: 0.0, y: 0.0 },
        spread: { x: 20, y: 20 },
        velocity: { min: 100, max: 200 },
        angle: { min: 130, max: 140 },
        size: { min: 3, max: 7 },
        lifetime: { min: 600, max: 1000 },
        gravity: 0,
        colors: COLORS.castle,
        shapes: ['circle', 'diamond'],
        glow: true,
        glowIntensity: 0.6,
        blendMode: 'screen',
        delay: 0,
      },
      {
        mode: 'stream',
        count: 40,
        origin: { x: 1.0, y: 0.0 },
        spread: { x: 20, y: 20 },
        velocity: { min: 100, max: 200 },
        angle: { min: 220, max: 230 },
        size: { min: 3, max: 7 },
        lifetime: { min: 600, max: 1000 },
        gravity: 0,
        colors: COLORS.castle,
        shapes: ['circle', 'diamond'],
        glow: true,
        glowIntensity: 0.6,
        blendMode: 'screen',
        delay: 100,
      },
      {
        mode: 'stream',
        count: 30,
        origin: { x: 0.5, y: 1.0 },
        spread: { x: 40, y: 10 },
        velocity: { min: 100, max: 200 },
        angle: { min: 265, max: 275 },
        size: { min: 3, max: 7 },
        lifetime: { min: 600, max: 1000 },
        gravity: 0,
        colors: COLORS.castle,
        shapes: ['circle', 'star'],
        glow: true,
        glowIntensity: 0.6,
        blendMode: 'screen',
        delay: 200,
      },
      {
        mode: 'burst',
        count: 45,
        origin: { x: 0.5, y: 0.5 },
        spread: { x: 30, y: 30 },
        velocity: { min: 80, max: 250 },
        angle: { min: 0, max: 360 },
        size: { min: 4, max: 10 },
        lifetime: { min: 700, max: 1400 },
        gravity: 15,
        colors: COLORS.castle,
        shapes: ['star', 'diamond', 'circle'],
        glow: true,
        glowIntensity: 0.8,
        blendMode: 'screen',
        delay: 1400,
      },
      {
        mode: 'stream',
        count: 25,
        origin: { x: 0.5, y: 0.5 },
        spread: { x: 120, y: 80 },
        velocity: { min: 10, max: 40 },
        angle: { min: 0, max: 360 },
        size: { min: 2, max: 5 },
        lifetime: { min: 600, max: 1000 },
        gravity: -8,
        colors: ['#d394ff', '#ffffff', '#aa30fa'],
        shapes: ['circle', 'diamond'],
        glow: true,
        glowIntensity: 0.6,
        blendMode: 'screen',
        delay: 2000,
      },
    ],
    duration: 4000,
    tier: 8,
    fullScreen: true,
  };
}

// ============================= TIER 9 =====================================
// Lion (1000 coins) - LEGENDARY. Full-screen takeover. Massive particle
// explosion, screen shake, golden glow, "LEGENDARY" text. 5s
// ==========================================================================
export function createLionAnimation(screenWidth, screenHeight, senderName) {
  const midX = cx(screenWidth);
  const midY = cy(screenHeight);

  return {
    timeline: [
      // Stage 1: Ominous golden glow builds (0-800ms)
      {
        time: 0,
        type: 'glow',
        config: {
          color: '#ffd700',
          x: midX,
          y: midY,
          size: 40,
          intensity: 0.3,
          duration: 800,
        },
      },
      {
        time: 400,
        type: 'glow',
        config: {
          color: '#ff8c00',
          x: midX,
          y: midY,
          size: 100,
          intensity: 0.5,
          duration: 600,
        },
      },
      // Pre-burst energy particles swirling in
      {
        time: 200,
        type: 'particles',
        config: {
          mode: 'stream',
          count: 30,
          origin: { x: 0.5, y: 0.5 },
          spread: { x: 200, y: 200 },
          velocity: { min: 60, max: 150 },
          angle: { min: 0, max: 360 },
          size: { min: 2, max: 5 },
          lifetime: { min: 400, max: 700 },
          gravity: 0,
          colors: ['#ffd700', '#ffe792'],
          shapes: ['circle'],
          glow: true,
          glowIntensity: 0.7,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Stage 2: EXPLOSION (800ms) - screen flash, shake
      {
        time: 800,
        type: 'flash',
        config: {
          color: '#ffd700',
          opacity: 1.0,
          duration: 400,
        },
      },
      {
        time: 800,
        type: 'shake',
        config: {
          intensity: 18,
          duration: 800,
        },
      },
      // Massive glow
      {
        time: 800,
        type: 'glow',
        config: {
          color: '#ffd700',
          x: midX,
          y: midY,
          size: 300,
          intensity: 1.0,
          duration: 1200,
        },
      },
      // Lion bursts in
      {
        time: 800,
        type: 'icon',
        config: {
          emoji: '\uD83E\uDD81',
          x: midX,
          y: midY,
          scale: 0,
          duration: 400,
          rotation: 0,
        },
      },
      {
        time: 1200,
        type: 'icon',
        config: {
          emoji: '\uD83E\uDD81',
          x: midX,
          y: midY,
          scale: 2.2,
          duration: 300,
          rotation: -5,
        },
      },
      // Massive particle explosion wave 1 - fast outward
      {
        time: 800,
        type: 'particles',
        config: {
          mode: 'burst',
          count: 80,
          origin: { x: 0.5, y: 0.5 },
          spread: { x: 15, y: 15 },
          velocity: { min: 200, max: 500 },
          angle: { min: 0, max: 360 },
          size: { min: 5, max: 14 },
          lifetime: { min: 800, max: 1600 },
          gravity: 30,
          colors: COLORS.lion,
          shapes: ['star', 'circle', 'triangle'],
          glow: true,
          glowIntensity: 1.0,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Wave 2 - medium speed
      {
        time: 1100,
        type: 'particles',
        config: {
          mode: 'burst',
          count: 50,
          origin: { x: 0.5, y: 0.5 },
          spread: { x: 40, y: 40 },
          velocity: { min: 100, max: 300 },
          angle: { min: 0, max: 360 },
          size: { min: 4, max: 10 },
          lifetime: { min: 700, max: 1300 },
          gravity: 25,
          colors: COLORS.lion,
          shapes: ['star', 'circle'],
          glow: true,
          glowIntensity: 0.8,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Wave 3 - slow sparkle
      {
        time: 1500,
        type: 'particles',
        config: {
          mode: 'burst',
          count: 35,
          origin: { x: 0.5, y: 0.5 },
          spread: { x: 80, y: 80 },
          velocity: { min: 30, max: 120 },
          angle: { min: 0, max: 360 },
          size: { min: 3, max: 7 },
          lifetime: { min: 600, max: 1200 },
          gravity: 15,
          colors: ['#ffd700', '#ffffff', '#ffe792'],
          shapes: ['star', 'diamond'],
          glow: true,
          glowIntensity: 0.9,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Stage 3: Settle, icon stable, second shake
      {
        time: 1500,
        type: 'icon',
        config: {
          emoji: '\uD83E\uDD81',
          x: midX,
          y: midY,
          scale: 1.8,
          duration: 400,
          rotation: 0,
        },
      },
      {
        time: 1800,
        type: 'shake',
        config: {
          intensity: 8,
          duration: 400,
        },
      },
      // "LEGENDARY" text reveal
      {
        time: 1800,
        type: 'text',
        config: {
          text: 'LEGENDARY',
          x: midX,
          y: midY - 100,
          fontSize: 36,
          color: '#ffd700',
          duration: 2000,
          glow: true,
        },
      },
      // Sender name
      {
        time: 2200,
        type: 'text',
        config: {
          text: senderName,
          x: midX,
          y: midY + 100,
          fontSize: 22,
          color: '#ffe792',
          duration: 1800,
          glow: true,
        },
      },
      // Persistent golden glow
      {
        time: 2000,
        type: 'glow',
        config: {
          color: '#ffd700',
          x: midX,
          y: midY,
          size: 200,
          intensity: 0.6,
          duration: 2000,
        },
      },
      // Floating gold embers
      {
        time: 2400,
        type: 'particles',
        config: {
          mode: 'stream',
          count: 30,
          origin: { x: 0.5, y: 0.7 },
          spread: { x: 160, y: 40 },
          velocity: { min: 10, max: 50 },
          angle: { min: 250, max: 290 },
          size: { min: 2, max: 6 },
          lifetime: { min: 600, max: 1200 },
          gravity: -10,
          colors: ['#ffd700', '#ffe792', '#ffffff'],
          shapes: ['circle', 'star'],
          glow: true,
          glowIntensity: 0.6,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Fade out
      {
        time: 4000,
        type: 'icon',
        config: {
          emoji: '\uD83E\uDD81',
          x: midX,
          y: midY,
          scale: 0,
          duration: 1000,
          rotation: 10,
        },
      },
    ],
    particles: [
      {
        mode: 'stream',
        count: 30,
        origin: { x: 0.5, y: 0.5 },
        spread: { x: 200, y: 200 },
        velocity: { min: 60, max: 150 },
        angle: { min: 0, max: 360 },
        size: { min: 2, max: 5 },
        lifetime: { min: 400, max: 700 },
        gravity: 0,
        colors: ['#ffd700', '#ffe792'],
        shapes: ['circle'],
        glow: true,
        glowIntensity: 0.7,
        blendMode: 'screen',
        delay: 200,
      },
      {
        mode: 'burst',
        count: 80,
        origin: { x: 0.5, y: 0.5 },
        spread: { x: 15, y: 15 },
        velocity: { min: 200, max: 500 },
        angle: { min: 0, max: 360 },
        size: { min: 5, max: 14 },
        lifetime: { min: 800, max: 1600 },
        gravity: 30,
        colors: COLORS.lion,
        shapes: ['star', 'circle', 'triangle'],
        glow: true,
        glowIntensity: 1.0,
        blendMode: 'screen',
        delay: 800,
      },
      {
        mode: 'burst',
        count: 50,
        origin: { x: 0.5, y: 0.5 },
        spread: { x: 40, y: 40 },
        velocity: { min: 100, max: 300 },
        angle: { min: 0, max: 360 },
        size: { min: 4, max: 10 },
        lifetime: { min: 700, max: 1300 },
        gravity: 25,
        colors: COLORS.lion,
        shapes: ['star', 'circle'],
        glow: true,
        glowIntensity: 0.8,
        blendMode: 'screen',
        delay: 1100,
      },
      {
        mode: 'burst',
        count: 35,
        origin: { x: 0.5, y: 0.5 },
        spread: { x: 80, y: 80 },
        velocity: { min: 30, max: 120 },
        angle: { min: 0, max: 360 },
        size: { min: 3, max: 7 },
        lifetime: { min: 600, max: 1200 },
        gravity: 15,
        colors: ['#ffd700', '#ffffff', '#ffe792'],
        shapes: ['star', 'diamond'],
        glow: true,
        glowIntensity: 0.9,
        blendMode: 'screen',
        delay: 1500,
      },
      {
        mode: 'stream',
        count: 30,
        origin: { x: 0.5, y: 0.7 },
        spread: { x: 160, y: 40 },
        velocity: { min: 10, max: 50 },
        angle: { min: 250, max: 290 },
        size: { min: 2, max: 6 },
        lifetime: { min: 600, max: 1200 },
        gravity: -10,
        colors: ['#ffd700', '#ffe792', '#ffffff'],
        shapes: ['circle', 'star'],
        glow: true,
        glowIntensity: 0.6,
        blendMode: 'screen',
        delay: 2400,
      },
    ],
    duration: 5000,
    tier: 9,
    fullScreen: true,
  };
}

// ============================= TIER 10 ====================================
// Universe (5000 coins) - LEGENDARY+. The ultimate animation.
// Galaxy swirl, full-screen color shifts, massive multi-burst particle
// waves, rotating glow, earthquake shake, "UNIVERSE" text with rainbow
// glow. 6s of pure spectacle.
// ==========================================================================
export function createUniverseAnimation(screenWidth, screenHeight, senderName) {
  const midX = cx(screenWidth);
  const midY = cy(screenHeight);

  return {
    timeline: [
      // ============================================================
      // ACT I: The Void Stirs (0 - 1200ms)
      // A single point of light in darkness, drawing particles inward.
      // ============================================================
      {
        time: 0,
        type: 'glow',
        config: {
          color: '#d394ff',
          x: midX,
          y: midY,
          size: 8,
          intensity: 0.4,
          duration: 600,
        },
      },
      // Faint galaxy swirl particles - clockwise spiral inward
      {
        time: 0,
        type: 'particles',
        config: {
          mode: 'stream',
          count: 40,
          origin: { x: 0.5, y: 0.5 },
          spread: { x: 250, y: 250 },
          velocity: { min: 30, max: 80 },
          angle: { min: 0, max: 360 },
          size: { min: 1, max: 4 },
          lifetime: { min: 800, max: 1500 },
          gravity: 0,
          colors: COLORS.universe,
          shapes: ['circle'],
          glow: true,
          glowIntensity: 0.5,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Glow grows
      {
        time: 400,
        type: 'glow',
        config: {
          color: '#aa30fa',
          x: midX,
          y: midY,
          size: 60,
          intensity: 0.5,
          duration: 600,
        },
      },
      // Secondary swirl from edges
      {
        time: 500,
        type: 'particles',
        config: {
          mode: 'stream',
          count: 35,
          origin: { x: 0.0, y: 0.5 },
          spread: { x: 30, y: 150 },
          velocity: { min: 80, max: 160 },
          angle: { min: 340, max: 380 },
          size: { min: 2, max: 5 },
          lifetime: { min: 600, max: 1200 },
          gravity: 0,
          colors: ['#00eefc', '#00deec', '#d394ff'],
          shapes: ['circle', 'star'],
          glow: true,
          glowIntensity: 0.6,
          blendMode: 'screen',
          delay: 0,
        },
      },
      {
        time: 600,
        type: 'particles',
        config: {
          mode: 'stream',
          count: 35,
          origin: { x: 1.0, y: 0.5 },
          spread: { x: 30, y: 150 },
          velocity: { min: 80, max: 160 },
          angle: { min: 160, max: 200 },
          size: { min: 2, max: 5 },
          lifetime: { min: 600, max: 1200 },
          gravity: 0,
          colors: ['#ffe792', '#ff6e84', '#d394ff'],
          shapes: ['circle', 'star'],
          glow: true,
          glowIntensity: 0.6,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Full-screen color shift begins - deep purple
      {
        time: 800,
        type: 'flash',
        config: {
          color: '#1a0033',
          opacity: 0.4,
          duration: 1200,
        },
      },
      // Glow intensifies rapidly
      {
        time: 1000,
        type: 'glow',
        config: {
          color: '#d394ff',
          x: midX,
          y: midY,
          size: 160,
          intensity: 0.8,
          duration: 800,
        },
      },

      // ============================================================
      // ACT II: The Big Bang (1200 - 2500ms)
      // Blinding flash, earthquake, massive multi-wave particle
      // explosions radiating outward.
      // ============================================================
      // Flash 1 - white-hot core
      {
        time: 1200,
        type: 'flash',
        config: {
          color: '#ffffff',
          opacity: 1.0,
          duration: 350,
        },
      },
      // Earthquake shake
      {
        time: 1200,
        type: 'shake',
        config: {
          intensity: 25,
          duration: 1200,
        },
      },
      // Supernova glow
      {
        time: 1200,
        type: 'glow',
        config: {
          color: '#ffffff',
          x: midX,
          y: midY,
          size: 400,
          intensity: 1.0,
          duration: 600,
        },
      },
      // Universe icon appears at the moment of creation
      {
        time: 1200,
        type: 'icon',
        config: {
          emoji: '\uD83C\uDF0C',
          x: midX,
          y: midY,
          scale: 0,
          duration: 500,
          rotation: 0,
        },
      },
      {
        time: 1700,
        type: 'icon',
        config: {
          emoji: '\uD83C\uDF0C',
          x: midX,
          y: midY,
          scale: 2.5,
          duration: 400,
          rotation: 45,
        },
      },
      // PARTICLE WAVE 1 - massive fast outward explosion
      {
        time: 1200,
        type: 'particles',
        config: {
          mode: 'burst',
          count: 100,
          origin: { x: 0.5, y: 0.5 },
          spread: { x: 10, y: 10 },
          velocity: { min: 250, max: 600 },
          angle: { min: 0, max: 360 },
          size: { min: 4, max: 16 },
          lifetime: { min: 1000, max: 2000 },
          gravity: 0,
          colors: COLORS.universe,
          shapes: ['star', 'circle', 'diamond'],
          glow: true,
          glowIntensity: 1.0,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // PARTICLE WAVE 2 - secondary explosion, slightly delayed
      {
        time: 1500,
        type: 'particles',
        config: {
          mode: 'burst',
          count: 70,
          origin: { x: 0.5, y: 0.5 },
          spread: { x: 30, y: 30 },
          velocity: { min: 150, max: 400 },
          angle: { min: 0, max: 360 },
          size: { min: 5, max: 12 },
          lifetime: { min: 800, max: 1600 },
          gravity: 10,
          colors: COLORS.universe,
          shapes: ['star', 'circle', 'triangle'],
          glow: true,
          glowIntensity: 0.9,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Flash 2 - color shift to cyan
      {
        time: 1600,
        type: 'flash',
        config: {
          color: '#00eefc',
          opacity: 0.5,
          duration: 400,
        },
      },
      // PARTICLE WAVE 3 - expanding ring of stars
      {
        time: 1800,
        type: 'particles',
        config: {
          mode: 'burst',
          count: 60,
          origin: { x: 0.5, y: 0.5 },
          spread: { x: 50, y: 50 },
          velocity: { min: 100, max: 300 },
          angle: { min: 0, max: 360 },
          size: { min: 3, max: 10 },
          lifetime: { min: 800, max: 1500 },
          gravity: 5,
          colors: ['#ffe792', '#ffd700', '#ffffff', '#00eefc'],
          shapes: ['star', 'diamond'],
          glow: true,
          glowIntensity: 0.8,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Rotating glow - shifts through colors
      {
        time: 1800,
        type: 'glow',
        config: {
          color: '#00eefc',
          x: midX,
          y: midY,
          size: 250,
          intensity: 0.7,
          duration: 1000,
        },
      },
      // Second shake - aftershock
      {
        time: 2200,
        type: 'shake',
        config: {
          intensity: 15,
          duration: 600,
        },
      },
      // Flash 3 - color shift to gold
      {
        time: 2200,
        type: 'flash',
        config: {
          color: '#ffd700',
          opacity: 0.4,
          duration: 400,
        },
      },

      // ============================================================
      // ACT III: Cosmic Expansion (2500 - 4200ms)
      // The icon stabilizes and rotates, galaxy particles swirl,
      // multi-layered glows pulse, "UNIVERSE" text reveals.
      // ============================================================
      // Icon stabilizes with slow rotation
      {
        time: 2500,
        type: 'icon',
        config: {
          emoji: '\uD83C\uDF0C',
          x: midX,
          y: midY,
          scale: 2.0,
          duration: 600,
          rotation: 90,
        },
      },
      // Galaxy swirl particles - upper arc
      {
        time: 2500,
        type: 'particles',
        config: {
          mode: 'stream',
          count: 45,
          origin: { x: 0.3, y: 0.3 },
          spread: { x: 100, y: 60 },
          velocity: { min: 40, max: 100 },
          angle: { min: 30, max: 150 },
          size: { min: 2, max: 6 },
          lifetime: { min: 800, max: 1500 },
          gravity: 0,
          colors: COLORS.universe,
          shapes: ['circle', 'star'],
          glow: true,
          glowIntensity: 0.7,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Galaxy swirl particles - lower arc
      {
        time: 2600,
        type: 'particles',
        config: {
          mode: 'stream',
          count: 45,
          origin: { x: 0.7, y: 0.7 },
          spread: { x: 100, y: 60 },
          velocity: { min: 40, max: 100 },
          angle: { min: 210, max: 330 },
          size: { min: 2, max: 6 },
          lifetime: { min: 800, max: 1500 },
          gravity: 0,
          colors: COLORS.universe,
          shapes: ['circle', 'star'],
          glow: true,
          glowIntensity: 0.7,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Pulsing multi-color glow layers
      {
        time: 2800,
        type: 'glow',
        config: {
          color: '#d394ff',
          x: midX,
          y: midY,
          size: 200,
          intensity: 0.6,
          duration: 800,
        },
      },
      {
        time: 3000,
        type: 'glow',
        config: {
          color: '#ff6e84',
          x: midX - 40,
          y: midY - 30,
          size: 120,
          intensity: 0.5,
          duration: 700,
        },
      },
      {
        time: 3100,
        type: 'glow',
        config: {
          color: '#00eefc',
          x: midX + 40,
          y: midY + 30,
          size: 120,
          intensity: 0.5,
          duration: 700,
        },
      },
      // PARTICLE WAVE 4 - nebula burst at edges
      {
        time: 3000,
        type: 'particles',
        config: {
          mode: 'burst',
          count: 40,
          origin: { x: 0.2, y: 0.3 },
          spread: { x: 40, y: 40 },
          velocity: { min: 60, max: 180 },
          angle: { min: 0, max: 360 },
          size: { min: 3, max: 9 },
          lifetime: { min: 700, max: 1300 },
          gravity: 5,
          colors: ['#d394ff', '#aa30fa', '#ffffff'],
          shapes: ['circle', 'star'],
          glow: true,
          glowIntensity: 0.8,
          blendMode: 'screen',
          delay: 0,
        },
      },
      {
        time: 3200,
        type: 'particles',
        config: {
          mode: 'burst',
          count: 40,
          origin: { x: 0.8, y: 0.7 },
          spread: { x: 40, y: 40 },
          velocity: { min: 60, max: 180 },
          angle: { min: 0, max: 360 },
          size: { min: 3, max: 9 },
          lifetime: { min: 700, max: 1300 },
          gravity: 5,
          colors: ['#00eefc', '#ffe792', '#ffffff'],
          shapes: ['circle', 'diamond'],
          glow: true,
          glowIntensity: 0.8,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // "UNIVERSE" text reveal with rainbow glow
      {
        time: 2800,
        type: 'text',
        config: {
          text: 'UNIVERSE',
          x: midX,
          y: midY - 120,
          fontSize: 44,
          color: '#ffffff',
          duration: 2500,
          glow: true,
        },
      },
      // Rainbow glow behind text
      {
        time: 2800,
        type: 'glow',
        config: {
          color: '#ff6e84',
          x: midX,
          y: midY - 120,
          size: 180,
          intensity: 0.5,
          duration: 600,
        },
      },
      {
        time: 3200,
        type: 'glow',
        config: {
          color: '#ffe792',
          x: midX,
          y: midY - 120,
          size: 180,
          intensity: 0.5,
          duration: 600,
        },
      },
      {
        time: 3600,
        type: 'glow',
        config: {
          color: '#00eefc',
          x: midX,
          y: midY - 120,
          size: 180,
          intensity: 0.5,
          duration: 600,
        },
      },
      {
        time: 4000,
        type: 'glow',
        config: {
          color: '#d394ff',
          x: midX,
          y: midY - 120,
          size: 180,
          intensity: 0.5,
          duration: 600,
        },
      },
      // Icon continues slow rotation
      {
        time: 3100,
        type: 'icon',
        config: {
          emoji: '\uD83C\uDF0C',
          x: midX,
          y: midY,
          scale: 2.0,
          duration: 900,
          rotation: 180,
        },
      },
      // Third shake - cosmic tremor
      {
        time: 3400,
        type: 'shake',
        config: {
          intensity: 10,
          duration: 500,
        },
      },
      // Sender name
      {
        time: 3400,
        type: 'text',
        config: {
          text: senderName,
          x: midX,
          y: midY + 120,
          fontSize: 24,
          color: '#ffe792',
          duration: 2000,
          glow: true,
        },
      },

      // ============================================================
      // ACT IV: The Afterglow (4200 - 6000ms)
      // Particles drift lazily, glows fade through colors, icon
      // gently spins and fades into the void.
      // ============================================================
      // PARTICLE WAVE 5 - cosmic dust drifting
      {
        time: 4200,
        type: 'particles',
        config: {
          mode: 'stream',
          count: 50,
          origin: { x: 0.5, y: 0.5 },
          spread: { x: 200, y: 200 },
          velocity: { min: 5, max: 30 },
          angle: { min: 0, max: 360 },
          size: { min: 1, max: 5 },
          lifetime: { min: 800, max: 1500 },
          gravity: 0,
          colors: COLORS.universe,
          shapes: ['circle', 'star'],
          glow: true,
          glowIntensity: 0.5,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Final color shift flash - back to deep space
      {
        time: 4400,
        type: 'flash',
        config: {
          color: '#0a001a',
          opacity: 0.3,
          duration: 800,
        },
      },
      // Fading rotating glow
      {
        time: 4200,
        type: 'glow',
        config: {
          color: '#aa30fa',
          x: midX,
          y: midY,
          size: 180,
          intensity: 0.4,
          duration: 1200,
        },
      },
      // Last particle burst - farewell stardust
      {
        time: 4800,
        type: 'particles',
        config: {
          mode: 'burst',
          count: 30,
          origin: { x: 0.5, y: 0.5 },
          spread: { x: 100, y: 100 },
          velocity: { min: 20, max: 80 },
          angle: { min: 0, max: 360 },
          size: { min: 2, max: 6 },
          lifetime: { min: 600, max: 1200 },
          gravity: 0,
          colors: ['#ffffff', '#d394ff', '#00eefc'],
          shapes: ['star', 'circle'],
          glow: true,
          glowIntensity: 0.7,
          blendMode: 'screen',
          delay: 0,
        },
      },
      // Icon fades with final rotation
      {
        time: 5000,
        type: 'icon',
        config: {
          emoji: '\uD83C\uDF0C',
          x: midX,
          y: midY,
          scale: 0,
          duration: 1000,
          rotation: 360,
        },
      },
    ],
    particles: [
      // ACT I - galaxy swirl
      {
        mode: 'stream',
        count: 40,
        origin: { x: 0.5, y: 0.5 },
        spread: { x: 250, y: 250 },
        velocity: { min: 30, max: 80 },
        angle: { min: 0, max: 360 },
        size: { min: 1, max: 4 },
        lifetime: { min: 800, max: 1500 },
        gravity: 0,
        colors: COLORS.universe,
        shapes: ['circle'],
        glow: true,
        glowIntensity: 0.5,
        blendMode: 'screen',
        delay: 0,
      },
      {
        mode: 'stream',
        count: 35,
        origin: { x: 0.0, y: 0.5 },
        spread: { x: 30, y: 150 },
        velocity: { min: 80, max: 160 },
        angle: { min: 340, max: 380 },
        size: { min: 2, max: 5 },
        lifetime: { min: 600, max: 1200 },
        gravity: 0,
        colors: ['#00eefc', '#00deec', '#d394ff'],
        shapes: ['circle', 'star'],
        glow: true,
        glowIntensity: 0.6,
        blendMode: 'screen',
        delay: 500,
      },
      {
        mode: 'stream',
        count: 35,
        origin: { x: 1.0, y: 0.5 },
        spread: { x: 30, y: 150 },
        velocity: { min: 80, max: 160 },
        angle: { min: 160, max: 200 },
        size: { min: 2, max: 5 },
        lifetime: { min: 600, max: 1200 },
        gravity: 0,
        colors: ['#ffe792', '#ff6e84', '#d394ff'],
        shapes: ['circle', 'star'],
        glow: true,
        glowIntensity: 0.6,
        blendMode: 'screen',
        delay: 600,
      },
      // ACT II - Big Bang waves
      {
        mode: 'burst',
        count: 100,
        origin: { x: 0.5, y: 0.5 },
        spread: { x: 10, y: 10 },
        velocity: { min: 250, max: 600 },
        angle: { min: 0, max: 360 },
        size: { min: 4, max: 16 },
        lifetime: { min: 1000, max: 2000 },
        gravity: 0,
        colors: COLORS.universe,
        shapes: ['star', 'circle', 'diamond'],
        glow: true,
        glowIntensity: 1.0,
        blendMode: 'screen',
        delay: 1200,
      },
      {
        mode: 'burst',
        count: 70,
        origin: { x: 0.5, y: 0.5 },
        spread: { x: 30, y: 30 },
        velocity: { min: 150, max: 400 },
        angle: { min: 0, max: 360 },
        size: { min: 5, max: 12 },
        lifetime: { min: 800, max: 1600 },
        gravity: 10,
        colors: COLORS.universe,
        shapes: ['star', 'circle', 'triangle'],
        glow: true,
        glowIntensity: 0.9,
        blendMode: 'screen',
        delay: 1500,
      },
      {
        mode: 'burst',
        count: 60,
        origin: { x: 0.5, y: 0.5 },
        spread: { x: 50, y: 50 },
        velocity: { min: 100, max: 300 },
        angle: { min: 0, max: 360 },
        size: { min: 3, max: 10 },
        lifetime: { min: 800, max: 1500 },
        gravity: 5,
        colors: ['#ffe792', '#ffd700', '#ffffff', '#00eefc'],
        shapes: ['star', 'diamond'],
        glow: true,
        glowIntensity: 0.8,
        blendMode: 'screen',
        delay: 1800,
      },
      // ACT III - galaxy swirl arcs
      {
        mode: 'stream',
        count: 45,
        origin: { x: 0.3, y: 0.3 },
        spread: { x: 100, y: 60 },
        velocity: { min: 40, max: 100 },
        angle: { min: 30, max: 150 },
        size: { min: 2, max: 6 },
        lifetime: { min: 800, max: 1500 },
        gravity: 0,
        colors: COLORS.universe,
        shapes: ['circle', 'star'],
        glow: true,
        glowIntensity: 0.7,
        blendMode: 'screen',
        delay: 2500,
      },
      {
        mode: 'stream',
        count: 45,
        origin: { x: 0.7, y: 0.7 },
        spread: { x: 100, y: 60 },
        velocity: { min: 40, max: 100 },
        angle: { min: 210, max: 330 },
        size: { min: 2, max: 6 },
        lifetime: { min: 800, max: 1500 },
        gravity: 0,
        colors: COLORS.universe,
        shapes: ['circle', 'star'],
        glow: true,
        glowIntensity: 0.7,
        blendMode: 'screen',
        delay: 2600,
      },
      // Nebula bursts
      {
        mode: 'burst',
        count: 40,
        origin: { x: 0.2, y: 0.3 },
        spread: { x: 40, y: 40 },
        velocity: { min: 60, max: 180 },
        angle: { min: 0, max: 360 },
        size: { min: 3, max: 9 },
        lifetime: { min: 700, max: 1300 },
        gravity: 5,
        colors: ['#d394ff', '#aa30fa', '#ffffff'],
        shapes: ['circle', 'star'],
        glow: true,
        glowIntensity: 0.8,
        blendMode: 'screen',
        delay: 3000,
      },
      {
        mode: 'burst',
        count: 40,
        origin: { x: 0.8, y: 0.7 },
        spread: { x: 40, y: 40 },
        velocity: { min: 60, max: 180 },
        angle: { min: 0, max: 360 },
        size: { min: 3, max: 9 },
        lifetime: { min: 700, max: 1300 },
        gravity: 5,
        colors: ['#00eefc', '#ffe792', '#ffffff'],
        shapes: ['circle', 'diamond'],
        glow: true,
        glowIntensity: 0.8,
        blendMode: 'screen',
        delay: 3200,
      },
      // ACT IV - cosmic dust
      {
        mode: 'stream',
        count: 50,
        origin: { x: 0.5, y: 0.5 },
        spread: { x: 200, y: 200 },
        velocity: { min: 5, max: 30 },
        angle: { min: 0, max: 360 },
        size: { min: 1, max: 5 },
        lifetime: { min: 800, max: 1500 },
        gravity: 0,
        colors: COLORS.universe,
        shapes: ['circle', 'star'],
        glow: true,
        glowIntensity: 0.5,
        blendMode: 'screen',
        delay: 4200,
      },
      // Farewell stardust
      {
        mode: 'burst',
        count: 30,
        origin: { x: 0.5, y: 0.5 },
        spread: { x: 100, y: 100 },
        velocity: { min: 20, max: 80 },
        angle: { min: 0, max: 360 },
        size: { min: 2, max: 6 },
        lifetime: { min: 600, max: 1200 },
        gravity: 0,
        colors: ['#ffffff', '#d394ff', '#00eefc'],
        shapes: ['star', 'circle'],
        glow: true,
        glowIntensity: 0.7,
        blendMode: 'screen',
        delay: 4800,
      },
    ],
    duration: 6000,
    tier: 10,
    fullScreen: true,
  };
}

// ===========================================================================
// Gift lookup helper
// ===========================================================================
const GIFT_MAP = {
  rose:     createRoseAnimation,
  heart:    createHeartAnimation,
  star:     createStarAnimation,
  fire:     createFireAnimation,
  diamond:  createDiamondAnimation,
  crown:    createCrownAnimation,
  rocket:   createRocketAnimation,
  castle:   createCastleAnimation,
  lion:     createLionAnimation,
  universe: createUniverseAnimation,
};

/**
 * Returns the animation preset for a given gift name.
 *
 * @param {string} giftName  - One of: rose, heart, star, fire, diamond,
 *                              crown, rocket, castle, lion, universe
 * @param {number} screenWidth
 * @param {number} screenHeight
 * @param {string} senderName
 * @returns {{ timeline: Array, particles: Array, duration: number, tier: number, fullScreen: boolean }}
 */
export function getGiftAnimation(giftName, screenWidth, screenHeight, senderName) {
  const key = giftName.toLowerCase();
  const factory = GIFT_MAP[key];
  if (!factory) {
    throw new Error(`Unknown gift name: "${giftName}". Valid names: ${Object.keys(GIFT_MAP).join(', ')}`);
  }
  return factory(screenWidth, screenHeight, senderName);
}
