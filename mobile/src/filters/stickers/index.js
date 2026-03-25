/**
 * Sticker filter registry
 *
 * Each entry maps a filter ID to its metadata and draw function.
 * Draw functions share the signature:
 *   draw(ctx, faceData, prevFaceData, time)
 */

import { drawDogFilter } from './DogFilter';
import { drawCatFilter } from './CatFilter';
import { drawCrownFilter } from './CrownFilter';
import { drawSunglassesFilter } from './SunglassesFilter';
import { drawDevilFilter } from './DevilFilter';
import { drawAngelFilter } from './AngelFilter';
import { drawFlameAuraFilter } from './FlameAuraFilter';
import { drawSparkleFrameFilter } from './SparkleFrameFilter';

export const STICKER_FILTERS = [
  { id: 'dog', name: 'Dog', category: 'funny', emoji: '\u{1F415}', draw: drawDogFilter },
  { id: 'cat', name: 'Cat', category: 'funny', emoji: '\u{1F431}', draw: drawCatFilter },
  { id: 'crown', name: 'Crown', category: 'fantasy', emoji: '\u{1F451}', draw: drawCrownFilter },
  { id: 'sunglasses', name: 'Shades', category: 'funny', emoji: '\u{1F60E}', draw: drawSunglassesFilter },
  { id: 'devil', name: 'Devil', category: 'fantasy', emoji: '\u{1F608}', draw: drawDevilFilter },
  { id: 'angel', name: 'Angel', category: 'fantasy', emoji: '\u{1F607}', draw: drawAngelFilter },
  { id: 'flameAura', name: 'Flame', category: 'effects', emoji: '\u{1F525}', draw: drawFlameAuraFilter },
  { id: 'sparkleFrame', name: 'Sparkle', category: 'effects', emoji: '\u{2728}', draw: drawSparkleFrameFilter },
];

export {
  drawDogFilter,
  drawCatFilter,
  drawCrownFilter,
  drawSunglassesFilter,
  drawDevilFilter,
  drawAngelFilter,
  drawFlameAuraFilter,
  drawSparkleFrameFilter,
};
