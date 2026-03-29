/**
 * Camera filter definitions.
 * Each filter has a name, icon, and a color matrix for Skia-based rendering.
 * Color matrices are 4x5 (20 values) applied as RGBA transformations.
 */

// Identity matrix (no change)
const IDENTITY = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

export const FILTERS = [
  {
    id: 'none',
    name: 'Normal',
    icon: 'ban-outline',
    matrix: IDENTITY,
  },
  {
    id: 'beauty',
    name: 'Beauty',
    icon: 'sparkles',
    // Slightly brighter, softer, warmer
    matrix: [
      1.1, 0.05, 0.02, 0, 10,
      0.02, 1.08, 0.02, 0, 8,
      0.0, 0.02, 1.0, 0, 5,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: 'warm',
    name: 'Warm',
    icon: 'sunny-outline',
    // Warm golden tones
    matrix: [
      1.2, 0.1, 0, 0, 15,
      0.05, 1.1, 0, 0, 10,
      0, 0, 0.9, 0, 0,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: 'cool',
    name: 'Cool',
    icon: 'snow-outline',
    // Cool blue tones
    matrix: [
      0.9, 0, 0.05, 0, 0,
      0, 1.0, 0.1, 0, 5,
      0.05, 0.1, 1.2, 0, 15,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: 'vintage',
    name: 'Vintage',
    icon: 'film-outline',
    // Faded, warm, low contrast
    matrix: [
      0.9, 0.15, 0.1, 0, 20,
      0.1, 0.85, 0.1, 0, 15,
      0.05, 0.1, 0.7, 0, 25,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: 'bw',
    name: 'B&W',
    icon: 'contrast-outline',
    // Grayscale with slight contrast boost
    matrix: [
      0.33, 0.59, 0.11, 0, 0,
      0.33, 0.59, 0.11, 0, 0,
      0.33, 0.59, 0.11, 0, 0,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: 'dramatic',
    name: 'Dramatic',
    icon: 'thunderstorm-outline',
    // High contrast, slightly desaturated
    matrix: [
      1.3, -0.1, -0.1, 0, -15,
      -0.1, 1.3, -0.1, 0, -15,
      -0.1, -0.1, 1.3, 0, -15,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    icon: 'partly-sunny-outline',
    // Orange/pink warm sunset feel
    matrix: [
      1.3, 0.1, 0, 0, 20,
      0.05, 0.95, 0.05, 0, 5,
      0, 0.05, 0.85, 0, -10,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: 'neon',
    name: 'Neon',
    icon: 'flash-outline',
    // Vivid, saturated, cyberpunk feel
    matrix: [
      1.4, 0, 0.1, 0, 0,
      0, 1.2, 0.15, 0, 0,
      0.1, 0, 1.5, 0, 10,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: 'rose',
    name: 'Rosé',
    icon: 'rose-outline',
    // Pink/rose tint
    matrix: [
      1.2, 0.1, 0.1, 0, 15,
      0.05, 0.95, 0.05, 0, 5,
      0.1, 0.05, 1.05, 0, 10,
      0, 0, 0, 1, 0,
    ],
  },
];

export function getFilterById(id) {
  return FILTERS.find((f) => f.id === id) || FILTERS[0];
}
