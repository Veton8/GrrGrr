/**
 * SparkleFrameFilter - Star particles orbiting the face with trail effect
 *
 * Geometry:
 * - 10 star particles orbit in an elliptical path around the face
 * - Orbit ellipse = face bounds scaled to 1.3x, centered on face center
 * - Each star is a 5-pointed shape drawn with canvas path
 * - Colors cycle through hue rotation based on time
 * - Each star stores 4 previous positions for trail rendering
 * - Opacity twinkles via sin(time + index)
 */

function smooth(prev, curr, factor = 0.7) {
  if (!prev) return curr;
  return {
    x: prev.x * (1 - factor) + curr.x * factor,
    y: prev.y * (1 - factor) + curr.y * factor,
  };
}

// Pre-generated orbit particles with random properties
const NUM_STARS = 10;
const TRAIL_LENGTH = 4;

const stars = Array.from({ length: NUM_STARS }, (_, i) => ({
  angleOffset: (Math.PI * 2 / NUM_STARS) * i,
  speedMult: 0.8 + Math.random() * 0.4, // slight speed variation
  size: 8 + Math.random() * 7, // 8-15px
  trail: [], // stores previous {x, y} positions
}));

/**
 * Draw a 5-pointed star centered at (0, 0) with given outer radius.
 * Inner radius is ~40% of outer for a classic star look.
 */
function drawStar(ctx, outerR) {
  const innerR = outerR * 0.4;
  const points = 5;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    // Rotate so top point faces up (-PI/2 offset)
    const a = (Math.PI * 2 / (points * 2)) * i - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function drawSparkleFrameFilter(ctx, faceData, prevFaceData, time) {
  ctx.save();

  const { landmarks, bounds, faceWidth, faceHeight } = faceData;
  const prev = prevFaceData ? prevFaceData.landmarks : null;

  const leftEye = smooth(prev?.leftEye, landmarks.leftEye);
  const rightEye = smooth(prev?.rightEye, landmarks.rightEye);
  const mouthCenter = smooth(prev?.mouthCenter, landmarks.mouthCenter);

  // Face center
  const cx = (leftEye.x + rightEye.x) / 2;
  const cy = (leftEye.y + rightEye.y + mouthCenter.y) / 3;

  // Orbit ellipse: 1.3x face dimensions
  const orbitRX = faceWidth * 0.65; // half-width * 1.3
  const orbitRY = faceHeight * 0.65;

  // Head rotation for orbit tilt
  const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

  stars.forEach((star, i) => {
    // Orbit angle for this star
    const orbitAngle = time * 0.001 * star.speedMult + star.angleOffset;

    // Position on ellipse (in rotated space)
    const localX = Math.cos(orbitAngle) * orbitRX;
    const localY = Math.sin(orbitAngle) * orbitRY;

    // Rotate with head
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const worldX = cx + localX * cosA - localY * sinA;
    const worldY = cy + localX * sinA + localY * cosA;

    // Update trail (push current, trim to max length)
    star.trail.push({ x: worldX, y: worldY });
    if (star.trail.length > TRAIL_LENGTH) {
      star.trail.shift();
    }

    // Twinkle opacity
    const twinkle = Math.sin(time * 0.005 + i) * 0.3 + 0.7;

    // Hue rotation: each star gets a different hue, cycling over time
    const hue = (time * 0.05 + i * (360 / NUM_STARS)) % 360;

    // --- Draw trail (previous positions with decreasing opacity) ---
    star.trail.forEach((tp, ti) => {
      const trailAlpha = ((ti + 1) / star.trail.length) * 0.3 * twinkle;
      const trailSize = star.size * ((ti + 1) / star.trail.length) * 0.6;

      ctx.save();
      ctx.translate(tp.x, tp.y);
      ctx.rotate(time * 0.002); // gentle spin
      ctx.globalAlpha = trailAlpha;
      ctx.fillStyle = `hsla(${hue}, 100%, 70%, 1)`;
      drawStar(ctx, trailSize);
      ctx.fill();
      ctx.restore();
    });

    // --- Draw main star ---
    ctx.save();
    ctx.translate(worldX, worldY);
    ctx.rotate(time * 0.002 + i); // individual spin
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = `hsl(${hue}, 100%, 70%)`;
    drawStar(ctx, star.size);
    ctx.fill();

    // White center highlight
    ctx.globalAlpha = twinkle * 0.6;
    ctx.fillStyle = '#FFF';
    drawStar(ctx, star.size * 0.3);
    ctx.fill();

    ctx.restore();
  });

  ctx.restore();
}
