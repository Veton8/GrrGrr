import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Platform, StyleSheet } from 'react-native';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEG_TO_RAD = Math.PI / 180;
const TWO_PI = Math.PI * 2;
const POOL_GROWTH_INCREMENT = 64;

// ---------------------------------------------------------------------------
// Particle object pool – avoids GC pressure during high-frequency emission
// ---------------------------------------------------------------------------

function createParticlePool(initialSize) {
  const pool = [];
  const free = [];

  function allocate(count) {
    for (let i = 0; i < count; i++) {
      const p = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 0,
        color: '#fff',
        opacity: 1,
        rotation: 0,
        rotationSpeed: 0,
        lifetime: 0,
        maxLifetime: 0,
        gravity: 0,
        shape: 'circle',
        active: false,
      };
      pool.push(p);
      free.push(p);
    }
  }

  allocate(initialSize);

  function acquire() {
    if (free.length === 0) {
      allocate(POOL_GROWTH_INCREMENT);
    }
    const p = free.pop();
    p.active = true;
    return p;
  }

  function release(p) {
    p.active = false;
    free.push(p);
  }

  function getAll() {
    return pool;
  }

  return { acquire, release, getAll };
}

// ---------------------------------------------------------------------------
// Random helpers
// ---------------------------------------------------------------------------

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Shape drawing functions (canvas 2D)
// ---------------------------------------------------------------------------

function drawCircle(ctx, x, y, size) {
  ctx.beginPath();
  ctx.arc(x, y, size, 0, TWO_PI);
  ctx.fill();
}

function drawStar(ctx, x, y, size) {
  const spikes = 5;
  const outerRadius = size;
  const innerRadius = size * 0.4;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fill();
}

function drawHeart(ctx, x, y, size) {
  const s = size * 0.6;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.4);
  ctx.bezierCurveTo(x, y - s * 0.2, x - s, y - s * 0.6, x - s, y + s * 0.1);
  ctx.bezierCurveTo(x - s, y + s * 0.6, x, y + s, x, y + s * 1.2);
  ctx.bezierCurveTo(x, y + s, x + s, y + s * 0.6, x + s, y + s * 0.1);
  ctx.bezierCurveTo(x + s, y - s * 0.6, x, y - s * 0.2, x, y + s * 0.4);
  ctx.closePath();
  ctx.fill();
}

function drawDiamond(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.6, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size * 0.6, y);
  ctx.closePath();
  ctx.fill();
}

function drawSpark(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.15, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size * 0.15, y);
  ctx.closePath();
  ctx.fill();
}

const SHAPE_DRAW = {
  circle: drawCircle,
  star: drawStar,
  heart: drawHeart,
  diamond: drawDiamond,
  spark: drawSpark,
};

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = {
  mode: 'burst',
  count: 100,
  origin: { x: 0.5, y: 0.5 },
  path: [],
  spread: { x: 200, y: 200 },
  velocity: { min: 2, max: 8 },
  angle: { min: 0, max: 360 },
  size: { min: 3, max: 12 },
  lifetime: { min: 1000, max: 3000 },
  gravity: 0.1,
  colors: ['#d394ff', '#aa30fa', '#ffe792'],
  shapes: ['circle'],
  glow: false,
  glowIntensity: 15,
  blendMode: 'lighter',
};

// ---------------------------------------------------------------------------
// Particle initialisation
// ---------------------------------------------------------------------------

function initParticle(p, cfg, width, height, ox, oy) {
  const angleDeg = rand(cfg.angle.min, cfg.angle.max);
  const angleRad = angleDeg * DEG_TO_RAD;
  const speed = rand(cfg.velocity.min, cfg.velocity.max);

  p.x = ox + rand(-cfg.spread.x / 2, cfg.spread.x / 2);
  p.y = oy + rand(-cfg.spread.y / 2, cfg.spread.y / 2);
  p.vx = Math.cos(angleRad) * speed;
  p.vy = Math.sin(angleRad) * speed;
  p.size = rand(cfg.size.min, cfg.size.max);
  p.color = pick(cfg.colors);
  p.opacity = 1;
  p.rotation = rand(0, TWO_PI);
  p.rotationSpeed = rand(-0.05, 0.05);
  p.maxLifetime = rand(cfg.lifetime.min, cfg.lifetime.max);
  p.lifetime = p.maxLifetime;
  p.gravity = cfg.gravity;
  p.shape = pick(cfg.shapes);
  p.active = true;
}

// ---------------------------------------------------------------------------
// ParticleSystem component (web: canvas, native: fallback View)
// ---------------------------------------------------------------------------

