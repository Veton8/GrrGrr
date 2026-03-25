/**
 * CatFilter - Pointy ears, whiskers, nose, and anime blink
 *
 * Geometry:
 * - Triangular ears above forehead, positioned at ~0.35 * faceWidth offset
 * - Each ear is an outer triangle (light pink) with an inner triangle (hot pink)
 * - Whiskers: 3 lines per cheek extending outward from cheek landmarks
 * - Nose: small inverted triangle on noseTip
 * - Blink detection: when eyeOpen < 0.3, draw cute curved lines instead of eyes
 */

function smooth(prev, curr, factor = 0.7) {
  if (!prev) return curr;
  return {
    x: prev.x * (1 - factor) + curr.x * factor,
    y: prev.y * (1 - factor) + curr.y * factor,
  };
}

export function drawCatFilter(ctx, faceData, prevFaceData, time) {
  ctx.save();

  const { landmarks, faceWidth, faceHeight, leftEyeOpen, rightEyeOpen } = faceData;
  const prev = prevFaceData ? prevFaceData.landmarks : null;

  // Smooth landmarks
  const leftEye = smooth(prev?.leftEye, landmarks.leftEye);
  const rightEye = smooth(prev?.rightEye, landmarks.rightEye);
  const noseTip = smooth(prev?.noseTip, landmarks.noseTip);
  const leftCheek = smooth(prev?.leftCheek, landmarks.leftCheek);
  const rightCheek = smooth(prev?.rightCheek, landmarks.rightCheek);
  const foreheadCenter = smooth(prev?.foreheadCenter, landmarks.foreheadCenter);

  // Head rotation from eye positions
  const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  const earSize = faceWidth * 0.22;

  // --- Helper to draw one pointed ear ---
  function drawEar(cx, cy, mirror) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle + (mirror ? 0.2 : -0.2));

    // Outer ear (light pink)
    ctx.beginPath();
    ctx.moveTo(0, -earSize);
    ctx.lineTo(-earSize * 0.5, earSize * 0.3);
    ctx.lineTo(earSize * 0.5, earSize * 0.3);
    ctx.closePath();
    ctx.fillStyle = '#FFB6C1';
    ctx.fill();

    // Inner ear triangle (hot pink), slightly smaller and inset
    const innerScale = 0.55;
    ctx.beginPath();
    ctx.moveTo(0, -earSize * 0.7);
    ctx.lineTo(-earSize * innerScale * 0.5, earSize * 0.15);
    ctx.lineTo(earSize * innerScale * 0.5, earSize * 0.15);
    ctx.closePath();
    ctx.fillStyle = '#FF69B4';
    ctx.fill();

    ctx.restore();
  }

  // Position ears above forehead, offset left and right
  const earOffsetX = faceWidth * 0.35;
  const earOffsetY = faceHeight * 0.35;

  // Left ear (relative to head rotation)
  const leftEarX = foreheadCenter.x - earOffsetX * cosA + earOffsetY * sinA;
  const leftEarY = foreheadCenter.y - earOffsetX * sinA - earOffsetY * cosA;
  drawEar(leftEarX, leftEarY, false);

  // Right ear
  const rightEarX = foreheadCenter.x + earOffsetX * cosA + earOffsetY * sinA;
  const rightEarY = foreheadCenter.y + earOffsetX * sinA - earOffsetY * cosA;
  drawEar(rightEarX, rightEarY, true);

  // --- Whiskers: 3 per side ---
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';

  const whiskerLen = faceWidth * 0.3;
  const whiskerAngles = [-0.2, 0, 0.2]; // slight fan spread

  // Left whiskers
  whiskerAngles.forEach((wa) => {
    const baseAngle = angle + Math.PI + wa; // point outward left
    ctx.beginPath();
    ctx.moveTo(leftCheek.x, leftCheek.y);
    ctx.lineTo(
      leftCheek.x + Math.cos(baseAngle) * whiskerLen,
      leftCheek.y + Math.sin(baseAngle) * whiskerLen
    );
    ctx.stroke();
  });

  // Right whiskers
  whiskerAngles.forEach((wa) => {
    const baseAngle = angle + wa; // point outward right
    ctx.beginPath();
    ctx.moveTo(rightCheek.x, rightCheek.y);
    ctx.lineTo(
      rightCheek.x + Math.cos(baseAngle) * whiskerLen,
      rightCheek.y + Math.sin(baseAngle) * whiskerLen
    );
    ctx.stroke();
  });

  // --- Nose: small pink inverted triangle ---
  const noseSize = faceWidth * 0.04;
  ctx.save();
  ctx.translate(noseTip.x, noseTip.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, noseSize * 0.4);
  ctx.lineTo(-noseSize, -noseSize * 0.4);
  ctx.lineTo(noseSize, -noseSize * 0.4);
  ctx.closePath();
  ctx.fillStyle = '#FF69B4';
  ctx.fill();
  ctx.restore();

  // --- Blink detection: draw anime-style closed eyes ---
  if (leftEyeOpen < 0.3) {
    const eyeW = faceWidth * 0.1;
    ctx.beginPath();
    ctx.arc(leftEye.x, leftEye.y, eyeW, 0, Math.PI, false); // upside-down arc = cute ∪
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  if (rightEyeOpen < 0.3) {
    const eyeW = faceWidth * 0.1;
    ctx.beginPath();
    ctx.arc(rightEye.x, rightEye.y, eyeW, 0, Math.PI, false);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  ctx.restore();
}
