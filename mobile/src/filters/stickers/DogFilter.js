/**
 * DogFilter - Floppy ears, nose, and tongue sticker
 *
 * Geometry:
 * - Ears are placed above the forehead, offset left/right by ~0.4 * faceWidth
 * - Ear shape uses quadratic bezier curves for a floppy look
 * - Nose circle sits on noseTip landmark
 * - Tongue drops from mouth center when mouth is open
 * - Ear bounce: compares current vs previous forehead position to add overshoot
 */

// Smoothing helper: blend previous and current values
function smooth(prev, curr, factor = 0.7) {
  if (!prev) return curr;
  return {
    x: prev.x * (1 - factor) + curr.x * factor,
    y: prev.y * (1 - factor) + curr.y * factor,
  };
}

// Ear bounce state (persists across calls via closure)
let earBounceOffset = 0;
let lastForeheadY = null;

export function drawDogFilter(ctx, faceData, prevFaceData, time) {
  ctx.save();

  const { landmarks, faceWidth, faceHeight, mouthOpen, contour } = faceData;
  const prev = prevFaceData ? prevFaceData.landmarks : null;

  // Smooth key landmarks
  const leftEye = smooth(prev?.leftEye, landmarks.leftEye);
  const rightEye = smooth(prev?.rightEye, landmarks.rightEye);
  const noseTip = smooth(prev?.noseTip, landmarks.noseTip);
  const mouthCenter = smooth(prev?.mouthCenter, landmarks.mouthCenter);
  const foreheadCenter = smooth(prev?.foreheadCenter, landmarks.foreheadCenter);

  // Head rotation angle from eye positions
  const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

  // Ear bounce: detect vertical movement of forehead
  const foreheadVelocity = lastForeheadY !== null ? foreheadCenter.y - lastForeheadY : 0;
  lastForeheadY = foreheadCenter.y;
  // Damped spring for bounce overshoot
  earBounceOffset = earBounceOffset * 0.8 + foreheadVelocity * 2.5;
  const bounce = Math.max(-15, Math.min(15, earBounceOffset));

  const earWidth = faceWidth * 0.28;
  const earHeight = faceHeight * 0.45;

  // --- Draw left ear ---
  ctx.save();
  const leftEarX = foreheadCenter.x - faceWidth * 0.38;
  const leftEarY = foreheadCenter.y - faceHeight * 0.25 + bounce;
  ctx.translate(leftEarX, leftEarY);
  ctx.rotate(angle - 0.3); // tilt slightly outward

  const leftGrad = ctx.createLinearGradient(0, -earHeight * 0.5, 0, earHeight * 0.5);
  leftGrad.addColorStop(0, '#D2691E');
  leftGrad.addColorStop(1, '#8B4513');
  ctx.fillStyle = leftGrad;

  ctx.beginPath();
  ctx.moveTo(0, -earHeight * 0.1);
  // Floppy ear shape using bezier curves
  ctx.quadraticCurveTo(-earWidth * 0.6, -earHeight * 0.3, -earWidth * 0.3, earHeight * 0.4);
  ctx.quadraticCurveTo(-earWidth * 0.1, earHeight * 0.55, earWidth * 0.1, earHeight * 0.35);
  ctx.quadraticCurveTo(earWidth * 0.3, earHeight * 0.1, 0, -earHeight * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // --- Draw right ear ---
  ctx.save();
  const rightEarX = foreheadCenter.x + faceWidth * 0.38;
  const rightEarY = foreheadCenter.y - faceHeight * 0.25 + bounce;
  ctx.translate(rightEarX, rightEarY);
  ctx.rotate(angle + 0.3); // tilt slightly outward

  const rightGrad = ctx.createLinearGradient(0, -earHeight * 0.5, 0, earHeight * 0.5);
  rightGrad.addColorStop(0, '#D2691E');
  rightGrad.addColorStop(1, '#8B4513');
  ctx.fillStyle = rightGrad;

  ctx.beginPath();
  ctx.moveTo(0, -earHeight * 0.1);
  ctx.quadraticCurveTo(earWidth * 0.6, -earHeight * 0.3, earWidth * 0.3, earHeight * 0.4);
  ctx.quadraticCurveTo(earWidth * 0.1, earHeight * 0.55, -earWidth * 0.1, earHeight * 0.35);
  ctx.quadraticCurveTo(-earWidth * 0.3, earHeight * 0.1, 0, -earHeight * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // --- Draw nose ---
  const noseRadius = faceWidth * 0.08;
  ctx.beginPath();
  ctx.arc(noseTip.x, noseTip.y, noseRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#333';
  ctx.fill();
  // Nose highlight
  ctx.beginPath();
  ctx.arc(noseTip.x - noseRadius * 0.25, noseTip.y - noseRadius * 0.25, noseRadius * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fill();

  // --- Draw tongue when mouth is open ---
  if (mouthOpen > 0.3) {
    const tongueExtension = Math.min((mouthOpen - 0.3) / 0.7, 1); // 0-1 range
    const tongueLength = faceHeight * 0.15 * tongueExtension;
    const tongueWidth = faceWidth * 0.1;
    const tongueX = mouthCenter.x;
    // Tongue drops from lower lip area
    const tongueStartY = mouthCenter.y + faceHeight * 0.04;

    ctx.save();
    ctx.translate(tongueX, tongueStartY);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(-tongueWidth * 0.5, 0);
    ctx.quadraticCurveTo(-tongueWidth * 0.6, tongueLength * 0.7, 0, tongueLength);
    ctx.quadraticCurveTo(tongueWidth * 0.6, tongueLength * 0.7, tongueWidth * 0.5, 0);
    ctx.closePath();
    ctx.fillStyle = '#FF69B4';
    ctx.fill();

    // Tongue center line
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.quadraticCurveTo(0, tongueLength * 0.5, 0, tongueLength * 0.8);
    ctx.strokeStyle = '#FF1493';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}
