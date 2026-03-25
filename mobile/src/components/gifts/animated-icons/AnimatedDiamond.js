import React, { useRef, useEffect, useCallback } from 'react';
import { Platform, View } from 'react-native';

export default React.memo(function AnimatedDiamond({ size = 60, intensity = 1, style }) {
  if (Platform.OS !== 'web') {
    return <View style={[{ width: size, height: size }, style]} />;
  }

  return <AnimatedDiamondCanvas size={size} intensity={intensity} style={style} />;
});

function AnimatedDiamondCanvas({ size, intensity, style }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const sparklesRef = useRef([]);
  const lastSparkleRef = useRef(0);

  const draw = useCallback((ctx, w, h, dpr, time) => {
    ctx.clearRect(0, 0, w * dpr, h * dpr);
    ctx.save();
    ctx.scale(dpr, dpr);

    // --- Diamond path helper (normalized) ---
    function diamondPath() {
      ctx.beginPath();
      ctx.moveTo(0.2 * w, 0.25 * h);
      ctx.lineTo(0.8 * w, 0.25 * h);
      ctx.lineTo(1.0 * w, 0.45 * h);
      ctx.lineTo(0.5 * w, 1.0 * h);
      ctx.lineTo(0.0 * w, 0.45 * h);
      ctx.closePath();
    }

    // --- 3D rotation simulation ---
    const rotPhase = Math.sin(time * 0.0005 * Math.PI) * 0.1; // ±10% oscillation over ~4s

    // --- Glow at intensity 3 ---
    if (intensity >= 3) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 255, 255, 0.5)';
      ctx.shadowBlur = 18;
      diamondPath();
      ctx.fillStyle = 'rgba(0, 255, 255, 0.12)';
      ctx.fill();
      ctx.restore();
    }

    // --- Diamond body gradient ---
    ctx.save();
    diamondPath();
    const bodyGrad = ctx.createLinearGradient(0.2 * w, 0.25 * h, 0.8 * w, 1.0 * h);
    bodyGrad.addColorStop(0, '#87ceeb');
    bodyGrad.addColorStop(0.45, '#ffffff');
    bodyGrad.addColorStop(1, '#e0ffff');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // --- Diamond outline ---
    ctx.strokeStyle = 'rgba(135, 206, 235, 0.5)';
    ctx.lineWidth = Math.max(1, w * 0.015);
    ctx.stroke();
    ctx.restore();

    // --- Internal facet lines ---
    const facetTopXs = [0.35, 0.5, 0.65];
    const facetBottomX = 0.5;
    const facetBottomY = 1.0;
    ctx.save();
    ctx.strokeStyle = 'rgba(135, 206, 235, 0.45)';
    ctx.lineWidth = Math.max(0.5, w * 0.01);

    // Top-left corner to bottom
    ctx.beginPath();
    ctx.moveTo((0.2 + rotPhase * 0.3) * w, 0.25 * h);
    ctx.lineTo(facetBottomX * w, facetBottomY * h);
    ctx.stroke();

    // Top-right corner to bottom
    ctx.beginPath();
    ctx.moveTo((0.8 + rotPhase * 0.3) * w, 0.25 * h);
    ctx.lineTo(facetBottomX * w, facetBottomY * h);
    ctx.stroke();

    // Interior facet lines (3 lines from top-edge positions)
    for (let i = 0; i < facetTopXs.length; i++) {
      const baseX = facetTopXs[i];
      const shiftedX = baseX + rotPhase * (0.5 - baseX) * 2;
      ctx.beginPath();
      ctx.moveTo(shiftedX * w, 0.25 * h);
      ctx.lineTo(facetBottomX * w, facetBottomY * h);
      ctx.stroke();
    }

    // Horizontal girdle line
    ctx.beginPath();
    ctx.moveTo(0.0 * w, 0.45 * h);
    ctx.lineTo(1.0 * w, 0.45 * h);
    ctx.stroke();

    ctx.restore();

    // --- Highlight sweep ---
    ctx.save();
    diamondPath();
    ctx.clip();

    const sweepSpeed = intensity >= 3 ? 0.0008 : 0.0005;
    const sweepT = ((time * sweepSpeed) % 1.4) - 0.2; // 0→1.2 range with padding
    const sweepX = sweepT * w * 1.4 - w * 0.2;
    const bandWidth = w * 0.2;

    ctx.save();
    ctx.translate(sweepX, h * 0.5);
    ctx.rotate(-Math.PI / 4);
    const sweepGrad = ctx.createLinearGradient(-bandWidth, 0, bandWidth, 0);
    sweepGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    sweepGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.7)');
    sweepGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sweepGrad;
    ctx.fillRect(-bandWidth, -h, bandWidth * 2, h * 2);
    ctx.restore();

    ctx.restore();

    // --- Sparkle management ---
    const maxSparkles = intensity >= 3 ? 6 : 2;
    const spawnMin = intensity >= 3 ? 300 : 800;
    const spawnMax = intensity >= 3 ? 600 : 1200;
    const spawnInterval = spawnMin + Math.random() * (spawnMax - spawnMin);

    if (time - lastSparkleRef.current > spawnInterval && sparklesRef.current.length < maxSparkles) {
      // Sparkle at a facet intersection
      const positions = [
        { x: 0.2, y: 0.25 }, { x: 0.5, y: 0.25 }, { x: 0.8, y: 0.25 },
        { x: 0.0, y: 0.45 }, { x: 1.0, y: 0.45 }, { x: 0.5, y: 1.0 },
        { x: 0.35, y: 0.25 }, { x: 0.65, y: 0.25 },
      ];
      const pos = positions[Math.floor(Math.random() * positions.length)];
      sparklesRef.current.push({
        x: pos.x * w,
        y: pos.y * h,
        born: time,
        life: 300,
        maxR: 2 + Math.random() * 2.5,
        color: Math.random() > 0.5 ? '#ffffff' : '#87ceeb',
      });
      lastSparkleRef.current = time;
    }

    // Draw sparkles (4-pointed star)
    sparklesRef.current = sparklesRef.current.filter(s => time - s.born < s.life);
    for (const s of sparklesRef.current) {
      const age = time - s.born;
      const t = age / s.life;
      const scale = t < 0.5 ? t * 2 : 2 - t * 2; // 0→1→0
      const r = s.maxR * scale;
      if (r <= 0) continue;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.fillStyle = s.color;
      ctx.globalAlpha = scale;

      // 4-pointed star
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
