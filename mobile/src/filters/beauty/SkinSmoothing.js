/**
 * SkinSmoothing.js — Beauty filter for real-time skin smoothing.
 *
 * Platform support:
 *   - Web: Gaussian blur within face contour clip path (canvas `filter: blur()`)
 *   - Native: Skia blur image filter on face region (guarded import)
 *
 * Performance notes:
 *   - Web blur is GPU-accelerated in most browsers when using the CSS `filter` property.
 *   - The sharp-region restore (eyes + mouth) requires two extra drawImage calls per frame.
 *   - On low-end devices consider halving intensity or skipping every other frame.
 *
 * @module filters/beauty/SkinSmoothing
 */

import { Platform } from 'react-native';

/* ---------- Native (Skia) — guarded import ---------- */

let SkiaComponents = null;

if (Platform.OS !== 'web') {
  try {
    const Skia = require('@shopify/react-native-skia');
    SkiaComponents = {
      Canvas: Skia.Canvas,
      Path: Skia.Path,
      Group: Skia.Group,
      Blur: Skia.Blur,
      Image: Skia.Image,
      useImage: Skia.useImage,
      Skia: Skia.Skia,
    };
  } catch (e) {
    console.warn('[SkinSmoothing] Skia not available:', e.message);
  }
}

/* ================================================================
   WEB — drawSkinSmoothing
   ================================================================ */

/**
 * Build a Canvas2D Path from an array of {x, y} landmark points.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x: number, y: number}>} points
 */
function tracePath(ctx, points) {
  if (!points || points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
}

/**
 * Draw skin-smoothed face region onto the canvas.
 *
 * Algorithm:
 *   1. Save canvas state.
 *   2. Clip to face contour path.
 *   3. Apply gaussian blur and redraw the current video frame.
 *   4. Restore canvas (removes clip).
 *   5. Re-draw the sharp eye and mouth regions over the blurred area.
 *
 * @param {CanvasRenderingContext2D} ctx       — 2D drawing context
 * @param {object}                  faceData  — detected face data
 * @param {number}                  intensity — 0-100 slider value
 * @param {HTMLVideoElement}        videoElement — source video
 */
export function drawSkinSmoothing(ctx, faceData, intensity, videoElement) {
  if (!faceData || !faceData.contour || intensity <= 0) return;

  const { contour, landmarks } = faceData;

  // Blur sigma: 2–6 px mapped from intensity 0–100
  const sigma = 2 + (intensity / 100) * 4;

  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;

  /* --- Step 1: Draw blurred face region --- */
  ctx.save();

  // Clip to face contour
  tracePath(ctx, contour);
  ctx.clip();

  // Apply blur filter and redraw the full video frame (only the clipped region is affected)
  ctx.filter = `blur(${sigma}px)`;
  ctx.drawImage(videoElement, 0, 0, canvasW, canvasH);
  ctx.filter = 'none';

  ctx.restore();

  /* --- Step 2: Restore sharp eye + mouth regions --- */
  const sharpRegions = [];

  // Left eye
  if (landmarks && landmarks.leftEye) {
    sharpRegions.push(landmarks.leftEye);
  }
  // Right eye
  if (landmarks && landmarks.rightEye) {
    sharpRegions.push(landmarks.rightEye);
  }
  // Mouth
  if (landmarks && landmarks.mouth) {
    sharpRegions.push(landmarks.mouth);
  }

  for (const region of sharpRegions) {
    if (!region || region.length === 0) continue;

    ctx.save();

    // Build clip from feature points with a small padding
    tracePath(ctx, region);
    ctx.clip();

    // Redraw original video (sharp) into this clipped area
    ctx.drawImage(videoElement, 0, 0, canvasW, canvasH);

    ctx.restore();
  }
}

/* ================================================================
   NATIVE — SkinSmoothingNative (Skia component)
   ================================================================ */

/**
 * Native Skia component that renders a blurred face region.
 *
 * @param {object} props
 * @param {object} props.faceData   — detected face landmarks / contour
 * @param {number} props.intensity  — 0-100
 * @param {number} props.canvasWidth
 * @param {number} props.canvasHeight
 * @returns {React.Element|null}
 */
export function SkinSmoothingNative(props) {
  if (!SkiaComponents) return null;

  const { faceData, intensity, canvasWidth, canvasHeight } = props;
  if (!faceData || !faceData.contour || intensity <= 0) return null;

  const { Group, Path: SkiaPath, Blur, Skia } = SkiaComponents;
  const sigma = 2 + (intensity / 100) * 4;

  // Build Skia path from contour points
  const contourPath = Skia.Path.Make();
  const pts = faceData.contour;
  if (pts.length > 0) {
    contourPath.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      contourPath.lineTo(pts[i].x, pts[i].y);
    }
    contourPath.close();
  }

  return (
    <Group clip={contourPath}>
      <Blur blur={sigma} />
    </Group>
  );
}

export default {
  drawSkinSmoothing,
  SkinSmoothingNative,
};
