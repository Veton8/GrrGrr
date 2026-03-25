import React, { useRef, useEffect, useCallback } from 'react';
import { Platform, View } from 'react-native';

export default React.memo(function AnimatedRocket({ size = 60, intensity = 1, style }) {
  if (Platform.OS !== 'web') {
    return <View style={[{ width: size, height: size }, style]} />;
  }

  return <AnimatedRocketCanvas size={size} intensity={intensity} style={style} />;
});

function AnimatedRocketCanvas({ size, intensity, style }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const smokeRef = useRef([]);
  const lastSmokeRef = useRef(0);

  const draw = useCallback((ctx, w, h, dpr, time) => {
    ctx.clearRect(0, 0, w * dpr, h * dpr);
    ctx.save();
    ctx.scale(dpr, dpr);

    const cx = w * 0.5;
    // Hover float
    const hoverY = Math.sin(time * 0.002) * w * 0.04;
    // Horizontal jitter at intensity 3
    const jitterX = intensity >= 3 ? (Math.random() - 0.5) * 2 : 0;

    ctx.save();
    ctx.translate(jitterX, hoverY);

    // Rocket dimensions (centered)
    const bodyW = w * 0.28;
    const bodyH = h * 0.42;
    const bodyTop = h * 0.18;
    const bodyLeft = cx - bodyW / 2;
    const noseH = h * 0.16;
    const noseTop = bodyTop - noseH;

    // --- Speed lines at intensity 3 ---
    if (intensity >= 3) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const lx = cx + (Math.random() - 0.5) * w * 0.6;
        const ly = bodyTop + Math.random() * bodyH * 0.5;
        const len = 8 + Math.random() * 12;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly + len);
        ctx.stroke();
      }
      ctx.restore();
    }

    // --- Smoke particles ---
    const smokeInterval = intensity >= 3 ? 60 : 120;
    const maxSmoke = intensity >= 3 ? 12 : 6;
    if (time - lastSmokeRef.current > smokeInterval && smokeRef.current.length < maxSmoke) {
      smokeRef.current.push({
        x: cx + (Math.random() - 0.5) * bodyW * 0.4,
        y: bodyTop + bodyH + h * 0.08,
        born: time,
        life: 800,
        r: 1.5 + Math.random() * 2,
        dx: (Math.random() - 0.5) * 0.01,
        color: Math.random() > 0.5 ? 153 : 204, // gray shade
      });
      lastSmokeRef.current = time;
    }

    smokeRef.current = smokeRef.current.filter(s => time - s.born < s.life);
    for (const s of smokeRef.current) {
      const age = time - s.born;
      const t = age / s.life;
      const opacity = 0.6 * (1 - t);
      const radius = s.r * (1 + t * 2);
      const px = s.x + s.dx * age;
      const py = s.y + age * 0.04;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${s.color}, ${s.color}, ${s.color}, ${opacity})`;
      ctx.fill();
    }

    // --- Exhaust flame ---
    const flameBaseY = bodyTop + bodyH;
    const flameH = intensity >= 3 ? h * 0.18 : h * 0.12;
    const flameW = bodyW * 0.5;
    const wobble1 = Math.sin(time * 0.008) * flameW * 0.2;
    const wobble2 = Math.sin(time * 0.011 + 1) * flameW * 0.15;

    // Outer flame (orange)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - flameW * 0.5, flameBaseY);
    ctx.quadraticCurveTo(cx - flameW * 0.3 + wobble1, flameBaseY + flameH * 0.5, cx, flameBaseY + flameH);
    ctx.quadraticCurveTo(cx + flameW * 0.3 + wobble2, flameBaseY + flameH * 0.5, cx + flameW * 0.5, flameBaseY);
    ctx.closePath();
    const flameGrad = ctx.createLinearGradient(cx, flameBaseY, cx, flameBaseY + flameH);
    flameGrad.addColorStop(0, '#ff4500');
    flameGrad.addColorStop(0.6, '#ffa500');
    flameGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = flameGrad;
    ctx.fill();
    ctx.restore();

    // Inner flame (yellow)
    ctx.save();
    const innerH = flameH * 0.6;
    const innerW = flameW * 0.4;
    ctx.beginPath();
    ctx.moveTo(cx - innerW * 0.5, flameBaseY);
    ctx.quadraticCurveTo(cx + wobble2 * 0.5, flameBaseY + innerH * 0.5, cx, flameBaseY + innerH);
    ctx.quadraticCurveTo(cx - wobble1 * 0.5, flameBaseY + innerH * 0.5, cx + innerW * 0.5, flameBaseY);
    ctx.closePath();
    const innerGrad = ctx.createLinearGradient(cx, flameBaseY, cx, flameBaseY + innerH);
    innerGrad.addColorStop(0, '#ffd700');
    innerGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = innerGrad;
    ctx.fill();
    ctx.restore();

    // --- Fins ---
    const finH = bodyH * 0.3;
    const finW = bodyW * 0.45;
    const finTop = bodyTop + bodyH - finH;

    // Left fin
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bodyLeft, finTop + finH);
    ctx.lineTo(bodyLeft - finW, finTop + finH + finH * 0.1);
    ctx.lineTo(bodyLeft, finTop);
    ctx.closePath();
    ctx.fillStyle = '#cc0000';
    ctx.fill();
    ctx.restore();

    // Right fin
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bodyLeft + bodyW, finTop + finH);
    ctx.lineTo(bodyLeft + bodyW + finW, finTop + finH + finH * 0.1);
    ctx.lineTo(bodyLeft + bodyW, finTop);
    ctx.closePath();
    ctx.fillStyle = '#cc0000';
    ctx.fill();
    ctx.restore();

    // --- Rocket body (capsule) ---
    ctx.save();
    const bodyR = bodyW * 0.15;
    ctx.beginPath();
    ctx.moveTo(bodyLeft + bodyR, bodyTop);
    ctx.lineTo(bodyLeft + bodyW - bodyR, bodyTop);
    ctx.arcTo(bodyLeft + bodyW, bodyTop, bodyLeft + bodyW, bodyTop + bodyR, bodyR);
    ctx.lineTo(bodyLeft + bodyW, bodyTop + bodyH - bodyR);
    ctx.arcTo(bodyLeft + bodyW, bodyTop + bodyH, bodyLeft + bodyW - bodyR, bodyTop + bodyH, bodyR);
    ctx.lineTo(bodyLeft + bodyR, bodyTop + bodyH);
    ctx.arcTo(bodyLeft, bodyTop + bodyH, bodyLeft, bodyTop + bodyH - bodyR, bodyR);
    ctx.lineTo(bodyLeft, bodyTop + bodyR);
    ctx.arcTo(bodyLeft, bodyTop, bodyLeft + bodyR, bodyTop, bodyR);
    ctx.closePath();
    ctx.fillStyle = '#ff0000';
    ctx.fill();
    ctx.restore();

    // White stripe down the middle
    ctx.save();
    const stripeW = bodyW * 0.22;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - stripeW / 2, bodyTop + bodyH * 0.05, stripeW, bodyH * 0.9);
    ctx.restore();

    // --- Nose cone ---
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, noseTop);
    ctx.quadraticCurveTo(cx + bodyW * 0.55, bodyTop + noseH * 0.4, bodyLeft + bodyW, bodyTop);
    ctx.lineTo(bodyLeft, bodyTop);
    ctx.quadraticCurveTo(cx - bodyW * 0.55, bodyTop + noseH * 0.4, cx, noseTop);
    ctx.closePath();
    ctx.fillStyle = '#ff0000';
    ctx.fill();
    ctx.restore();

    // --- Porthole window ---
    const portR = bodyW * 0.18;
    const portY = bodyTop + bodyH * 0.25;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, portY, portR, 0, Math.PI * 2);
    ctx.fillStyle = '#87ceeb';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, w * 0.02);
    ctx.stroke();
    // Highlight on window
    ctx.beginPath();
    ctx.arc(cx - portR * 0.25, portY - portR * 0.25, portR * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fill();
    ctx.restore();

    ctx.restore(); // end hover/jitter transform

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