function ParticleSystem({ config: userConfig, active = true, width, height, style }) {
  const cfg = useMemo(() => ({ ...DEFAULT_CONFIG, ...userConfig }), [userConfig]);

  // ---- Refs ----
  const canvasRef = useRef(null);
  const poolRef = useRef(null);
  const activeParticlesRef = useRef([]);
  const rafIdRef = useRef(null);
  const lastTimeRef = useRef(0);
  const emitAccRef = useRef(0);
  const activeRef = useRef(active);
  const hasBurstRef = useRef(false);
  const trailIndexRef = useRef(0);
  const trailAccRef = useRef(0);

  // Keep active ref in sync
  useEffect(() => {
    activeRef.current = active;
    if (active) {
      hasBurstRef.current = false;
      trailIndexRef.current = 0;
      trailAccRef.current = 0;
    }
  }, [active]);

  // ---- Pool lazy init ----
  if (!poolRef.current) {
    poolRef.current = createParticlePool(256);
  }

  // ---- Emit helpers ----
  const emitBatch = useCallback(
    (count, originX, originY) => {
      const pool = poolRef.current;
      const particles = activeParticlesRef.current;
      for (let i = 0; i < count; i++) {
        const p = pool.acquire();
        initParticle(p, cfg, width, height, originX, originY);
        particles.push(p);
      }
    },
    [cfg, width, height],
  );

  // ---- Main loop (web canvas) ----
  const loop = useCallback(
    (timestamp) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
      const dt = Math.min(timestamp - lastTimeRef.current, 50); // cap to avoid spiral
      lastTimeRef.current = timestamp;

      const isActive = activeRef.current;
      const particles = activeParticlesRef.current;
      const pool = poolRef.current;

      // --- Emission ---
      if (isActive) {
        if (cfg.mode === 'burst' && !hasBurstRef.current) {
          hasBurstRef.current = true;
          const ox = cfg.origin.x * width;
          const oy = cfg.origin.y * height;
          emitBatch(cfg.count, ox, oy);
        } else if (cfg.mode === 'stream') {
          emitAccRef.current += dt;
          const interval = 1000 / cfg.count; // cfg.count = particles per second
          while (emitAccRef.current >= interval) {
            emitAccRef.current -= interval;
            const ox = cfg.origin.x * width;
            const oy = cfg.origin.y * height;
            emitBatch(1, ox, oy);
          }
        } else if (cfg.mode === 'trail' && cfg.path && cfg.path.length >= 2) {
          trailAccRef.current += dt;
          const interval = 1000 / cfg.count;
          while (trailAccRef.current >= interval) {
            trailAccRef.current -= interval;
            const idx = trailIndexRef.current % cfg.path.length;
            const point = cfg.path[idx];
            const ox = point.x * width;
            const oy = point.y * height;
            emitBatch(1, ox, oy);
            trailIndexRef.current++;
          }
        }
      }

      // --- Update particles ---
      const dtSeconds = dt / 1000;
      let aliveCount = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!p.active) continue;

        p.lifetime -= dt;
        if (p.lifetime <= 0) {
          pool.release(p);
          continue;
        }

        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.opacity = Math.max(0, p.lifetime / p.maxLifetime);

        particles[aliveCount] = p;
        aliveCount++;
      }
      particles.length = aliveCount;

      // --- Draw ---
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = cfg.blendMode || 'source-over';

      const useGlow = cfg.glow;
      const glowIntensity = cfg.glowIntensity || 15;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.save();
        ctx.globalAlpha = p.opacity;

        if (useGlow) {
          ctx.shadowBlur = glowIntensity * p.opacity;
          ctx.shadowColor = p.color;
        }

        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        const drawFn = SHAPE_DRAW[p.shape] || drawCircle;
        drawFn(ctx, 0, 0, p.size);

        ctx.restore();
      }

      // Reset composite so clearing works next frame
      ctx.globalCompositeOperation = 'source-over';

      // Continue loop if there are particles alive or we're still active
      if (particles.length > 0 || isActive) {
        rafIdRef.current = requestAnimationFrame(loop);
      } else {
        rafIdRef.current = null;
      }
    },
    [cfg, width, height, emitBatch],
  );

  // ---- Start / stop the animation loop ----
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    lastTimeRef.current = 0;
    emitAccRef.current = 0;
    rafIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [loop]);

  // ---- Resize canvas backing store when dimensions change ----
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, [width, height]);

  // ---- Cleanup pool on unmount ----
  useEffect(() => {
    return () => {
      activeParticlesRef.current.length = 0;
    };
  }, []);

  // ---- Render ----
  if (Platform.OS === 'web') {
    return (
      <canvas
        ref={canvasRef}
        style={{
          width,
          height,
          pointerEvents: 'none',
          ...(style && typeof style === 'object' ? StyleSheet.flatten(style) : {}),
        }}
      />
    );
  }

  // Native fallback: render an empty View. A full native implementation would
  // use react-native-reanimated + Animated for each particle, but that is out
  // of scope here. The canvas-based web path is the primary target.
  return <View style={[{ width, height }, style]} pointerEvents="none" />;
}

export default React.memo(ParticleSystem);
