/**
 * SunglassesFilter - Dark lenses, frame, and lens flare
 *
 * Geometry:
 * - Each lens is a rounded rectangle centered on eye landmarks
 * - Lens size: ~faceWidth * 0.22 wide, ~faceHeight * 0.14 tall
 * - Bridge: thick line connecting inner edges of both lenses across the nose
 * - Temple arms: lines from outer lens edges toward the ears
 * - Lens flare: small white ellipse whose x-position shifts with head yaw
 */

function smooth(prev, curr, factor = 0.7) {
  if (!prev) return curr;
  return {
    x: prev.x * (1 - factor) + curr.x * factor,
    y: prev.y * (1 - factor) + curr.y * factor,
  };
}

// Rounded rectangle helper
function roundedRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function drawSunglassesFilter(ctx, faceData, prevFaceData, time) {
  ctx.save();

  const { landmarks, faceWidth, faceHeight, rotation } = faceData;
  const prev = prevFaceData ? prevFaceData.landmarks : null;

  const leftEye = smooth(prev?.leftEye, landmarks.leftEye);
  const rightEye = smooth(prev?.rightEye, landmarks.rightEye);
  const noseTip = smooth(prev?.noseTip, landmarks.noseTip);

  // Head rotation angle
  const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

  const lensW = faceWidth * 0.22;
  const lensH = faceHeight * 0.14;
  const cornerRadius = lensH * 0.3;
  const frameThickness = Math.max(2, faceWidth * 0.015);

  // Eye center (midpoint) for global transform
  const centerX = (leftEye.x + rightEye.x) / 2;
  const centerY = (leftEye.y + rightEye.y) / 2;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(angle);

  // Eye positions in local (rotated) coords
  const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  const halfDist = eyeDist / 2;

  // --- Draw temple arms (behind lenses) ---
  ctx.strokeStyle = '#333';
  ctx.lineWidth = frameThickness;
  ctx.lineCap = 'round';

  // Left temple arm extends leftward and slightly down
  ctx.beginPath();
  ctx.moveTo(-halfDist - lensW * 0.5, 0);
  ctx.lineTo(-halfDist - lensW * 0.5 - faceWidth * 0.2, lensH * 0.3);
  ctx.stroke();

  // Right temple arm
  ctx.beginPath();
  ctx.moveTo(halfDist + lensW * 0.5, 0);
  ctx.lineTo(halfDist + lensW * 0.5 + faceWidth * 0.2, lensH * 0.3);
  ctx.stroke();

  // --- Draw lenses ---
  const drawLens = (cx) => {
    const lx = cx - lensW / 2;
    const ly = -lensH / 2;

    // Dark gradient fill
    const grad = ctx.createLinearGradient(lx, ly, lx, ly + lensH);
    grad.addColorStop(0, '#111');
    grad.addColorStop(1, '#333');

    roundedRect(ctx, lx, ly, lensW, lensH, cornerRadius);
    ctx.fillStyle = grad;
    ctx.fill();

    // Frame stroke
    roundedRect(ctx, lx, ly, lensW, lensH, cornerRadius);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = frameThickness;
    ctx.stroke();
  };

  drawLens(-halfDist); // left lens
  drawLens(halfDist);  // right lens

  // --- Bridge across nose ---
  ctx.beginPath();
  ctx.moveTo(-halfDist + lensW * 0.5, 0);
  ctx.quadraticCurveTo(0, lensH * 0.15, halfDist - lensW * 0.5, 0);
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = frameThickness;
  ctx.stroke();

  // --- Lens flare: shifts with yaw ---
  const yaw = rotation ? rotation.yaw : 0;
  // Flare offset within lens based on yaw (range roughly -0.5 to 0.5 of lensW)
  const flareShift = yaw * lensW * 0.4;

  const drawFlare = (cx) => {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.ellipse(
      cx + flareShift,
      -lensH * 0.15,
      lensW * 0.08,
      lensH * 0.15,
      -0.3,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = '#FFF';
    ctx.fill();
    ctx.restore();
  };

  drawFlare(-halfDist);
  drawFlare(halfDist);

  ctx.restore();
  ctx.restore();
}
