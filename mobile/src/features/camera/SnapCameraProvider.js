/**
 * Snap Camera Kit Provider
 *
 * Wraps the Snap Camera Kit SDK for React Native.
 * Provides lens browsing, applying, and camera session management.
 *
 * REQUIRES a development build (not Expo Go).
 * In Expo Go, isSnapAvailable will be false and the app
 * falls back to expo-camera with color filters.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { Platform } from 'react-native';
import { SNAP_CAMERA_KIT } from '../../config/snapKit';

// Try to import Snap Camera Kit (only available in dev builds)
let CameraKitModule = null;
try {
  CameraKitModule = require('@snap/camera-kit-react-native');
} catch {
  // Not available — running in Expo Go
}

const SnapCameraContext = createContext({
  isSnapAvailable: false,
  lenses: [],
  activeLens: null,
  applyLens: () => {},
  clearLens: () => {},
  cameraKitRef: null,
  isLoading: true,
});

export function SnapCameraProvider({ children }) {
  const [isSnapAvailable] = useState(() => CameraKitModule !== null);
  const [lenses, setLenses] = useState([]);
  const [activeLens, setActiveLens] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const cameraKitRef = useRef(null);
  const sessionRef = useRef(null);

  // Initialize Snap Camera Kit and load lenses
  useEffect(() => {
    if (!isSnapAvailable || !CameraKitModule) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    (async () => {
      try {
        const apiToken =
          Platform.OS === 'ios'
            ? SNAP_CAMERA_KIT.ios.apiToken
            : SNAP_CAMERA_KIT.android.apiToken;

        if (!apiToken) {
          console.warn('Snap Camera Kit: No API token for platform', Platform.OS);
          setIsLoading(false);
          return;
        }

        // Bootstrap Camera Kit
        const cameraKit = await CameraKitModule.bootstrapCameraKit({
          apiToken,
        });

        // Create a session
        const session = await cameraKit.createSession();
        sessionRef.current = session;

        // Load lenses from our group
        const loadedLenses = await session.lensRepository.loadLensGroups([
          SNAP_CAMERA_KIT.lensGroupId,
        ]);

        if (mounted) {
          // Flatten lens groups into a single array
          const allLenses = loadedLenses.flatMap((group) => group.lenses || []);
          setLenses(allLenses);
        }
      } catch (err) {
        console.error('Snap Camera Kit init error:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isSnapAvailable]);

  const applyLens = useCallback(
    async (lens) => {
      if (!sessionRef.current || !lens) return;
      try {
        await sessionRef.current.applyLens(lens);
        setActiveLens(lens);
      } catch (err) {
        console.error('Failed to apply lens:', err);
      }
    },
    []
  );

  const clearLens = useCallback(async () => {
    if (!sessionRef.current) return;
    try {
      await sessionRef.current.removeLens();
      setActiveLens(null);
    } catch (err) {
      console.error('Failed to clear lens:', err);
    }
  }, []);

  return (
    <SnapCameraContext.Provider
      value={{
        isSnapAvailable,
        lenses,
        activeLens,
        applyLens,
        clearLens,
        cameraKitRef,
        session: sessionRef.current,
        isLoading,
      }}
    >
      {children}
    </SnapCameraContext.Provider>
  );
}

export function useSnapCamera() {
  return useContext(SnapCameraContext);
}

/**
 * Snap Camera View wrapper
 *
 * Usage in RecordVideoScreen (dev build only):
 *
 * ```jsx
 * import { SnapCameraView } from '../features/camera/SnapCameraProvider';
 *
 * <SnapCameraView
 *   ref={cameraKitRef}
 *   style={StyleSheet.absoluteFill}
 *   facing="front"
 * />
 * ```
 */
export const SnapCameraView = CameraKitModule
  ? React.forwardRef((props, ref) => {
      const Component = CameraKitModule.CameraKitCameraView || CameraKitModule.default;
      if (!Component) return null;
      return <Component ref={ref} {...props} />;
    })
  : React.forwardRef(() => null);
