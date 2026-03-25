/**
 * FlameAuraFilter - Fire particles rising from jawline
 *
 * Geometry:
 * - Particles spawn along the face contour (jawline) points
 * - Each particle rises upward with slight horizontal drift
 * - Particles shrink and fade as they age
 * - Movement intensity: faster head movement = more/bigger particles
 * - Uses 'lighter' composite for additive glow blending
 */

function smooth(prev, curr, factor = 0.7) {
  if (!prev) return curr;
  return {
    x: prev.x * (1 - factor) + curr.x * factor,
    y: prev.y * (1 - factor) + curr.y * factor,
  };
}

// Internal particle pool — persists across frames via module scope
const particles = [];
const COLORS = ['#FF0000', '#FF4500', '#FF6347', '#FFA500', '#FFD700', '#FFFF00'];
const MAX_PARTICLES = 25;
let lastSpawnTime = 0;

function spawnParticle(x, y, intensity) {
  particles.push({
    x,
    y,
    vx: (Math.random() - 0.5) * 2 * intensity,
    vy: -2 - Math.random() * 3 * intensity,
    life: 1.0,
    maxLife: 1.0,
    size: (4 + Math.random() * 6) * intensity,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  });
}

export function drawFlameAuraFilter(ctx, faceData, prevFaceData, time) {
  ctx.save();

  const { landmarks, contour, faceWidth, faceHeight } = faceData;
  const prev = prevFaceData ? prevFaceData.landmarks : null;

  const chinBottom = smooth(prev?.chinBottom, landmarks.chinBottom);
  const leftCheek = smooth(prev?.leftCheek, landmarks.leftCheek);
  const rightCheek = smooth(prev?.rightCheek, landmarks.rightCheek);

  // Calculate head movement speed for intensity
  let intensity = 1.0;
  if (prevFaceData) {
    const dx = landmarks.noseTip.x - prevFaceData.landmarks.noseTip.x;
    const dy = landmarks.noseTip.y - prevFaceData.landmarks.noseTip.y;
    const speed = Math.sqrt(dx * dx + dy * dy);
    // Ramp intensity from 1.0 to 2.5 based on movement speed
    intensity = Math.min(2.5, 1.0 + speed * 0.15);
  }

  // Jawline spawn points: interpolate between leftCheek -> chinBottom -> rightCheek
  const jawPoints = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let px, py;
    if (t <= 0.5) {
      // Left cheek to chin
      const lt = t * 2;
      px = leftCheek.x + (chinBottom.x - leftCheek.x) * lt;
      py = leftCheek.y + (chinBottom.y - leftCheek.y) * lt;
    } else {
      // Chin to right cheek
      const lt = (t - 0.5) * 2;
      px = chinBottom.x + (rightCheek.x - chinBottom.x) * lt;
      py = chinBottom.y + (rightCheek.y - chinBottom.y) * lt;
    }
    jawPoints.push({ x: px, y: py });
  }

  // Use face contour if available for more accurate jawline
  const spawnPoints = (contour && contour.face && contour.face.length > 4)
    ? contour.face
    : jawPoints;

  // Spawn particles along jawline (throttle spawn rate)
  const spawnInterval = Math.max(30, 80 / intensity); // faster spawn when moving
  if (time - lastSpawnTime > spawnInterval && particles.length < MAX_PARTICLES) {
    const point = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    spawnParticle(point.x, point.y, intensity);
    lastSpawnTime = time;

    // Spawn extra particles during fast movement
    if (intensity > 1.5 && particles.length < MAX_PARTICLES) {
      const point2 = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
      spawnParticle(point2.x, point2.y, intensity);
    }
  }

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.98; // gentle drag
    p.vy *= 0.97;
    p.life -= 0.02;
    p.size *= 0.97;

    if (p.life <= 0 || p.size < 0.5) {
      particles.splice(i, 1);
    }
  }

  // Render particles with additive blending
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  particles.forEach((p) => {
    const alpha = p.life * 0.8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);

    // Radial gradient for soft glow per particle
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
    grad.addColorStop(0, p.color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.globalAlpha = alpha;
    ctx.fill();
  });

  ctx.restore();
  ctx.restore();
}
