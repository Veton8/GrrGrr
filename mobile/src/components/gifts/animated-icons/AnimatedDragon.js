import React, { useRef, useEffect, useCallback } from 'react';
import { Platform, View } from 'react-native';

export default React.memo(function AnimatedDragon({ size = 60, intensity = 1, style }) {
  if (Platform.OS !== 'web') {
    return <View style={[{ width: size, height: size }, style]} />;
  }

  return <AnimatedDragonCanvas size={size} intensity={intensity} style={style} />;
});

function AnimatedDragonCanvas({ size, intensity, style }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const nostrilFlamesRef = useRef([]);
  const lastFlameRef = useRef({ left: 0, right: 0 });

  // Pre-generate scale shimmer positions
  const scaleDotsRef = useRef(null);
  if (!scaleDotsRef.current) {
    const dots = [];
    const count = 10;
    for (let i = 0; i < count; i++) {
      dots.push({
        // Positions across the head surface (normalized)
        nx: 0.3 + Math.random() * 0.4,
        ny: 0.25 + Math.random() * 0.45,
        phaseOffset: (i / count) * Math.PI * 2,
      });
    }
    scaleDotsRef.current = dots;
  }

  const draw = useCallback((ctx, w, h, dpr, time) => {
    ctx.clearRect(0, 0, w * dpr, h * dpr);
    ctx.save();
    ctx.scale(dpr, dpr);

    const cx = w * 0.5;
    const cy = h * 0.5;

    // --- Intensity 3: red glow behind head ---
    if (intensity >= 3) {
      ctx.save();
      const glowR = w * 0.48;
      const glow = ctx.createRadialGradient(cx, cy, w * 0.15, cx, cy, glowR);
      glow.addColorStop(0, 'rgba(139, 0, 0, 0.25)');
      glow.addColorStop(1, 'rgba(139, 0, 0, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.restore();
    }

    // --- Horns ---
    const hornColors = (x1, y1, x2, y2) => {
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, '#B8860B');
      g.addColorStop(1, '#FFD700');
      return g;
    };

    // Left horn
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w * 0.3, h * 0.28);
    ctx.quadraticCurveTo(w * 0.18, h * 0.08, w * 0.22, h * 0.02);
    ctx.quadraticCurveTo(w * 0.28, h * 0.12, w * 0.36, h * 0.26);
    ctx.closePath();
    ctx.fillStyle = hornColors(w * 0.22, h * 0.02, w * 0.3, h * 0.28);
    ctx.fill();
    ctx.restore();

    // Right horn
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w * 0.7, h * 0.28);
    ctx.quadraticCurveTo(w * 0.82, h * 0.08, w * 0.78, h * 0.02);
    ctx.quadraticCurveTo(w * 0.72, h * 0.12, w * 0.64, h * 0.26);
    ctx.closePath();
    ctx.fillStyle = hornColors(w * 0.78, h * 0.02, w * 0.7, h * 0.28);
    ctx.fill();
    ctx.restore();

    // --- Head shape (angular/triangular) ---
    ctx.save();
    ctx.beginPath();
    // Top of head
    ctx.moveTo(w * 0.3, h * 0.25);
    ctx.lineTo(w * 0.7, h * 0.25);
    // Right side angled down
    ctx.quadraticCurveTo(w * 0.78, h * 0.35, w * 0.75, h * 0.5);
    // Right jaw
    ctx.quadraticCurveTo(w * 0.7, h * 0.65, w * 0.6, h * 0.72);
    // Snout/chin
    ctx.quadraticCurveTo(cx, h * 0.82, w * 0.4, h * 0.72);
    // Left jaw
    ctx.quadraticCurveTo(w * 0.3, h * 0.65, w * 0.25, h * 0.5);
    // Left side angled up
    ctx.quadraticCurveTo(w * 0.22, h * 0.35, w * 0.3, h * 0.25);
    ctx.closePath();

    const headGrad = ctx.createLinearGradient(w * 0.25, h * 0.25, w * 0.75, h * 0.75);
    headGrad.addColorStop(0, '#8B0000');
    headGrad.addColorStop(0.5, '#A00000');
    headGrad.addColorStop(1, '#6B0000');
    ctx.fillStyle = headGrad;
    ctx.fill();
    ctx.restore();

    // --- Gold ridge accents ---
    ctx.save();
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = Math.max(1, w * 0.015);
    ctx.globalAlpha = 0.6;
    // Center ridge
    ctx.beginPath();
    ctx.moveTo(cx, h * 0.25);
    ctx.quadraticCurveTo(cx, h * 0.45, cx, h * 0.55);
    ctx.stroke();
    // Side ridges
    ctx.beginPath();
    ctx.moveTo(w * 0.37, h * 0.27);
    ctx.quadraticCurveTo(w * 0.35, h * 0.4, w * 0.38, h * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.63, h * 0.27);
    ctx.quadraticCurveTo(w * 0.65, h * 0.4, w * 0.62, h * 0.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    // --- Eyes ---
    const eyeY = h * 0.4;
    const eyeSpacing = w * 0.14;

    for (const side of [-1, 1]) {
      const ex = cx + side * eyeSpacing;

      // Pulsing glow behind eye
      const glowOp = 0.3 + Math.sin(time * 0.004 + side) * 0.2;
      ctx.save();
      const eyeGlow = ctx.createRadialGradient(ex, eyeY, 0, ex, eyeY, w * 0.08);
      eyeGlow.addColorStop(0, `rgba(255, 140, 0, ${intensity >= 3 ? glowOp + 0.2 : glowOp})`);
      eyeGlow.addColorStop(1, 'rgba(255, 140, 0, 0)');
      ctx.beginPath();
      ctx.arc(ex, eyeY, w * 0.08, 0, Math.PI * 2);
      ctx.fillStyle = eyeGlow;
      ctx.fill();
      ctx.restore();

      // Almond eye
      const eyeW = w * 0.07;
      const eyeH = w * 0.03;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ex - eyeW, eyeY);
      ctx.quadraticCurveTo(ex, eyeY - eyeH * 1.8, ex + eyeW, eyeY);
      ctx.quadraticCurveTo(ex, eyeY + eyeH * 1.8, ex - eyeW, eyeY);
      ctx.closePath();
      ctx.fillStyle = '#FF8C00';
      ctx.fill();

      // Slit pupil
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeW * 0.12, eyeH * 1.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.restore();
    }

    // --- Nostrils ---
    const snoutY = h * 0.62;
    const nostrilSpacing = w * 0.06;

    for (const side of [-1, 1]) {
      const nx = cx + side * nostrilSpacing;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(nx, snoutY, w * 0.025, w * 0.02, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#3B0000';
      ctx.fill();
      ctx.restore();
    }

    // --- Nostril flames ---
    const flameInterval = intensity >= 3 ? 250 : 500;
    const maxFlames = intensity >= 3 ? 12 : 5;
    const flameColors = ['#ff4500', '#ff6347', '#ffa500'];

    for (const side of [-1, 1]) {
      const key = side === -1 ? 'left' : 'right';
      const nx = cx + side * nostrilSpacing;

      if (time - lastFlameRef.current[key] > flameInterval + Math.random() * 200 && nostrilFlamesRef.current.length < maxFlames) {
        for (let i = 0; i < (intensity >= 3 ? 3 : 2); i++) {
          nostrilFlamesRef.current.push({
            x: nx + (Math.random() - 0.5) * w * 0.02,
            y: snoutY,
            born: time + i * 50,
            life: 600,
            dx: side * 0.01 + (Math.random() - 0.5) * 0.005,
            dy: -0.015 - Math.random() * 0.01,
            r: 1 + Math.random() * 1.5,
            color: flameColors[Math.floor(Math.random() * flameColors.length)],
          });
        }
        lastFlameRef.current[key] = time;
      }
    }

    nostrilFlamesRef.current = nostrilFlamesRef.current.filter(f => time - f.born < f.life && time >= f.born);
    for (const f of nostrilFlamesRef.current) {
      const age = time - f.born;
      if (age < 0) continue;
      const t = age / f.life;
      const opacity = 1 - t;
      const px = f.x + f.dx * age;
      const py = f.y + f.dy * age;
      const r = f.r * (1 - t * 0.5);

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = f.color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // --- Scale shimmer (traveling wave) ---
    const shimmerSpeed = intensity >= 3 ? 0.012 : 0.006;
    const dots = scaleDotsRef.current;
    for (const d of dots) {
      const wave = Math.sin(time * shimmerSpeed + d.phaseOffset);
      // Only bright during the peak of the wave
      const brightness = Math.max(0, wave);
      if (brightness < 0.1) continue;

      const opacity = brightness * 0.8;
      const dx = d.nx * w;
      const dy = d.ny * h;

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.arc(dx, dy, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#FFD700';
      ctx.fill();
      ctx.globalAlpha = 1;
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
