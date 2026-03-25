/**
 * AngelFilter - Halo, sparkles, and feathered wings
 *
 * Geometry:
 * - Halo: ellipse above head, gold stroke with glow (shadowBlur)
 * - Halo bobs vertically with sin(time)
 * - Sparkles orbit the halo in a circle
 * - Wings: multi-layer bezier feather shapes on each side of the face
 *   Each wing has 3-4 feather curves stacked, drawn with transparency
 */

function smooth(prev, curr, factor = 0.7) {
  if (!prev) return curr;
  return {
    x: prev.x * (1 - factor) + curr.x * factor,
    y: prev.y * (1 - factor) + curr.y * factor,
  };
}

// Sparkle orbit offsets (pre-generated)
const haloSparkles = Array.from({ length: 6 }, (_, i) => ({
  angleOffset: (Math.PI * 2 / 6) * i,
  size: 2 + Math.random() * 2,
}));

export function drawAngelFilter(ctx, faceData, prevFaceData, time) {
  ctx.save();

  const { landmarks, faceWidth, faceHeight, bounds } = faceData;
  const prev = prevFaceData ? prevFaceData.landmarks : null;

  const leftEye = smooth(prev?.leftEye, landmarks.leftEye);
  const rightEye = smooth(prev?.rightEye, landmarks.rightEye);
  const foreheadCenter = smooth(prev?.foreheadCenter, landmarks.foreheadCenter);
  const mouthCenter = smooth(prev?.mouthCenter, landmarks.mouthCenter);

  const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

  // Face center (between eyes and mouth)
  const faceCenterX = (leftEye.x + rightEye.x) / 2;
  const faceCenterY = (leftEye.y + rightEye.y + mouthCenter.y) / 3;

  // --- Wings (drawn behind face, so draw first) ---
  ctx.save();
  ctx.globalAlpha = 0.6;

  const wingSpan = faceWidth * 0.55;
  const wingHeight = faceHeight * 0.5;
  const featherLayers = 4;

  // Draw wing on one side
  function drawWing(side) {
    // side: -1 = left, 1 = right
    const wingBaseX = faceCenterX + side * faceWidth * 0.45;
    const wingBaseY = faceCenterY - faceHeight * 0.05;

    ctx.save();
    ctx.translate(wingBaseX, wingBaseY);
    ctx.rotate(angle);

    for (let i = 0; i < featherLayers; i++) {
      const layerOffset = i * (wingHeight / featherLayers) * 0.3;
      const layerSpan = wingSpan * (1 - i * 0.15);
      const opacity = 0.7 - i * 0.12;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      // Feather curve: extends outward and upward
      ctx.bezierCurveTo(
        side * layerSpan * 0.3, -wingHeight * 0.4 + layerOffset,
        side * layerSpan * 0.8, -wingHeight * 0.5 + layerOffset,
        side * layerSpan, -wingHeight * 0.1 + layerOffset
      );
      // Return curve
      ctx.bezierCurveTo(
        side * layerSpan * 0.7, wingHeight * 0.15 + layerOffset,
        side * layerSpan * 0.3, wingHeight * 0.1 + layerOffset,
        0, 0
      );
      ctx.closePath();
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.fill();
    }

    ctx.restore();
  }

  drawWing(-1);
  drawWing(1);
  ctx.restore();

  // --- Halo ---
  // Position above forehead with gentle bob
  const haloBob = Math.sin(time * 0.002) * 5;
  const haloX = foreheadCenter.x;
  const haloY = foreheadCenter.y - faceHeight * 0.4 + haloBob;
  const haloRadiusX = faceWidth * 0.3;
  const haloRadiusY = faceWidth * 0.08; // flattened ellipse for perspective

  ctx.save();
  ctx.translate(haloX, haloY);
  ctx.rotate(angle);

  // Glow effect via shadowBlur
  ctx.shadowBlur = 15;
  ctx.shadowColor = '#FFD700';
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, haloRadiusX, haloRadiusY, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Draw again without shadow for crisp line
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.ellipse(0, 0, haloRadiusX, haloRadiusY, 0, 0, Math.PI * 2);
  ctx.stroke();

  // --- Sparkle dots orbiting the halo ---
  haloSparkles.forEach((sp) => {
    const orbitAngle = time * 0.001 + sp.angleOffset;
    const sx = Math.cos(orbitAngle) * haloRadiusX * 1.15;
    const sy = Math.sin(orbitAngle) * haloRadiusY * 1.15;
    const twinkle = 0.5 + 0.5 * Math.sin(time * 0.004 + sp.angleOffset * 3);

    ctx.beginPath();
    ctx.arc(sx, sy, sp.size * twinkle, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 220, ${twinkle})`;
    ctx.fill();
  });

  ctx.restore();
  ctx.restore();
}
