/**
 * Beauty Filters — barrel export and registry.
 *
 * Exports every individual filter module plus a BEAUTY_FILTERS array
 * that maps each filter to its metadata and web draw function.
 *
 * Usage (web):
 *   import { BEAUTY_FILTERS, drawSkinSmoothing } from '../filters/beauty';
 *
 * Usage (native):
 *   import { SkinSmoothingNative } from '../filters/beauty';
 *
 * @module filters/beauty
 */

/* ---------- Web draw functions ---------- */
export { drawSkinSmoothing, SkinSmoothingNative } from './SkinSmoothing';
export { drawFaceBrightening, FaceBrighteningNative } from './FaceBrightening';
export { drawFaceSlimming, FaceSlimmingNative, shouldSkipFrame } from './FaceSlimming';
export { drawEyeEnlarge, EyeEnlargeNative } from './EyeEnlarge';
export { drawLipColor, LipColorNative, LIP_COLORS } from './LipColor';

/* ---------- Re-import for registry wiring ---------- */
import { drawSkinSmoothing } from './SkinSmoothing';
import { drawFaceBrightening } from './FaceBrightening';
import { drawFaceSlimming } from './FaceSlimming';
import { drawEyeEnlarge } from './EyeEnlarge';
import { drawLipColor } from './LipColor';

/**
 * Registry of all beauty filters with metadata for UI rendering.
 *
 * Each entry contains:
 *   - id       {string}   — unique key for state management
 *   - name     {string}   — display label
 *   - icon     {string}   — Ionicons icon name (react-native-vector-icons)
 *   - draw     {Function} — web draw function (signature varies per filter)
 *
 * @type {Array<{id: string, name: string, icon: string, draw: Function}>}
 */
export const BEAUTY_FILTERS = [
  { id: 'skinSmoothing', name: 'Smooth', icon: 'brush-outline', draw: drawSkinSmoothing },
  { id: 'faceBrightening', name: 'Brighten', icon: 'sunny-outline', draw: drawFaceBrightening },
  { id: 'faceSlimming', name: 'Slim', icon: 'resize-outline', draw: drawFaceSlimming },
  { id: 'eyeEnlarge', name: 'Eyes', icon: 'eye-outline', draw: drawEyeEnlarge },
  { id: 'lipColor', name: 'Lips', icon: 'color-palette-outline', draw: drawLipColor },
];
