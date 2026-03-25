/**
 * LipColor.js — Beauty filter that tints lips with a chosen colour.
 *
 * Platform support:
 *   - Web: Filled polygon over lip contour with `multiply` composite mode.
 *          When the mouth is open, upper and lower lips are drawn separately.
 *   - Native: Skia path fill with BlendMode.Multiply (guarded import).
 *
 * Performance notes:
 *   - Canvas path fill + composite mode is very lightweight (~0.1 ms).
 *   - No pixel manipulation; entirely GPU-composited on modern browsers.
 *
 * @module filters/beauty/LipColor
 */

import { Platform } from 'react-native';

/* ---------- Native (Skia) — guarded import ---------- */

let SkiaComponents = null;

if (Platform.OS !== 'web') {
  try {
    const Skia = require('@shopify/react-native-skia');
    SkiaComponents = {
      Group: Skia.Group,
      Path: Skia.Path,
      Skia: Skia.Skia,
    };
  } catch (e) {
    console.warn('[LipColor] Skia not available:', e.message);
  }
}

/* ---------- Colour palette ---------- */

/**
 * Available lip colour presets.
 * Keys are used as the `colorKey` argument to draw functions.
 */
export const LIP_COLORS = {
  classicRed: '#cc0000',
  pink: '#ff69b4',
  coral: '#ff7f50',
  berry: '#8b008b',
  nude: '#c4956a',
};

/* ---------- Helpers ---------- */

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
 * Parse a hex colour string into an `rgba()` string with the given alpha.
 *
 * @param {string} hex   — e.g. '#cc0000'
 * @param {number} alpha — 0-1
 * @returns {string} rgba colour
 */
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ================================================================
   WEB — drawLipColor
   ================================================================ */

/**
 * Draw tinted lip colour over the detected lip region.
 *
 * When the mouth is open (`mouthOpen > 0.2`) the upper and lower lip
 * contours are drawn as separate paths so the gap between them stays clear.
 * Otherwise a single combined polygon is used.
 *
 * The `multiply` composite operation is used so the tint blends naturally
 * over the underlying lip texture rather than painting a flat colour.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object}                  faceData
 * @param {number}                  intensity — 0-100
 * @param {string}                  [colorKey='classicRed'] — key into LIP_COLORS
 */
export function drawLipColor(ctx, faceData, intensity, colorKey = 'classicRed') {
  if (!faceData || !faceData.landmarks || intensity <= 0) return;

  const { landmarks, mouthOpen } = faceData;
  const { upperLip, lowerLip, mouth } = landmarks;

  // Must have at least one lip contour
  if ((!upperLip || upperLip.length === 0) && (!lowerLip || lowerLip.length === 0) && (!mouth || mouth.length === 0)) {
    return;
  }

  const hex = LIP_COLORS[colorKey] || LIP_COLORS.classicRed;

  // Opacity: 0.2 – 0.6 mapped from intensity 0-100
  const opacity = 0.2 + (intensity / 100) * 0.4;
  const color = hexToRgba(hex, opacity);

  ctx.save();

  // Use multiply blending for natural tint over lip texture
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = color;

  const isOpen = (mouthOpen != null) && mouthOpen > 0.2;

  if (isOpen && upperLip && upperLip.length > 0 && lowerLip && lowerLip.length > 0) {
    // --- Mouth open: draw upper and lower lip separately ---
    tracePath(ctx, upperLip);
    ctx.fill();

    tracePath(ctx, lowerLip);
    ctx.fill();
  } else if (upperLip && lowerLip && upperLip.length > 0 && lowerLip.length > 0) {
    // --- Mouth closed: combine into one contour ---
    // Upper lip forward, lower lip reversed to form closed loop
    const combined = [...upperLip, ...[...lowerLip].reverse()];
    tracePath(ctx, combined);
    ctx.fill();
  } else if (mouth && mouth.length > 0) {
    // Fallback: use generic mouth contour
    tracePath(ctx, mouth);
    ctx.fill();
  }

  ctx.restore();
}

/* ================================================================
   NATIVE — LipColorNative (Skia component)
   ================================================================ */

/**
 * Native Skia component that renders lip colour overlay.
 *
 * @param {object} props
 * @param {object} props.faceData
 * @param {number} props.intensity  — 0-100
 * @param {string} [props.colorKey='classicRed']
 * @param {number} props.canvasWidth
 * @param {number} props.canvasHeight
 * @returns {React.Element|null}
 */
export function LipColorNative(props) {
  if (!SkiaComponents) return null;

  const { faceData, intensity, colorKey = 'classicRed' } = props;
  if (!faceData || !faceData.landmarks || intensity <= 0) return null;

  const { Group, Path: SkiaPathComp, Skia } = SkiaComponents;
  const { landmarks, mouthOpen } = faceData;
  const { upperLip, lowerLip, mouth } = landmarks;

  const hex = LIP_COLORS[colorKey] || LIP_COLORS.classicRed;
  const opacity = 0.2 + (intensity / 100) * 0.4;

  // Parse hex to Skia colour with alpha
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const paint = Skia.Paint();
  paint.setColor(Skia.Color(r, g, b, Math.round(opacity * 255)));
  paint.setBlendMode(20); // BlendMode.Multiply = 20 in Skia enum

  /**
   * Build a Skia path from landmark points.
   * @param {Array<{x:number,y:number}>} pts
   * @returns {object} SkiaPath
   */
  const buildPath = (pts) => {
    const p = Skia.Path.Make();
    if (!pts || pts.length === 0) return p;
    p.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      p.lineTo(pts[i].x, pts[i].y);
    }
    p.close();
    return p;
  };

  const isOpen = mouthOpen != null && mouthOpen > 0.2;
  const paths = [];

  if (isOpen && upperLip && upperLip.length > 0 && lowerLip && lowerLip.length > 0) {
    paths.push(buildPath(upperLip));
    paths.push(buildPath(lowerLip));
  } else if (upperLip && lowerLip && upperLip.length > 0 && lowerLip.length > 0) {
    const combined = [...upperLip, ...[...lowerLip].reverse()];
    paths.push(buildPath(combined));
  } else if (mouth && mouth.length > 0) {
    paths.push(buildPath(mouth));
  }

  if (paths.length === 0) return null;

  return (
    <Group>
      {paths.map((path, idx) => (
        <SkiaPathComp key={idx} path={path} paint={paint} />
      ))}
    </Group>
  );
}

export default {
  drawLipColor,
  LipColorNative,
  LIP_COLORS,
};
