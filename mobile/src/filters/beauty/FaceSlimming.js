/**
 * FaceSlimming.js — Beauty filter that narrows the jawline / lower face.
 *
 * Platform support:
 *   - Web: Pixel-level displacement toward the face centre along the jaw.
 *          Uses bilinear interpolation for smooth sub-pixel sampling.
 *   - Native: Skia mesh distortion (guarded import).
 *
 * Performance notes:
 *   - This is the MOST expensive beauty filter because it reads and writes
 *     raw pixel data via getImageData / putImageData.
 *   - A `shouldSkipFrame` helper is exported so the caller can throttle on
 *     low-end devices (e.g. process every other frame).
 *   - For a 640x480 face region the inner loop touches ~75 K pixels;
 *     keep intensity low on weak hardware.
 *   - Consider running this in an OffscreenCanvas / worker if available.
 *
 * @module filters/beauty/FaceSlimming
 */

import { Platform } from 'react-native';

/* ---------- Native (Skia) — guarded import ---------- */

let SkiaComponents = null;

if (Platform.OS !== 'web') {
  try {
    const Skia = require('@shopify/react-native-skia');
    SkiaComponents = {
      Group: Skia.Group,
      Vertices: Skia.Vertices,
      Skia: Skia.Skia,
    };
  } catch (e) {
    console.warn('[FaceSlimming] Skia not available:', e.message);
  }
}

/* ---------- Frame-skip helper ---------- */

let _frameCounter = 0;

/**
 * Returns `true` when the current frame should be skipped to save CPU.
 * Call once per frame — it alternates true/false.
 *
 * @returns {boolean}
 */
export function shouldSkipFrame() {
  _frameCounter += 1;
  return _frameCounter % 2 === 0;
}

/* ---------- Bilinear interpolation ---------- */

/**
 * Sample a pixel from the source ImageData using bilinear interpolation.
 *
 * @param {Uint8ClampedArray} src  — source pixel buffer (RGBA)
 * @param {number} w               — image width
 * @param {number} h               — image height
 * @param {number} x               — sub-pixel x coordinate
 * @param {number} y               — sub-pixel y coordinate
 * @returns {[number, number, number, number]} RGBA tuple
 */
function sampleBilinear(src, w, h, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);

  const fx = x - x0;
  const fy = y - y0;

  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;

  const i00 = (y0 * w + x0) * 4;
  const i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;

  return [
    src[i00] * w00 + src[i10] * w10 + src[i01] * w01 + src[i11] * w11,
    src[i00 + 1] * w00 + src[i10 + 1] * w10 + src[i01 + 1] * w01 + src[i11 + 1] * w11,
    src[i00 + 2] * w00 + src[i10 + 2] * w10 + src[i01 + 2] * w01 + src[i11 + 2] * w11,
    src[i00 + 3] * w00 + src[i10 + 3] * w10 + src[i01 + 3] * w01 + src[i11 + 3] * w11,
  ];
}

/* ================================================================
   WEB — drawFaceSlimming
   ================================================================ */

/**
 * Compute a smooth falloff weight based on distance to nearest jaw point.
 * Returns 1.0 at the jaw edge and 0.0 far from it.
 *
 * @param {number} px — pixel x
 * @param {number} py — pixel y
 * @param {Array<{x: number, y: number}>} jawPoints
 * @param {number} radius — influence radius in px
 * @returns {number} 0-1 weight
 */
function jawInfluence(px, py, jawPoints, radius) {
  let minDist = Infinity;
  for (const jp of jawPoints) {
    const dx = px - jp.x;
    const dy = py - jp.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < minDist) minDist = d;
  }
  if (minDist >= radius) return 0;
  // Smooth hermite falloff
  const t = minDist / radius;
  return 1 - t * t * (3 - 2 * t);
}

/**
 * Slim the lower face by shifting jaw-region pixels inward toward the
 * vertical centre line.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object}                  faceData
 * @param {number}                  intensity     — 0-100
 * @param {HTMLVideoElement}        videoElement
 * @param {number}                  canvasWidth
 * @param {number}                  canvasHeight
 */
