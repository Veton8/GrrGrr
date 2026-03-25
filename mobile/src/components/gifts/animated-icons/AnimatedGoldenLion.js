import React, { useRef, useEffect, useCallback } from 'react';
import { Platform, View } from 'react-native';

export default React.memo(function AnimatedGoldenLion({ size = 60, intensity = 1, style }) {
  if (Platform.OS !== 'web') {
    return <View style={[{ width: size, height: size }, style]} />;
  }

  return <AnimatedGoldenLionCanvas size={size} intensity={intensity} style={style} />;
});

function AnimatedGoldenLionCanvas({ size, intensity, style }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const sparklesRef = useRef([]);
  const lastSparkleRef = useRef(0);

  // Pre-generate mane strand configs once
  const maneStrandsRef = useRef(null);
  if (!maneStrandsRef.current) {
    const count = 14;
    const strands = [];
    const colors = ['#FFD700', '#B8860B', '#FF8C00'];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 - Math.PI * 0.5;
      strands.push({
        angle,
        color: colors[i % colors.length],
        lengthMul: 0.85 + Math.random() * 0.3,
        widthMul: 0.8 + Math.random() * 0.4,
        phaseOffset: i * 0.4,
      });
    }
    maneStrandsRef.current = strands;
  }

  const draw = useCallback((ctx, w, h, dpr, time) => {
    ctx.clearRect(0, 0, w * dpr, h * dpr);
    ctx.save();
    ctx.scale(dpr, dpr);

    const cx = w * 0.5;
    const cy = h * 0.52;
    const faceR = w * 0.2;

    // --- Intensity 3: golden glow behind head ---
    if (intensity >= 3) {
      ctx.save();
      const glowR = w * 0.46;
      const glow = ctx.createRadialGradient(cx, cy, faceR, cx, cy, glowR);
      glow.addColorStop(0, 'rgba(255, 215, 0, 0.25)');
      glow.addColorStop(1, 'rgba(255, 215, 0, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.restore();
    }

    // --- Mane strands ---
    const strands = maneStrandsRef.current;
    const swayAmp = intensity >= 3 ? w * 0.06 : w * 0.03;

    for (const s of strands) {
      const sway = Math.sin(time * 0.003 + s.phaseOffset) * swayAmp;

      const baseR = faceR * 0.85;
      const startX = cx + Math.cos(s.angle) * baseR;
      const startY = cy + Math.sin(s.angle) * baseR;

      const strandLen = faceR * 1.3 * s.lengthMul;
      const endX = cx + Math.cos(s.angle) * (baseR + strandLen) + sway;
      const endY = cy + Math.sin(s.angle) * (baseR + strandLen) + sway * 0.3;

      // Perpendicular for width
      const perpX = -Math.sin(s.angle);
      const perpY = Math.cos(s.angle);
      const halfW = faceR * 0.22 * s.widthMul;

      // Teardrop/flame shape using bezier
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(startX + perpX * halfW, startY + perpY * halfW);
      ctx.quadraticCurveTo(
        (startX + endX) * 0.5 + perpX * halfW * 1.2 + sway * 0.3,
        (startY + endY) * 0.5 + perpY * halfW * 1.2,
        endX, endY
      );
      ctx.quadraticCurveTo(
        (startX + endX) * 0.5 - perpX * halfW * 1.2 + sway * 0.3,
        (startY + endY) * 0.5 - perpY * halfW * 1.2,
        startX - perpX * halfW, startY - perpY * halfW
      );
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.restore();
    }

    // --- Face ---
    ctx.save();
    const faceGrad = ctx.createRadialGradient(cx - faceR * 0.2, cy - faceR * 0.2, 0, cx, cy, faceR);
    faceGrad.addColorStop(0, '#DAA520');
    faceGrad.addColorStop(0.7, '#DAA520');
    faceGrad.addColorStop(1, '#B8860B');
    ctx.beginPath();
    ctx.ellipse(cx, cy, faceR, faceR * 1.05, 0, 0, Math.PI * 2);
    ctx.fillStyle = faceGrad;
    ctx.fill();
    ctx.restore();

    // --- Eyes ---
    const eyeY = cy - faceR * 0.15;
    const eyeSpacing = faceR * 0.42;
    const eyeW = faceR * 0.22;
    const eyeH = faceR * 0.12;

    // Eye glow pulse
    const glowPulse = 0.4 + Math.sin(time * 0.004) * 0.3;

    for (const side of [-1, 1]) {
      const ex = cx + side * eyeSpacing;

      // Glow
      ctx.save();
      ctx.shadowColor = `rgba(255, 215, 0, ${glowPulse})`;
      ctx.shadowBlur = intensity >= 3 ? 8 : 4;

      // Almond eye shape
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#FFD700';
      ctx.fill();

      // Pupil
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeW * 0.35, eyeH * 0.8, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.restore();
    }

    // --- Nose ---
    ctx.save();
    const noseY = cy + faceR * 0.2;
    ctx.beginPath();
    ctx.moveTo(cx, noseY - faceR * 0.06);
    ctx.lineTo(cx - faceR * 0.08, noseY + faceR * 0.06);
    ctx.lineTo(cx + faceR * 0.08, noseY + faceR * 0.06);
    ctx.closePath();
    ctx.fillStyle = '#5C3317';
    ctx.fill();
    ctx.restore();

    // --- Mouth ---
    ctx.save();
    const mouthY = noseY + faceR * 0.15;
    ctx.beginPath();
    ctx.moveTo(cx - faceR * 0.12, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + faceR * 0.08, cx + faceR * 0.12, mouthY);
    ctx.strokeStyle = '#5C3317';
    ctx.lineWidth = Math.max(0.5, w * 0.01);
    ctx.stroke();
    ctx.restore();

    // --- Sparkles in mane ---
    const maxSparkles = intensity >= 3 ? 4 : 1;
    const spawnMin = intensity >= 3 ? 400 : 1000;
    const spawnMax = intensity >= 3 ? 800 : 2000;

    if (time - lastSparkleRef.current > spawnMin + Math.random() * (spawnMax - spawnMin) && sparklesRef.current.length < maxSparkles) {
      const angle = Math.random() * Math.PI * 2;
      const dist = faceR * (1.2 + Math.random() * 0.8);
      sparklesRef.current.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        born: time,
        life: 400,
        maxR: 2.5 + Math.random() * 2,
      });
      lastSparkleRef.current = time;
    }

    sparklesRef.current = sparklesRef.current.filter(s => time - s.born < s.life);
    for (const s of sparklesRef.current) {
      const age = time - s.born;
      const t = age / s.life;
      const scale = t < 0.5 ? t * 2 : 2 - t * 2;
      const r = s.maxR * scale;
      if (r <= 0) continue;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = scale;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.25, -r * 0.25);
      ctx.lineTo(r, 0);
      ctx.lineTo(r * 0.25, r * 0.25);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.25, r * 0.25);
      ctx.lineTo(-r, 0);
      ctx.lineTo(-r * 0.25, -r * 0.25);
      ctx.closePath();
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
