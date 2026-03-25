/**
 * DevilFilter - Curved horns, eye glow, and fire particles
 *
 * Geometry:
 * - Horns are bezier curves rising from above the forehead, curving outward
 * - Each horn base starts at ~0.3 * faceWidth from center, tip curves outward/upward
 * - Red glow: radial gradient circles behind each eye
 * - Fire particles: small dots rising from horn tips, fading out
 */

function smooth(prev, curr, factor = 0.7) {
  if (!prev) return curr;
  return {
    x: prev.x * (1 - factor) + curr.x * factor,
    y: prev.y * (1 - factor) + curr.y * factor,
  };
}

// Persistent particle state for horn-tip fire
const particles = [];
const MAX_PARTICLES = 12; // 4-6 per horn

function updateParticles(time, leftTipX, leftTipY, rightTipX, rightTipY) {
  // Spawn new particles from horn tips
  if (particles.length < MAX_PARTICLES) {
    const fromLeft = Math.random() > 0.5;
    particles.push({
      x: fromLeft ? leftTipX : rightTipX,
      y: fromLeft ? leftTipY : rightTipY,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -1 - Math.random() * 1.5,
      life: 1.0,
      size: 2 + Math.random() * 3,
      spawnTime: time,
    });
  }

  // Update existing particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.025;
    p.size *= 0.98;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

export function drawDevilFilter(ctx, faceData, prevFaceData, time) {
  ctx.save();

  const { landmarks, faceWidth, faceHeight } = faceData;
  const prev = prevFaceData ? prevFaceData.landmarks : null;

  const leftEye = smooth(prev?.leftEye, landmarks.leftEye);
  const rightEye = smooth(prev?.rightEye, landmarks.rightEye);
  const foreheadCenter = smooth(prev?.foreheadCenter, landmarks.foreheadCenter);

  const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  const hornHeight = faceHeight * 0.4;
  const hornBaseWidth = faceWidth * 0.08;

  // --- Draw horn helper ---
  function drawHorn(baseX, baseY, direction) {
    // direction: -1 for left horn, 1 for right horn
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(angle);

    const grad = ctx.createLinearGradient(0, 0, 0, -hornHeight);
    grad.addColorStop(0, '#8B0000');
    grad.addColorStop(1, '#FF0000');
    ctx.fillStyle = grad;

    // Horn shape: thick at base, curving to a point
    ctx.beginPath();
    ctx.moveTo(-hornBaseWidth, 0);
    ctx.bezierCurveTo(
      -hornBaseWidth * 0.8, -hornHeight * 0.4,
      direction * hornBaseWidth * 2, -hornHeight * 0.7,
      direction * hornBaseWidth * 1.5, -hornHeight
    );
    ctx.bezierCurveTo(
      direction * hornBaseWidth * 0.5, -hornHeight * 0.8,
      hornBaseWidth * 0.8, -hornHeight * 0.3,
      hornBaseWidth, 0
    );
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Return tip position in world coords for particles
    const tipLocalX = direction * hornBaseWidth * 1.5;
    const tipLocalY = -hornHeight;
    return {
      x: baseX + tipLocalX * cosA - tipLocalY * sinA,
      y: baseY + tipLocalX * sinA + tipLocalY * cosA,
    };
  }

  // Horn base positions above forehead
  const hornOffsetX = faceWidth * 0.3;
  const hornOffsetY = faceHeight * 0.15;

  const leftBaseX = foreheadCenter.x - hornOffsetX * cosA + hornOffsetY * sinA;
  const leftBaseY = foreheadCenter.y - hornOffsetX * sinA - hornOffsetY * cosA;
  const rightBaseX = foreheadCenter.x + hornOffsetX * cosA + hornOffsetY * sinA;
  const rightBaseY = foreheadCenter.y + hornOffsetX * sinA - hornOffsetY * cosA;

  const leftTip = drawHorn(leftBaseX, leftBaseY, -1);
  const rightTip = drawHorn(rightBaseX, rightBaseY, 1);

  // --- Red glow behind eyes ---
  const glowRadius = faceWidth * 0.12;

  [leftEye, rightEye].forEach((eye) => {
    const glow = ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, glowRadius);
    glow.addColorStop(0, 'rgba(255, 0, 0, 0.2)');
    glow.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
  });

  // --- Fire particles from horn tips ---
  updateParticles(time, leftTip.x, leftTip.y, rightTip.x, rightTip.y);

  particles.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    // Orange-red color fading out
    ctx.fillStyle = `rgba(255, ${Math.floor(100 + p.life * 100)}, 0, ${p.life * 0.8})`;
    ctx.fill();
  });

  ctx.restore();
}
