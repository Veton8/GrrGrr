import AnimatedHeart from './AnimatedHeart';
import AnimatedFlame from './AnimatedFlame';
import AnimatedRose from './AnimatedRose';
import AnimatedDiamond from './AnimatedDiamond';
import AnimatedRocket from './AnimatedRocket';
import AnimatedGoldenLion from './AnimatedGoldenLion';
import AnimatedDragon from './AnimatedDragon';

// Map gift names to their animated icon components
export const ANIMATED_ICONS = {
  heart: AnimatedHeart,
  rose: AnimatedRose,
  star: AnimatedHeart,     // reuse heart with different color (TODO: AnimatedStar)
  fire: AnimatedFlame,
  diamond: AnimatedDiamond,
  crown: AnimatedDiamond,  // reuse diamond with gold tint (TODO: AnimatedCrown)
  rocket: AnimatedRocket,
  castle: AnimatedDiamond, // placeholder
  lion: AnimatedGoldenLion,
  universe: AnimatedDragon, // placeholder — dragon is impressive enough
  'sports car': AnimatedRocket,  // reuse rocket
  'diamond ring': AnimatedDiamond,
  'treasure chest': AnimatedDiamond,
  'golden lion': AnimatedGoldenLion,
  'crystal palace': AnimatedDiamond,
  'private jet': AnimatedRocket,
  'galaxy portal': AnimatedDragon,
  dragon: AnimatedDragon,
};

// Get the animated icon component for a gift name (case-insensitive)
export function getAnimatedIcon(giftName) {
  if (!giftName) return null;
  return ANIMATED_ICONS[giftName.toLowerCase()] || null;
}

export {
  AnimatedHeart,
  AnimatedFlame,
  AnimatedRose,
  AnimatedDiamond,
  AnimatedRocket,
  AnimatedGoldenLion,
  AnimatedDragon,
};
