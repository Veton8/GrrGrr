/**
 * FaceBrightening.js — Beauty filter that brightens the face region.
 *
 * Platform support:
 *   - Web: Semi-transparent white overlay within face contour clip path,
 *          with feathered edges via multiple passes.
 *   - Native: Skia color-filter overlay (guarded import).
 *
 * Performance notes:
 *   - The multi-pass feathering draws up to 4 extra overlays per frame.
 *     On constrained devices you can reduce FEATHER_PASSES to 2.
 *   - Canvas fillRect with globalAlpha is very cheap; this filter has
 *     negligible cost compared to pixel-manipulation filters.
 *
 * @module filters/beauty/FaceBrightening
 */

import { Platform } from 'react-native';

/* ---------- Native (Skia) — guarded import ---------- */

let SkiaComponents = null;

if (Platform.OS !== 'web') {
  try {
    const Skia = require('@shopify/react-native-skia');
    SkiaComponents = {
      Group: Skia.Group,
      Rect: Skia.Rect,
      Skia: Skia.Skia,
    };
  } catch (e) {
    console.warn('[FaceBrightening] Skia not available:', e.message);
  }
}

/* ---------- Constants ---------- */

/** Number of feathering passes for softer edge falloff. */
const FEATHER_PASSES = 4;

/** Scale factor applied to contour for each successive feather pass. */
const FEATHER_SHRINK = 0.03; // 3% smaller per pass

/* ================================================================
   WEB — drawFaceBrightening
   ================================================================ */

/**
 * Trace a Canvas2D path from an array of {x, y} points.
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
 * Compute the centroid of a point array.
 *
 * @param {Array<{x: number, y: number}>} pts
 * @returns {{x: number, y: number}}
 */
function centroid(pts) {
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / pts.length, y: sy / pts.length };
}

/**
 * Scale points towards / away from a centre by a given factor.
 *
 * @param {Array<{x: number, y: number}>} pts
 * @param {{x: number, y: number}} center
 * @param {number} scale  — 1 = identity, <1 = shrink
 * @returns {Array<{x: number, y: number}>}
 */
function scalePoints(pts, center, scale) {
  return pts.map((p) => ({
    x: center.x + (p.x - center.x) * scale,
    y: center.y + (p.y - center.y) * scale,
  }));
}

/**
 * Draw a brightening overlay within the face contour.
 *
 * The effect is achieved by filling a semi-transparent white region.
 * Multiple passes at decreasing contour sizes create a soft feathered edge
 * so the brightening fades naturally at the face boundary.
 *
 * @param {CanvasRenderingContext2D} ctx       — 2D drawing context
 * @param {object}                  faceData  — detected face data
 * @param {number}                  intensity — 0-100 slider value
 */
export function drawFaceBrightening(ctx, faceData, intensity) {
  if (!faceData || !faceData.contour || intensity <= 0) return;

  const { contour, bounds } = faceData;

  // Base opacity: 5-17% mapped from intensity 0-100
  const baseOpacity = 0.05 + (intensity / 100) * 0.12;

  // Per-pass opacity (split total brightness across passes for feathering)
  const passOpacity = baseOpacity / FEATHER_PASSES;

  const center = centroid(contour);

  for (let pass = 0; pass < FEATHER_PASSES; pass++) {
    const scale = 1 - FEATHER_SHRINK * pass;
    const scaled = scalePoints(contour, center, scale);

    ctx.save();

    // Clip to the (progressively smaller) contour
    tracePath(ctx, scaled);
    ctx.clip();

    // Semi-transparent white fill
    ctx.globalAlpha = passOpacity;
    ctx.fillStyle = '#ffffff';

    // Fill the bounding area (clip constrains it to the contour)
    const b = bounds || { x: 0, y: 0, width: ctx.canvas.width, height: ctx.canvas.height };
    ctx.fillRect(b.x - 10, b.y - 10, b.width + 20, b.height + 20);

    ctx.restore();
  }
}

/* ================================================================
   NATIVE — FaceBrighteningNative (Skia component)
   ================================================================ */

/**
 * Native Skia component that renders a brightening overlay on the face.
 *
 * @param {object} props
 * @param {object} props.faceData
 * @param {number} props.intensity  — 0-100
 * @param {number} props.canvasWidth
 * @param {number} props.canvasHeight
 * @returns {React.Element|null}
 */
export function FaceBrighteningNative(props) {
  if (!SkiaComponents) return null;

  const { faceData, intensity } = props;
  if (!faceData || !faceData.contour || intensity <= 0) return null;

  const { Group, Rect, Skia } = SkiaComponents;

  const baseOpacity = 0.05 + (intensity / 100) * 0.12;
  const bounds = faceData.bounds || { x: 0, y: 0, width: props.canvasWidth, height: props.canvasHeight };

  // Build Skia clip path from contour
  const contourPath = Skia.Path.Make();
  const pts = faceData.contour;
  if (pts.length > 0) {
    contourPath.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      contourPath.lineTo(pts[i].x, pts[i].y);
    }
    contourPath.close();
  }

  const paint = Skia.Paint();
  paint.setColor(Skia.Color(255, 255, 255, Math.round(baseOpacity * 255)));

  return (
    <Group clip={contourPath}>
      <Rect
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        paint={paint}
      />
    </Group>
  );
}

export default {
  drawFaceBrightening,
  FaceBrighteningNative,
};
