/**
 * CrownFilter - Golden crown with jewels and sparkles
 *
 * Geometry:
 * - Crown sits above forehead, width matches ~faceWidth * 1.1
 * - Crown shape: 5-pointed zigzag top with flat bottom band
 * - Jewels: colored circles placed along the crown band
 * - Sparkles: small dots with oscillating opacity around the crown
 */

function smooth(prev, curr, factor = 0.7) {
  if (!prev) return curr;
  return {
    x: prev.x * (1 - factor) + curr.x * factor,
    y: prev.y * (1 - factor) + curr.y * factor,
  };
}

// Pre-generate sparkle positions (random offsets, seeded once)
const sparkles = Array.from({ length: 8 }, (_, i) => ({
  offsetX: (Math.random() - 0.5) * 2, // -1 to 1, scaled to crown width later
  offsetY: -Math.random() * 0.8 - 0.2, // above crown
  phase: Math.random() * Math.PI * 2,
  size: 2 + Math.random() * 2.5,
}));

export function drawCrownFilter(ctx, faceData, prevFaceData, time) {
  ctx.save();

  const { landmarks, faceWidth, faceHeight } = faceData;
  const prev = prevFaceData ? prevFaceData.landmarks : null;

  const leftEye = smooth(prev?.leftEye, landmarks.leftEye);
  const rightEye = smooth(prev?.rightEye, landmarks.rightEye);
  const foreheadCenter = smooth(prev?.foreheadCenter, landmarks.foreheadCenter);

  // Head rotation
  const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

  const crownWidth = faceWidth * 1.1;
  const crownHeight = faceHeight * 0.35;
  const bandHeight = crownHeight * 0.3; // bottom band of the crown

  // Crown center is above forehead
  const crownX = foreheadCenter.x;
  const crownY = foreheadCenter.y - faceHeight * 0.32;

  ctx.save();
  ctx.translate(crownX, crownY);
  ctx.rotate(angle);

  // --- Crown shape path with 5 points ---
  const halfW = crownWidth / 2;
  const points = 5;
  const grad = ctx.createLinearGradient(0, -crownHeight, 0, 0);
  grad.addColorStop(0, '#FFD700');
  grad.addColorStop(1, '#DAA520');
  ctx.fillStyle = grad;

  ctx.beginPath();
  // Start at bottom-left of crown
  ctx.moveTo(-halfW, 0);

  // Zigzag top: alternating peaks and valleys
  for (let i = 0; i <= points; i++) {
    const x = -halfW + (crownWidth / points) * i;
    if (i < points) {
      // Valley
      const midX = x + (crownWidth / points) * 0.5;
      ctx.lineTo(midX, -crownHeight); // peak
      ctx.lineTo(x + crownWidth / points, -crownHeight * 0.55); // valley
    }
  }

  // Bottom-right, then close along bottom
  ctx.lineTo(halfW, 0);
  ctx.closePath();
  ctx.fill();

  // Crown band (bottom strip)
  ctx.fillStyle = '#DAA520';
  ctx.fillRect(-halfW, -bandHeight, crownWidth, bandHeight);

  // Band border lines
  ctx.strokeStyle = '#B8860B';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-halfW, 0);
  ctx.lineTo(halfW, 0);
  ctx.moveTo(-halfW, -bandHeight);
  ctx.lineTo(halfW, -bandHeight);
  ctx.stroke();

  // --- Jewels on the band ---
  const jewelColors = ['#FF0000', '#4169E1', '#FF0000', '#4169E1', '#FF0000'];
  const jewelRadius = Math.max(3, faceWidth * 0.02);
  jewelColors.forEach((color, i) => {
    const jx = -halfW * 0.7 + ((halfW * 1.4) / (jewelColors.length - 1)) * i;
    const jy = -bandHeight * 0.5;
    ctx.beginPath();
    ctx.arc(jx, jy, jewelRadius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    // Tiny highlight
    ctx.beginPath();
    ctx.arc(jx - jewelRadius * 0.25, jy - jewelRadius * 0.25, jewelRadius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();
  });

  // --- Sparkle dots around crown ---
  sparkles.forEach((sp) => {
    const sx = sp.offsetX * halfW;
    const sy = sp.offsetY * crownHeight;
    // Opacity oscillates using sin(time + phase)
    const opacity = 0.3 + 0.7 * Math.abs(Math.sin(time * 0.003 + sp.phase));
    ctx.beginPath();
    ctx.arc(sx, sy, sp.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.fill();
  });

  ctx.restore();
  ctx.restore();
}
