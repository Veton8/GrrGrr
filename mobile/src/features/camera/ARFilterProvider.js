/**
 * AR Filter Provider
 *
 * Architecture for real-time face filters using:
 * - react-native-vision-camera (frame processing)
 * - @react-native-ml-kit/face-detection (face landmark detection)
 * - @shopify/react-native-skia (overlay rendering)
 *
 * NOTE: This requires a development build (expo dev client).
 * It will NOT work in Expo Go.
 *
 * To enable:
 * 1. Run: npx expo prebuild
 * 2. Run: npx expo run:ios (or run:android)
 * 3. Uncomment the imports below and replace expo-camera in RecordVideoScreen
 *
 * Face filter effects are defined as overlay assets in the effects/ directory.
 * Each effect specifies anchor points relative to face landmarks
 * (e.g., nose tip, forehead, chin) and SVG/PNG assets to render.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

// Available face filter effects
export const FACE_FILTERS = [
  { id: 'none', name: 'None', icon: 'ban-outline', overlay: null },
  { id: 'dog', name: 'Puppy', icon: 'paw-outline', overlay: 'dog_ears_nose' },
  { id: 'cat', name: 'Cat', icon: 'logo-octocat', overlay: 'cat_ears_whiskers' },
  { id: 'crown', name: 'Crown', icon: 'trophy-outline', overlay: 'golden_crown' },
  { id: 'glasses', name: 'Shades', icon: 'glasses-outline', overlay: 'sunglasses' },
  { id: 'hearts', name: 'Hearts', icon: 'heart-outline', overlay: 'floating_hearts' },
  { id: 'devil', name: 'Devil', icon: 'flame-outline', overlay: 'devil_horns' },
  { id: 'angel', name: 'Angel', icon: 'star-outline', overlay: 'angel_halo' },
  { id: 'beauty_plus', name: 'Glow', icon: 'sparkles-outline', overlay: 'beauty_smooth' },
];

const ARFilterContext = createContext({
  activeFilter: FACE_FILTERS[0],
  setActiveFilter: () => {},
  faceData: null,
  isARAvailable: false,
});

export function ARFilterProvider({ children }) {
  const [activeFilter, setActiveFilterState] = useState(FACE_FILTERS[0]);
  const [faceData, setFaceData] = useState(null);

  // Check if native AR modules are available (dev build only)
  const isARAvailable = (() => {
    try {
      require('react-native-vision-camera');
      require('@react-native-ml-kit/face-detection');
      return true;
    } catch {
      return false;
    }
  })();

  const setActiveFilter = useCallback((filterId) => {
    const filter = FACE_FILTERS.find(f => f.id === filterId) || FACE_FILTERS[0];
    setActiveFilterState(filter);
  }, []);

  return (
    <ARFilterContext.Provider value={{ activeFilter, setActiveFilter, faceData, setFaceData, isARAvailable }}>
      {children}
    </ARFilterContext.Provider>
  );
}

export function useARFilter() {
  return useContext(ARFilterContext);
}

/**
 * Face filter overlay renderer (Skia-based)
 *
 * Usage (in dev build with vision-camera frame processor):
 *
 * ```js
 * import { Canvas, Image } from '@shopify/react-native-skia';
 *
 * function FaceOverlay({ faceData, filter, width, height }) {
 *   if (!faceData || !filter.overlay) return null;
 *
 *   const { bounds, landmarks } = faceData;
 *   // Position overlay assets relative to face landmarks
 *   // e.g., dog ears above forehead, nose on nose tip
 *
 *   return (
 *     <Canvas style={{ position: 'absolute', width, height }}>
 *       <Image
 *         image={filterAssets[filter.overlay]}
 *         x={landmarks.noseBase.x - assetWidth/2}
 *         y={landmarks.noseBase.y - assetHeight/2}
 *         width={assetWidth}
 *         height={assetHeight}
 *       />
 *     </Canvas>
 *   );
 * }
 * ```
 */
