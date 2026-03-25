import React, { useRef, useEffect, useCallback } from 'react';
import { Platform, View } from 'react-native';

export default function AnimatedHeart({ size = 60, intensity = 1, style }) {
  if (Platform.OS !== 'web') {
    // TODO: Skia implementation for native
    return <View style={[{ width: size, height: size }, style]} />;
  }

  return <AnimatedHeartCanvas size={size} intensity={intensity} style={style} />;
}

function AnimatedHeartCanvas({ size, intensity, style }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const sparklesRef = useRef([]);
  const lastSparkleRef = useRef(0);

  const draw = useCallback((ctx, w, h, dpr, time) => {
    ctx.clearRect(0, 0, w * dpr, h * dpr);
    ctx.save();
    ctx.scale(dpr, dpr);

    const cx = w / 2;
    const cy = h / 2;

    // Pulse
    const pulseAmp = intensity >= 3 ? 0.1 : 0.05;
    const pulseBase = intensity >= 3 ? 0.9 : 0.95;
    const scale = pulseBase + Math.sin(time * 0.003) * pulseAmp + pulseAmp;

    // Sparkle spawning
    const maxSparkles = intensity >= 3 ? 8 : 3;
    const spawnInterval = intensity >= 3 ? 400 : 800;
    if (time - lastSparkleRef.current > spawnInterval && sparklesRef.current.length < maxSparkles) {
      const angle = Math.random() * Math.PI * 2;
      const edgeDist = w * 0.3;
      sparklesRef.current.push({
        x: cx + Math.cos(angle) * edgeDist * 0.6,
        y: cy + Math.sin(angle) * edgeDist * 0.5,
        dx: Math.cos(angle) * (15 + Math.random() * 10) / 500,
        dy: Math.sin(angle) * (15 + Math.random() * 10) / 500,
        born: time,
        life: 500,
        radius: 1.5 + Math.random() * 2,
      });
      lastSparkleRef.current = time;
    }

    // Update and draw sparkles
    sparklesRef.current = sparklesRef.current.filter(s => time - s.born < s.life);
    for (const s of sparklesRef.current) {
      const age = time - s.born;
      const t = age / s.life;
      const opacity = 1 - t;
      const px = s.x + s.dx * age;
      const py = s.y + s.dy * age;
      ctx.beginPath();
      ctx.arc(px, py, s.radius * (1 - t * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 105, 180, ${opacity})`;
      ctx.fill();
    }

    // Glow at intensity 3
    if (intensity >= 3) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.shadowColor = 'rgba(255, 20, 147, 0.6)';
      ctx.shadowBlur = 20;
      drawHeartPath(ctx, w);
      ctx.fillStyle = 'rgba(255, 20, 147, 0.15)';
      ctx.fill();
      ctx.restore();
    }

    // Heart
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    drawHeartPath(ctx, w);

    const grad = ctx.createRadialGradient(0, w * 0.05, 0, 0, w * 0.05, w * 0.45);
    grad.addColorStop(0, '#ff1493');
    grad.addColorStop(1, '#ff0044');
    ctx.fillStyle = grad;

    if (intensity >= 3) {
      ctx.shadowColor = 'rgba(255, 20, 147, 0.5)';
      ctx.shadowBlur = 15;
    }

    ctx.fill();
    ctx.restore();

    // Highlight / shine
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.ellipse(-w * 0.12, -w * 0.12, w * 0.06, w * 0.04, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fill();
    ctx.restore();

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

function drawHeartPath(ctx, w) {
  const s = w;
  const ox = -s / 2;
  const oy = -s / 2;
  ctx.beginPath();
  ctx.moveTo(ox + 0.5 * s, oy + 0.2 * s);
  ctx.bezierCurveTo(
    ox + 0.5 * s, oy + 0.1 * s,
    ox + 0.3 * s, oy + 0.0 * s,
    ox + 0.15 * s, oy + 0.15 * s
  );
  ctx.bezierCurveTo(
    ox + 0.0 * s, oy + 0.3 * s,
    ox + 0.0 * s, oy + 0.55 * s,
    ox + 0.5 * s, oy + 0.95 * s
  );
  ctx.bezierCurveTo(
    ox + 1.0 * s, oy + 0.55 * s,
    ox + 1.0 * s, oy + 0.3 * s,
    ox + 0.85 * s, oy + 0.15 * s
  );
  ctx.bezierCurveTo(
    ox + 0.7 * s, oy + 0.0 * s,
    ox + 0.5 * s, oy + 0.1 * s,
    ox + 0.5 * s, oy + 0.2 * s
  );
  ctx.closePath();
}