export function drawFaceSlimming(ctx, faceData, intensity, videoElement, canvasWidth, canvasHeight) {
  if (!faceData || !faceData.bounds || intensity <= 0) return;

  const { bounds, contour, faceWidth, faceHeight, landmarks } = faceData;

  // Maximum inward shift: up to 12% of face width
  const slimAmount = (intensity / 100) * (faceWidth || bounds.width) * 0.12;

  // Only affect the lower 40% of the face (below nose)
  const faceTop = bounds.y;
  const faceMid = faceTop + (faceHeight || bounds.height) * 0.6;
  const faceBottom = faceTop + (faceHeight || bounds.height);
  const faceCenterX = bounds.x + (faceWidth || bounds.width) / 2;

  // Determine region to process (add padding)
  const pad = 20;
  const rx = Math.max(0, Math.floor(bounds.x - pad));
  const ry = Math.max(0, Math.floor(faceMid));
  const rw = Math.min(canvasWidth - rx, Math.ceil((faceWidth || bounds.width) + pad * 2));
  const rh = Math.min(canvasHeight - ry, Math.ceil(faceBottom - faceMid + pad));

  if (rw <= 0 || rh <= 0) return;

  // Collect jaw contour points (lower portion of contour)
  const jawPoints = (contour || []).filter((p) => p.y >= faceMid);
  if (jawPoints.length === 0) return;

  // Influence radius — how far from jaw the effect reaches
  const influenceRadius = (faceWidth || bounds.width) * 0.4;

  // Read source pixels
  const srcData = ctx.getImageData(rx, ry, rw, rh);
  const src = srcData.data;

  // Create output buffer (copy of source)
  const dstData = ctx.createImageData(rw, rh);
  const dst = dstData.data;
  dst.set(src);

  // Process each pixel in the region
  for (let py = 0; py < rh; py++) {
    const absY = ry + py;
    // Vertical falloff: 0 at faceMid, 1 at faceBottom
    const verticalT = Math.min(1, Math.max(0, (absY - faceMid) / (faceBottom - faceMid)));

    for (let px = 0; px < rw; px++) {
      const absX = rx + px;

      // Jaw proximity weight
      const jw = jawInfluence(absX, absY, jawPoints, influenceRadius);
      if (jw <= 0.001) continue;

      // Direction: push towards face centre X
      const dx = faceCenterX - absX;
      const sign = dx >= 0 ? 1 : -1;

      // Combined weight
      const weight = jw * verticalT;

      // Displacement amount (in source space — we sample FROM the offset position)
      const offsetX = -sign * slimAmount * weight;

      // Source coordinate to sample from
      const sx = px + offsetX;
      const sy = py; // no vertical displacement

      if (sx < 0 || sx >= rw - 1 || sy < 0 || sy >= rh - 1) continue;

      const [r, g, b, a] = sampleBilinear(src, rw, rh, sx, sy);
      const idx = (py * rw + px) * 4;
      dst[idx] = r;
      dst[idx + 1] = g;
      dst[idx + 2] = b;
      dst[idx + 3] = a;
    }
  }

  ctx.putImageData(dstData, rx, ry);
}

/* ================================================================
   NATIVE — FaceSlimmingNative (Skia component)
   ================================================================ */

/**
 * Native Skia component for face slimming via mesh distortion.
 *
 * @param {object} props
 * @param {object} props.faceData
 * @param {number} props.intensity  — 0-100
 * @param {number} props.canvasWidth
 * @param {number} props.canvasHeight
 * @returns {React.Element|null}
 */
export function FaceSlimmingNative(props) {
  if (!SkiaComponents) return null;

  const { faceData, intensity } = props;
  if (!faceData || !faceData.bounds || intensity <= 0) return null;

  const { Group, Skia } = SkiaComponents;
  const { bounds, faceWidth, faceHeight } = faceData;

  const slimAmount = (intensity / 100) * (faceWidth || bounds.width) * 0.12;
  const faceCenterX = bounds.x + (faceWidth || bounds.width) / 2;

  // Build a distortion path that pushes jaw inward
  const path = Skia.Path.Make();
  const contour = faceData.contour || [];
  const faceMidY = bounds.y + (faceHeight || bounds.height) * 0.6;

  if (contour.length > 0) {
    path.moveTo(contour[0].x, contour[0].y);
    for (let i = 1; i < contour.length; i++) {
      const p = contour[i];
      if (p.y >= faceMidY) {
        const dx = faceCenterX - p.x;
        const sign = dx >= 0 ? 1 : -1;
        const t = Math.min(1, (p.y - faceMidY) / ((faceHeight || bounds.height) * 0.4));
        path.lineTo(p.x + sign * slimAmount * t, p.y);
      } else {
        path.lineTo(p.x, p.y);
      }
    }
    path.close();
  }

  // In a full implementation this path would be used with a mesh shader
  // or displacement map. For now we return a clipped group as a placeholder.
  return <Group clip={path} />;
}

export default {
  drawFaceSlimming,
  FaceSlimmingNative,
  shouldSkipFrame,
};
