import React, { useRef, useEffect, useCallback } from 'react';
import { Platform, View } from 'react-native';

export default function AnimatedFlame({ size = 60, intensity = 1, style }) {
  if (Platform.OS !== 'web') {
    // TODO: Skia implementation for native
    return <View style={[{ width: size, height: size }, style]} />;
  }

  return <AnimatedFlameCanvas size={size} intensity={intensity} style={style} />;
}

const LAYERS = [
  {
    colorFrom: '#ff4500', colorTo: '#ff0000',
    scale: 1.0, phaseOffset: 0, wobble: 4,
  },
  {
    colorFrom: '#ffd700', colorTo: '#ff8c00',
    scale: 0.7, phaseOffset: 0.8, wobble: 2.5,
  },
  {
    colorFrom: '#ffffff', colorTo: '#ffff00',
    scale: 0.4, phaseOffset: 1.6, wobble: 1.5,
  },
];

function AnimatedFlameCanvas({ size, intensity, style }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const embersRef = useRef([]);
  const lastEmberRef = useRef(0);

  const draw = useCallback((ctx, w, h, dpr, time) => {
    ctx.clearRect(0, 0, w * dpr, h * dpr);
    ctx.save();
    ctx.scale(dpr, dpr);

    const cx = w / 2;
    const flameBottom = h * 0.9;
    const flameHeight = h * 0.8;

    // Ember spawning
    const maxEmbers = intensity >= 3 ? 12 : 5;
    const spawnInterval = intensity >= 3 ? 150 : 350;
    if (time - lastEmberRef.current > spawnInterval && embersRef.current.length < maxEmbers) {
      const colors = ['#ff6347', '#ffa500', '#ffd700', '#ff4500'];
      embersRef.current.push({
        x: cx + (Math.random() - 0.5) * w * 0.15,
        y: flameBottom - flameHeight * 0.7,
        vx: (Math.random() - 0.5) * 0.03,
        vy: -(0.02 + Math.random() * 0.03),
        born: time,
        life: 800 + Math.random() * 700,
        radius: 1 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        sineAmp: 0.5 + Math.random() * 1.5,
        sineFreq: 0.005 + Math.random() * 0.005,
      });
      lastEmberRef.current = time;
    }

    // Draw embers behind flame
    embersRef.current = embersRef.current.filter(e => time - e.born < e.life);
    for (const e of embersRef.current) {
      const age = time - e.born;
      const t = age / e.life;
      const opacity = 1 - t;
      const px = e.x + Math.sin(age * e.sineFreq) * e.sineAmp * 10 + e.vx * age;
      const py = e.y + e.vy * age;
      const r = e.radius * (1 - t * 0.6);
      ctx.beginPath();
      ctx.arc(px, py, Math.max(r, 0.5), 0, Math.PI * 2);
      ctx.fillStyle = e.color.replace(')', `, ${opacity})`).replace('rgb', 'rgba');
      // Hex to rgba
      const rgb = hexToRgb(e.color);
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
      ctx.fill();
    }

    // Glow behind flame at intensity 3
    if (intensity >= 3) {
      const glowGrad = ctx.createRadialGradient(cx, flameBottom - flameHeight * 0.4, 0, cx, flameBottom - flameHeight * 0.4, w * 0.5);
      glowGrad.addColorStop(0, 'rgba(255, 69, 0, 0.25)');
      glowGrad.addColorStop(1, 'rgba(255, 69, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // Draw flame layers back to front
    const wobbleMult = intensity >= 3 ? 1.5 : 1;

    for (let i = 0; i < LAYERS.length; i++) {
      const layer = LAYERS[i];
      const layerScale = layer.scale;
      const wobbleX = Math.sin(time * 0.004 + layer.phaseOffset) * layer.wobble * wobbleMult;

      const lw = w * layerScale;
      const lh = flameHeight * layerScale;
      const lx = cx;
      const ly = flameBottom;

      ctx.save();

      // Flame gradient
      const grad = ctx.createLinearGradient(lx, ly - lh, lx, ly);
      grad.addColorStop(0, layer.colorFrom);
      grad.addColorStop(1, layer.colorTo);

      ctx.beginPath();
      // Teardrop path
      const tipY = ly - lh;
      const bottomY = ly;
      const halfW = lw * 0.5;

      ctx.moveTo(lx + wobbleX * 0.3, tipY); // tip
      ctx.bezierCurveTo(
        lx - halfW * 0.6 + wobbleX, tipY + lh * 0.35,
        lx - halfW * 0.7 + wobbleX * 0.5, tipY + lh * 0.6,
        lx - halfW * 0.4 + wobbleX * 0.2, tipY + lh * 0.8
      );
      ctx.quadraticCurveTo(
        lx, bottomY + lh * 0.05,
        lx + halfW * 0.4 - wobbleX * 0.2, tipY + lh * 0.8
      );
      ctx.bezierCurveTo(
        lx + halfW * 0.7 - wobbleX * 0.5, tipY + lh * 0.6,
        lx + halfW * 0.6 - wobbleX, tipY + lh * 0.35,
        lx + wobbleX * 0.3, tipY
      );
      ctx.closePath();

      ctx.fillStyle = grad;

      if (i === 0 && intensity >= 3) {
        ctx.shadowColor = 'rgba(255, 100, 0, 0.5)';
        ctx.shadowBlur = 20;
      }

      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }, [intensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';

    const ctx = canvas.getContext('2d');

    const loop = (time) => {
      draw(ctx, size, size, dpr, time);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [size, intensity, draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
        ...style,
      }}
    />
  );
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 255, g: 100, b: 0 };
}
