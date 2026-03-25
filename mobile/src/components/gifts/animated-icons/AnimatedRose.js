import React, { useRef, useEffect, useCallback } from 'react';
import { Platform, View } from 'react-native';

export default function AnimatedRose({ size = 60, intensity = 1, style }) {
  if (Platform.OS !== 'web') {
    // TODO: Skia implementation for native
    return <View style={[{ width: size, height: size }, style]} />;
  }

  return <AnimatedRoseCanvas size={size} intensity={intensity} style={style} />;
}

const PETAL_LAYERS = [
  { petals: 5, radius: 0.42, petalW: 0.22, petalH: 0.28, colorFrom: '#8b0000', colorTo: '#cc0000' },
  { petals: 5, radius: 0.34, petalW: 0.18, petalH: 0.24, colorFrom: '#cc0000', colorTo: '#ff1493' },
  { petals: 6, radius: 0.26, petalW: 0.15, petalH: 0.20, colorFrom: '#ff1493', colorTo: '#ff69b4' },
  { petals: 5, radius: 0.18, petalW: 0.12, petalH: 0.16, colorFrom: '#ff69b4', colorTo: '#ffb6c1' },
  { petals: 4, radius: 0.11, petalW: 0.09, petalH: 0.12, colorFrom: '#ffb6c1', colorTo: '#ffc0cb' },
];

function AnimatedRoseCanvas({ size, intensity, style }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const pollenRef = useRef([]);
  const lastPollenRef = useRef(0);

  const draw = useCallback((ctx, w, h, dpr, time) => {
    ctx.clearRect(0, 0, w * dpr, h * dpr);
    ctx.save();
    ctx.scale(dpr, dpr);

    const cx = w / 2;
    const cy = h * 0.46;
    const breathAmp = intensity >= 3 ? 0.04 : 0.02;

    // Pollen spawning
    const maxPollen = intensity >= 3 ? 8 : 4;
    const spawnInterval = intensity >= 3 ? 300 : 600;
    if (time - lastPollenRef.current > spawnInterval && pollenRef.current.length < maxPollen) {
      const colors = ['#ffd700', '#fff8dc', '#ffec8b', '#fffacd'];
      pollenRef.current.push({
        x: cx + (Math.random() - 0.5) * w * 0.2,
        y: cy - w * 0.05,
        vx: (Math.random() - 0.5) * 0.015,
        vy: -(0.01 + Math.random() * 0.02),
        born: time,
        life: 1500,
        radius: 0.8 + Math.random() * 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        sineAmp: 0.3 + Math.random() * 0.8,
        sineFreq: 0.003 + Math.random() * 0.003,
      });
      lastPollenRef.current = time;
    }

    // Stem (only visible at larger sizes)
    if (w > 80) {
      ctx.save();
      ctx.strokeStyle = '#228b22';
      ctx.lineWidth = Math.max(1.5, w * 0.02);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy + w * 0.25);
      ctx.quadraticCurveTo(cx + w * 0.03, cy + w * 0.35, cx - w * 0.01, cy + w * 0.48);
      ctx.stroke();

      // Small leaf
      if (w > 120) {
        ctx.fillStyle = '#228b22';
        ctx.beginPath();
        const leafX = cx + w * 0.01;
        const leafY = cy + w * 0.38;
        ctx.moveTo(leafX, leafY);
        ctx.quadraticCurveTo(leafX + w * 0.08, leafY - w * 0.04, leafX + w * 0.12, leafY + w * 0.01);
        ctx.quadraticCurveTo(leafX + w * 0.06, leafY + w * 0.02, leafX, leafY);
        ctx.fill();
      }
      ctx.restore();
    }

    // Glow aura behind rose
    const glowIntensity = intensity >= 3 ? 0.25 : 0.12;
    const glowPulse = 1 + Math.sin(time * 0.002) * 0.15;
    const glowRadius = w * 0.4 * glowPulse;
    const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    glowGrad.addColorStop(0, `rgba(255, 105, 180, ${glowIntensity})`);
    glowGrad.addColorStop(0.6, `rgba(255, 182, 193, ${glowIntensity * 0.4})`);
    glowGrad.addColorStop(1, 'rgba(255, 182, 193, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, w, h);

    // Draw petal layers from outermost to innermost
    for (let li = 0; li < PETAL_LAYERS.length; li++) {
      const layer = PETAL_LAYERS[li];
      const layerScale = 1 + Math.sin(time * 0.002 + li * 0.5) * breathAmp;
      const baseAngle = li * (72 * Math.PI / 180); // stagger layers

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(layerScale, layerScale);

      for (let p = 0; p < layer.petals; p++) {
        const angle = baseAngle + (p * (Math.PI * 2 / layer.petals));

        ctx.save();
        ctx.rotate(angle);

        const petalW = w * layer.petalW;
        const petalH = w * layer.petalH;
        const petalDist = w * layer.radius * 0.3;

        // Draw petal as pointed oval using two bezier curves
        ctx.beginPath();
        ctx.moveTo(0, -petalDist); // base near center
        ctx.bezierCurveTo(
          -petalW * 0.8, -petalDist - petalH * 0.3,
          -petalW * 0.9, -petalDist - petalH * 0.7,
          0, -petalDist - petalH // tip
        );
        ctx.bezierCurveTo(
          petalW * 0.9, -petalDist - petalH * 0.7,
          petalW * 0.8, -petalDist - petalH * 0.3,
          0, -petalDist
        );
        ctx.closePath();

        // Gradient for petal
        const pGrad = ctx.createLinearGradient(0, -petalDist, 0, -petalDist - petalH);
        pGrad.addColorStop(0, layer.colorFrom);
        pGrad.addColorStop(1, layer.colorTo);
        ctx.fillStyle = pGrad;

        if (intensity >= 3 && li < 2) {
          ctx.shadowColor = 'rgba(255, 20, 147, 0.3)';
          ctx.shadowBlur = 8;
        }

        ctx.fill();

        // Subtle petal edge highlight
        ctx.strokeStyle = `rgba(255, 255, 255, 0.08)`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        ctx.restore();
      }

      ctx.restore();
    }

    // Center stamen
    const stamenScale = 1 + Math.sin(time * 0.002 + PETAL_LAYERS.length * 0.5) * breathAmp;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(stamenScale, stamenScale);
    const stamenR = w * 0.045;
    const stamenGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, stamenR);
    stamenGrad.addColorStop(0, '#fff8dc');
    stamenGrad.addColorStop(0.5, '#ffd700');
    stamenGrad.addColorStop(1, '#daa520');
    ctx.beginPath();
    ctx.arc(0, 0, stamenR, 0, Math.PI * 2);
    ctx.fillStyle = stamenGrad;
    ctx.fill();
    ctx.restore();

    // Draw pollen particles on top
    pollenRef.current = pollenRef.current.filter(p => time - p.born < p.life);
    for (const p of pollenRef.current) {
      const age = time - p.born;
      const t = age / p.life;
      const opacity = 1 - t;
      const px = p.x + Math.sin(age * p.sineFreq) * p.sineAmp * 12 + p.vx * age;
      const py = p.y + p.vy * age;
      const r = p.radius * (1 - t * 0.4);

      const rgb = hexToRgb(p.color);
      ctx.beginPath();
      ctx.arc(px, py, Math.max(r, 0.4), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
      ctx.fill();
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
  } : { r: 255, g: 215, b: 0 };
}
