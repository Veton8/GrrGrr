/**
 * EyeEnlarge.js — Beauty filter that applies spherical magnification to eyes.
 *
 * Platform support:
 *   - Web: Barrel distortion via pixel manipulation on each eye region.
 *          Uses sub-pixel bilinear interpolation for smooth results.
 *   - Native: Skia shader-based distortion (guarded import).
 *
 * Performance notes:
 *   - Processes a circular region around each eye (~π*r^2 pixels per eye).
 *   - For a typical eye radius of ~40 px that is ~5 K pixels per eye,
 *     ~10 K total — much cheaper than FaceSlimming.
 *   - Uses getImageData scoped to a tight bounding box to minimise memory.
 *
 * @module filters/beauty/EyeEnlarge
 */

import { Platform } from 'react-native';

/* ---------- Native (Skia) — guarded import ---------- */

let SkiaComponents = null;

if (Platform.OS !== 'web') {
  try {
    const Skia = require('@shopify/react-native-skia');
    SkiaComponents = {
      Group: Skia.Group,
      Circle: Skia.Circle,
      Skia: Skia.Skia,
    };
  } catch (e) {
    console.warn('[EyeEnlarge] Skia not available:', e.message);
  }
}

/* ---------- Bilinear interpolation ---------- */

/**
 * Sample a pixel from source ImageData using bilinear interpolation.
 *
 * @param {Uint8ClampedArray} src
 * @param {number} w  — region width
 * @param {number} h  — region height
 * @param {number} x  — sub-pixel x
 * @param {number} y  — sub-pixel y
 * @returns {[number,number,number,number]} RGBA
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

/* ---------- Eye centre / width helpers ---------- */

/**
 * Compute centre and approximate width of an eye from its landmark points.
 *
 * @param {Array<{x:number, y:number}>} eyePoints
 * @returns {{cx: number, cy: number, width: number}}
 */
function eyeGeometry(eyePoints) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let sx = 0;
  let sy = 0;

  for (const p of eyePoints) {
    sx += p.x;
    sy += p.y;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    cx: sx / eyePoints.length,
    cy: sy / eyePoints.length,
    width: maxX - minX,
  };
}

/* ================================================================
   WEB — drawEyeEnlarge
   ================================================================ */

/**
 * Apply barrel distortion (spherical magnification) at each eye.
 *
 * For every pixel inside the eye circle we compute the normalised distance
 * from the eye centre (0 at centre, 1 at radius edge).  We then apply an
 * inverse barrel function to find the source coordinate:
 *
 *     r_src = r_dst / magnification   (for r_dst < 1)
 *
 * This pushes pixels outward from the centre, making the eye appear larger.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object}                  faceData
 * @param {number}                  intensity     — 0-100
 * @param {HTMLVideoElement}        videoElement
 * @param {number}                  canvasWidth
 * @param {number}                  canvasHeight
 */
export function drawEyeEnlarge(ctx, faceData, intensity, videoElement, canvasWidth, canvasHeight) {
  if (!faceData || !faceData.landmarks || intensity <= 0) return;

  const { landmarks } = faceData;
  const eyes = [];

  if (landmarks.leftEye && landmarks.leftEye.length > 0) {
    eyes.push(eyeGeometry(landmarks.leftEye));
  }
  if (landmarks.rightEye && landmarks.rightEye.length > 0) {
    eyes.push(eyeGeometry(landmarks.rightEye));
  }

  if (eyes.length === 0) return;

  // Magnification: 1.0 – 1.25 mapped from intensity 0-100
  const mag = 1.0 + (intensity / 100) * 0.25;

  for (const eye of eyes) {
    const radius = Math.round(eye.width * 1.5);
    if (radius <= 2) continue;

    // Bounding box for this eye region (clamped to canvas)
    const bx = Math.max(0, Math.floor(eye.cx - radius));
    const by = Math.max(0, Math.floor(eye.cy - radius));
    const bw = Math.min(canvasWidth - bx, radius * 2);
    const bh = Math.min(canvasHeight - by, radius * 2);

    if (bw <= 0 || bh <= 0) continue;

    // Read source pixels
    const srcData = ctx.getImageData(bx, by, bw, bh);
    const src = srcData.data;
    const dstData = ctx.createImageData(bw, bh);
    const dst = dstData.data;
    dst.set(src); // start with a copy

    // Local eye centre relative to bounding box
    const lcx = eye.cx - bx;
    const lcy = eye.cy - by;
    const r2 = radius * radius;

    for (let py = 0; py < bh; py++) {
      for (let px = 0; px < bw; px++) {
        const dx = px - lcx;
        const dy = py - lcy;
        const dist2 = dx * dx + dy * dy;

        if (dist2 >= r2) continue; // outside influence circle

        const dist = Math.sqrt(dist2);
        const normDist = dist / radius; // 0..1

        // Inverse barrel: source is closer to centre than destination
        const srcNorm = normDist / mag;
        const scale = dist > 0 ? (srcNorm * radius) / dist : 1;

        const sx = lcx + dx * scale;
        const sy = lcy + dy * scale;

        if (sx < 0 || sx >= bw - 1 || sy < 0 || sy >= bh - 1) continue;

        const [r, g, b, a] = sampleBilinear(src, bw, bh, sx, sy);
        const idx = (py * bw + px) * 4;
        dst[idx] = r;
        dst[idx + 1] = g;
        dst[idx + 2] = b;
        dst[idx + 3] = a;
      }
    }

    ctx.putImageData(dstData, bx, by);
  }
}

/* ================================================================
   NATIVE — EyeEnlargeNative (Skia component)
   ================================================================ */

/**
 * Native Skia component for eye enlargement.
 *
 * A full implementation would use a RuntimeEffect (SKSL shader) to apply
 * barrel distortion. This placeholder provides the structure and clip regions.
 *
 * @param {object} props
 * @param {object} props.faceData
 * @param {number} props.intensity  — 0-100
 * @param {number} props.canvasWidth
 * @param {number} props.canvasHeight
 * @returns {React.Element|null}
 */
export function EyeEnlargeNative(props) {
  if (!SkiaComponents) return null;

  const { faceData, intensity } = props;
  if (!faceData || !faceData.landmarks || intensity <= 0) return null;

  const { Group, Circle } = SkiaComponents;
  const { landmarks } = faceData;
  const mag = 1.0 + (intensity / 100) * 0.25;
  const elements = [];

  const processEye = (eyePoints, key) => {
    if (!eyePoints || eyePoints.length === 0) return;
    const geo = eyeGeometry(eyePoints);
    const radius = geo.width * 1.5;
    elements.push(
      <Group key={key}>
        <Circle cx={geo.cx} cy={geo.cy} r={radius} />
      </Group>
    );
  };

  processEye(landmarks.leftEye, 'left');
  processEye(landmarks.rightEye, 'right');

  if (elements.length === 0) return null;

  return <Group>{elements}</Group>;
}

export default {
  drawEyeEnlarge,
  EyeEnlargeNative,
};
