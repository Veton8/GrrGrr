/**
 * FaceFilterEngine.js
 *
 * Cross-platform face filter engine for Expo SDK 51.
 *
 * - Native (iOS/Android): react-native-vision-camera + @react-native-ml-kit/face-detection
 *   + @shopify/react-native-skia for overlay rendering.
 * - Web: MediaPipe FaceMesh (lazy-loaded from CDN) + HTML <video>/<canvas>.
 *
 * All face data is normalized into a common format (see types.js) so filter
 * implementations work identically on every platform.
 *
 * Usage:
 *   <FaceFilterEngine
 *     activeFilters={['dog', 'skinSmoothing']}
 *     filterSettings={{ skinSmoothing: { intensity: 50 } }}
 *     cameraPosition="front"
 *     onFaceDetected={(faceData) => {}}
 *     style={{ flex: 1 }}
 *   />
 */

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';

import {
  MP_LANDMARKS,
  FACE_DETECTION_FPS,
  FRAME_SKIP_THRESHOLD,
  LANDMARK_SMOOTHING,
  MAX_FACES,
  MIN_DETECTION_CONFIDENCE,
  MIN_TRACKING_CONFIDENCE,
  FACE_LOST_DEBOUNCE_MS,
  DEFAULT_FILTER_SETTINGS,
} from './types';

// ── Guarded native imports ──────────────────────────────────────────

let Camera, useCameraDevice, useFrameProcessor;
let MLKitFaceDetection;
let SkiaCanvas, SkiaImage, SkiaPaint, useCanvasRef;

if (Platform.OS !== 'web') {
  try {
    const vc = require('react-native-vision-camera');
    Camera = vc.Camera;
    useCameraDevice = vc.useCameraDevice;
    useFrameProcessor = vc.useFrameProcessor;
  } catch (e) {
    console.warn('[FaceFilterEngine] react-native-vision-camera not available:', e.message);
  }

  try {
    MLKitFaceDetection = require('@react-native-ml-kit/face-detection');
  } catch (e) {
    console.warn('[FaceFilterEngine] @react-native-ml-kit/face-detection not available:', e.message);
  }

  try {
    const skia = require('@shopify/react-native-skia');
    SkiaCanvas = skia.Canvas;
    SkiaImage = skia.Image;
    SkiaPaint = skia.Paint;
    useCanvasRef = skia.useCanvasRef;
  } catch (e) {
    console.warn('[FaceFilterEngine] @shopify/react-native-skia not available:', e.message);
  }
}

// ── Face data context ───────────────────────────────────────────────

const FaceDataContext = createContext(null);

/**
 * Hook to access the latest normalized face data from the nearest
 * <FaceFilterEngine> ancestor.
 *
 * @returns {NormalizedFaceData | null}
 */
export function useFaceData() {
  return useContext(FaceDataContext);
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Linear interpolation between two points. */
function lerpPoint(prev, next, t) {
  if (!prev) return next;
  return {
    x: prev.x * t + next.x * (1 - t),
    y: prev.y * t + next.y * (1 - t),
  };
}

/** Lerp an array of points. */
function lerpPointArray(prev, next, t) {
  if (!prev || prev.length !== next.length) return next;
  return next.map((pt, i) => lerpPoint(prev[i], pt, t));
}

/** Euclidean distance between two {x,y} points. */
function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Clamp a value between 0 and 1. */
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

// ── MediaPipe web loader (lazy, singleton) ──────────────────────────

const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh';

let _mediaPipePromise = null;
let _faceMeshInstance = null;

function loadMediaPipeScript(src) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('No document available'));
      return;
    }
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Lazily load and initialise a MediaPipe FaceMesh instance.
 * Returns a singleton promise so the CDN scripts are fetched only once.
 */
function getMediaPipeFaceMesh() {
  if (_mediaPipePromise) return _mediaPipePromise;

  _mediaPipePromise = (async () => {
    // Load the main FaceMesh script
    await loadMediaPipeScript(`${MEDIAPIPE_CDN}/face_mesh.js`);

    // FaceMesh is attached to globalThis by the script
    const FaceMeshCtor = globalThis.FaceMesh;
    if (!FaceMeshCtor) {
      throw new Error('FaceMesh constructor not found on globalThis after script load');
    }

    const faceMesh = new FaceMeshCtor({
      locateFile: (file) => `${MEDIAPIPE_CDN}/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: MAX_FACES,
      refineLandmarks: true,
      minDetectionConfidence: MIN_DETECTION_CONFIDENCE,
      minTrackingConfidence: MIN_TRACKING_CONFIDENCE,
    });

    // Wrap the callback-based API in a resolve pattern
    let _resolve = null;
    faceMesh.onResults((results) => {
      if (_resolve) {
        _resolve(results);
        _resolve = null;
      }
    });

    _faceMeshInstance = faceMesh;

    // Attach a helper that sends a frame and returns results as a promise
    faceMesh._sendAndWait = (videoEl) => {
      return new Promise((resolve) => {
        _resolve = resolve;
        faceMesh.send({ image: videoEl });
      });
    };

    return faceMesh;
  })();

  return _mediaPipePromise;
}

// ── MediaPipe -> common format normalizer ───────────────────────────

function extractContour(landmarks, indices, w, h) {
  return indices.map((i) => ({
    x: landmarks[i].x * w,
    y: landmarks[i].y * h,
  }));
}

function normalizeMediaPipeFace(landmarks, videoWidth, videoHeight) {
  const w = videoWidth;
  const h = videoHeight;

  const lm = (idx) => ({
    x: landmarks[idx].x * w,
    y: landmarks[idx].y * h,
  });

  const leftEye = lm(MP_LANDMARKS.LEFT_EYE_CENTER);
  const rightEye = lm(MP_LANDMARKS.RIGHT_EYE_CENTER);
  const noseTip = lm(MP_LANDMARKS.NOSE_TIP);
  const mouthCenter = lm(MP_LANDMARKS.MOUTH_CENTER);
  const mouthLeft = lm(MP_LANDMARKS.MOUTH_LEFT);
  const mouthRight = lm(MP_LANDMARKS.MOUTH_RIGHT);
  const leftCheek = lm(MP_LANDMARKS.LEFT_CHEEK);
  const rightCheek = lm(MP_LANDMARKS.RIGHT_CHEEK);
  const forehead = lm(MP_LANDMARKS.FOREHEAD);
  const chin = lm(MP_LANDMARKS.CHIN);

  // Bounding box from face contour
  const faceContourPts = MP_LANDMARKS.FACE_CONTOUR.map((i) => lm(i));
  const xs = faceContourPts.map((p) => p.x);
  const ys = faceContourPts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const faceWidth = maxX - minX;
  const faceHeight = maxY - minY;

  // Mouth openness: vertical distance between upper/lower lip vs face height
  const upperLipTop = lm(MP_LANDMARKS.UPPER_LIP_TOP);
  const lowerLipBottom = lm(MP_LANDMARKS.LOWER_LIP_BOTTOM);
  const mouthVertical = dist(upperLipTop, lowerLipBottom);
  const mouthOpen = clamp01(mouthVertical / (faceHeight * 0.15));

  // Eye openness: vertical distance between upper/lower eyelid
  const leftEyeUpper = lm(MP_LANDMARKS.LEFT_EYE_UPPER ? MP_LANDMARKS.LEFT_EYE_UPPER[0] : 159);
  const leftEyeLower = lm(MP_LANDMARKS.LEFT_EYE_LOWER ? MP_LANDMARKS.LEFT_EYE_LOWER[0] : 145);
  const rightEyeUpper = lm(MP_LANDMARKS.RIGHT_EYE_UPPER ? MP_LANDMARKS.RIGHT_EYE_UPPER[0] : 386);
  const rightEyeLower = lm(MP_LANDMARKS.RIGHT_EYE_LOWER ? MP_LANDMARKS.RIGHT_EYE_LOWER[0] : 374);

  const leftEyeVert = dist(leftEyeUpper, leftEyeLower);
  const rightEyeVert = dist(rightEyeUpper, rightEyeLower);
  const eyeRefDist = dist(leftEye, rightEye);
  const leftEyeOpen = clamp01(leftEyeVert / (eyeRefDist * 0.06));
  const rightEyeOpen = clamp01(rightEyeVert / (eyeRefDist * 0.06));

  // Head rotation estimation from 3D landmarks
  const noseTip3D = landmarks[MP_LANDMARKS.NOSE_TIP];
  const forehead3D = landmarks[MP_LANDMARKS.FOREHEAD];
  const chin3D = landmarks[MP_LANDMARKS.CHIN];
  const leftCheek3D = landmarks[MP_LANDMARKS.LEFT_CHEEK];
  const rightCheek3D = landmarks[MP_LANDMARKS.RIGHT_CHEEK];

  // Yaw: asymmetry between nose and cheeks
  const noseToLeft = Math.abs(noseTip3D.x - leftCheek3D.x);
  const noseToRight = Math.abs(noseTip3D.x - rightCheek3D.x);
  const yaw = ((noseToLeft - noseToRight) / (noseToLeft + noseToRight)) * 90;

  // Pitch: vertical position of nose relative to forehead-chin line
  const faceVertCenter = (forehead3D.y + chin3D.y) / 2;
  const pitch = ((noseTip3D.y - faceVertCenter) / (chin3D.y - forehead3D.y)) * 60;

  // Roll: angle of the line between eyes
  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

  return {
    bounds: { x: minX, y: minY, width: faceWidth, height: faceHeight },
    landmarks: {
      leftEye,
      rightEye,
      noseTip,
      mouthCenter,
      mouthLeft,
      mouthRight,
      leftCheek,
      rightCheek,
      foreheadCenter: forehead,
      chinBottom: chin,
    },
    contour: {
      face: faceContourPts,
      leftEye: extractContour(landmarks, MP_LANDMARKS.LEFT_EYE_CONTOUR, w, h),
      rightEye: extractContour(landmarks, MP_LANDMARKS.RIGHT_EYE_CONTOUR, w, h),
      upperLip: extractContour(landmarks, MP_LANDMARKS.UPPER_LIP, w, h),
      lowerLip: extractContour(landmarks, MP_LANDMARKS.LOWER_LIP, w, h),
      noseBridge: extractContour(landmarks, MP_LANDMARKS.NOSE_BRIDGE, w, h),
    },
    rotation: { pitch, yaw, roll },
    mouthOpen,
    leftEyeOpen,
    rightEyeOpen,
    faceWidth,
    faceHeight,
  };
}

// ── ML Kit -> common format normalizer ──────────────────────────────

function normalizeMLKitFace(face, frameWidth, frameHeight) {
  const bounds = face.bounds || face.frame;
  const bx = bounds.x || bounds.origin?.x || 0;
  const by = bounds.y || bounds.origin?.y || 0;
  const bw = bounds.width || bounds.size?.width || 0;
  const bh = bounds.height || bounds.size?.height || 0;

  // Helper to extract landmark point, with fallback to center of bounds
  const lm = (type) => {
    const point = face.landmarks?.find((l) => l.type === type)?.position;
    if (point) return { x: point.x, y: point.y };
    return { x: bx + bw / 2, y: by + bh / 2 };
  };

  const leftEye = lm('leftEye');
  const rightEye = lm('rightEye');
  const noseTip = lm('noseBase');
  const mouthLeft = lm('mouthLeft');
  const mouthRight = lm('mouthRight');
  const mouthCenter = {
    x: (mouthLeft.x + mouthRight.x) / 2,
    y: (mouthLeft.y + mouthRight.y) / 2,
  };
  const leftCheek = lm('leftCheek');
  const rightCheek = lm('rightCheek');
  const foreheadCenter = { x: bx + bw / 2, y: by };
  const chinBottom = { x: bx + bw / 2, y: by + bh };

  // Contours from ML Kit (may not be available depending on config)
  const extractMLKitContour = (type) => {
    const contour = face.contours?.find((c) => c.type === type);
    return contour?.points?.map((p) => ({ x: p.x, y: p.y })) || [];
  };

  const mouthOpen = clamp01((face.smilingProbability ?? 0.5) > 0.7 ? 0.6 : 0.1);
  const leftEyeOpen = clamp01(face.leftEyeOpenProbability ?? 0.8);
  const rightEyeOpen = clamp01(face.rightEyeOpenProbability ?? 0.8);

  const rotation = {
    pitch: face.headEulerAngleX ?? 0,
    yaw: face.headEulerAngleY ?? 0,
    roll: face.headEulerAngleZ ?? 0,
  };

  return {
    bounds: { x: bx, y: by, width: bw, height: bh },
    landmarks: {
      leftEye,
      rightEye,
      noseTip,
      mouthCenter,
      mouthLeft,
      mouthRight,
      leftCheek,
      rightCheek,
      foreheadCenter,
      chinBottom,
    },
    contour: {
      face: extractMLKitContour('face') || [],
      leftEye: extractMLKitContour('leftEye') || [],
      rightEye: extractMLKitContour('rightEye') || [],
      upperLip: extractMLKitContour('upperLipTop') || [],
      lowerLip: extractMLKitContour('lowerLipBottom') || [],
      noseBridge: extractMLKitContour('noseBridge') || [],
    },
    rotation,
    mouthOpen,
    leftEyeOpen,
    rightEyeOpen,
    faceWidth: bw,
    faceHeight: bh,
  };
}

// ── Smoothing helper ────────────────────────────────────────────────

function smoothFaceData(prev, next, factor) {
  if (!prev) return next;

  const smoothedLandmarks = {};
  for (const key of Object.keys(next.landmarks)) {
    smoothedLandmarks[key] = lerpPoint(prev.landmarks[key], next.landmarks[key], factor);
  }

  const smoothedContour = {};
  for (const key of Object.keys(next.contour)) {
    smoothedContour[key] = lerpPointArray(prev.contour[key], next.contour[key], factor);
  }

  return {
    ...next,
    landmarks: smoothedLandmarks,
    contour: smoothedContour,
    rotation: {
      pitch: prev.rotation.pitch * factor + next.rotation.pitch * (1 - factor),
      yaw: prev.rotation.yaw * factor + next.rotation.yaw * (1 - factor),
      roll: prev.rotation.roll * factor + next.rotation.roll * (1 - factor),
    },
    mouthOpen: prev.mouthOpen * factor + next.mouthOpen * (1 - factor),
    leftEyeOpen: prev.leftEyeOpen * factor + next.leftEyeOpen * (1 - factor),
    rightEyeOpen: prev.rightEyeOpen * factor + next.rightEyeOpen * (1 - factor),
  };
}

// ═══════════════════════════════════════════════════════════════════
//  WEB IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

function WebFaceFilterEngine({
  activeFilters,
  filterSettings,
  cameraPosition,
  onFaceDetected,
  style,
  children,
  innerRef,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const [faceData, setFaceData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const prevFaceDataRef = useRef(null);
  const faceMeshRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const faceLostTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const containerRef = useRef(null);

  // Resolve merged filter settings
  const mergedSettings = useMemo(() => {
    const merged = {};
    for (const f of activeFilters || []) {
      merged[f] = { ...(DEFAULT_FILTER_SETTINGS[f] || {}), ...(filterSettings?.[f] || {}) };
    }
    return merged;
  }, [activeFilters, filterSettings]);

  // Expose face data via ref
  useImperativeHandle(innerRef, () => ({
    getFaceData: () => prevFaceDataRef.current,
  }));

  // Camera setup
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function init() {
      try {
        // Start camera
        const facingMode = cameraPosition === 'back' ? 'environment' : 'user';
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        // Load MediaPipe
        const faceMesh = await getMediaPipeFaceMesh();
        if (cancelled) return;
        faceMeshRef.current = faceMesh;

        if (mountedRef.current) setLoading(false);

        // Start detection loop
        runDetectionLoop();
      } catch (err) {
        console.error('[FaceFilterEngine:web] init error:', err);
        if (mountedRef.current) {
          setError(err.message || 'Failed to initialize face detection');
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (faceLostTimerRef.current) clearTimeout(faceLostTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [cameraPosition]);

  // Detection loop
  const runDetectionLoop = useCallback(() => {
    const frameInterval = 1000 / FACE_DETECTION_FPS;

    const loop = async () => {
      if (!mountedRef.current) return;

      const now = performance.now();
      const elapsed = now - lastFrameTimeRef.current;

      // Skip frame if previous took too long
      if (elapsed < frameInterval - 2) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      const video = videoRef.current;
      const faceMesh = faceMeshRef.current;

      if (!video || !faceMesh || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      const frameStart = performance.now();

      try {
        const results = await faceMesh._sendAndWait(video);

        if (!mountedRef.current) return;

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          // Clear face-lost timer
          if (faceLostTimerRef.current) {
            clearTimeout(faceLostTimerRef.current);
            faceLostTimerRef.current = null;
          }

          const rawLandmarks = results.multiFaceLandmarks[0];
          const raw = normalizeMediaPipeFace(rawLandmarks, video.videoWidth, video.videoHeight);
          const smoothed = smoothFaceData(prevFaceDataRef.current, raw, LANDMARK_SMOOTHING);

          prevFaceDataRef.current = smoothed;
          setFaceData(smoothed);
          if (onFaceDetected) onFaceDetected(smoothed);
        } else {
          // Debounce face-lost
          if (!faceLostTimerRef.current) {
            faceLostTimerRef.current = setTimeout(() => {
              if (mountedRef.current) {
                prevFaceDataRef.current = null;
                setFaceData(null);
                if (onFaceDetected) onFaceDetected(null);
              }
              faceLostTimerRef.current = null;
            }, FACE_LOST_DEBOUNCE_MS);
          }
        }
      } catch (err) {
        // Silently continue on individual frame errors
        if (__DEV__) console.warn('[FaceFilterEngine:web] frame error:', err);
      }

      const frameDuration = performance.now() - frameStart;
      lastFrameTimeRef.current = now;

      // If frame processing took too long, skip the next frame
      if (frameDuration > FRAME_SKIP_THRESHOLD) {
        animFrameRef.current = requestAnimationFrame(() => {
          animFrameRef.current = requestAnimationFrame(loop);
        });
      } else {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
  }, [onFaceDetected]);

  // Draw filter overlays on the canvas
  useEffect(() => {
    if (!faceData || !overlayCanvasRef.current || !videoRef.current) return;

    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Mirror the canvas if using front camera
    if (cameraPosition !== 'back') {
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    for (const filterName of activeFilters || []) {
      drawWebFilter(ctx, filterName, faceData, mergedSettings[filterName] || {});
    }

    if (cameraPosition !== 'back') {
      ctx.restore();
    }
  }, [faceData, activeFilters, mergedSettings, cameraPosition]);

  if (error) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Camera Error</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
        </View>
      </View>
    );
  }

  // Web renders a video + canvas stack
  return (
    <FaceDataContext.Provider value={faceData}>
      <View style={[styles.container, style]}>
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            backgroundColor: '#000',
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: cameraPosition !== 'back' ? 'scaleX(-1)' : 'none',
            }}
          />
          <canvas
            ref={overlayCanvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          />
          {loading && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.6)',
              }}
            >
              <span style={{ color: '#fff', fontSize: 16 }}>Loading face detection...</span>
            </div>
          )}
        </div>
        {children}
      </View>
    </FaceDataContext.Provider>
  );
}

// ── Web filter rendering ────────────────────────────────────────────

function drawWebFilter(ctx, filterName, faceData, settings) {
  switch (filterName) {
    case 'skinSmoothing':
      drawWebSkinSmoothing(ctx, faceData, settings);
      break;
    case 'dog':
      drawWebDogFilter(ctx, faceData, settings);
      break;
    case 'cat':
      drawWebCatFilter(ctx, faceData, settings);
      break;
    case 'glasses':
      drawWebGlassesFilter(ctx, faceData, settings);
      break;
    case 'crown':
      drawWebCrownFilter(ctx, faceData, settings);
      break;
    default:
      // Unknown filter - no-op
      break;
  }
}

function drawWebSkinSmoothing(ctx, faceData, settings) {
  const intensity = (settings.intensity ?? 50) / 100;
  if (intensity <= 0) return;

  // Apply a soft blur over the face region
  const { bounds } = faceData;
  const padding = bounds.width * 0.1;
  ctx.save();
  ctx.filter = `blur(${Math.round(intensity * 4)}px)`;
  ctx.globalAlpha = intensity * 0.3;
  ctx.fillStyle = 'rgba(255, 220, 200, 0.15)';

  // Draw an elliptical mask over the face
  ctx.beginPath();
  ctx.ellipse(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
    bounds.width / 2 + padding,
    bounds.height / 2 + padding,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();
}

function drawWebDogFilter(ctx, faceData, settings) {
  const { landmarks, faceWidth, mouthOpen } = faceData;

  // Dog ears (triangles above eyes)
  const earWidth = faceWidth * 0.35;
  const earHeight = faceWidth * 0.5;

  ctx.fillStyle = '#8B4513';
  // Left ear
  ctx.beginPath();
  ctx.moveTo(landmarks.leftEye.x - earWidth / 2, landmarks.leftEye.y);
  ctx.lineTo(landmarks.leftEye.x, landmarks.leftEye.y - earHeight);
  ctx.lineTo(landmarks.leftEye.x + earWidth / 2, landmarks.leftEye.y);
  ctx.closePath();
  ctx.fill();

  // Right ear
  ctx.beginPath();
  ctx.moveTo(landmarks.rightEye.x - earWidth / 2, landmarks.rightEye.y);
  ctx.lineTo(landmarks.rightEye.x, landmarks.rightEye.y - earHeight);
  ctx.lineTo(landmarks.rightEye.x + earWidth / 2, landmarks.rightEye.y);
  ctx.closePath();
  ctx.fill();

  // Inner ear
  ctx.fillStyle = '#DEB887';
  const innerScale = 0.6;
  // Left inner ear
  ctx.beginPath();
  ctx.moveTo(landmarks.leftEye.x - (earWidth * innerScale) / 2, landmarks.leftEye.y);
  ctx.lineTo(landmarks.leftEye.x, landmarks.leftEye.y - earHeight * innerScale);
  ctx.lineTo(landmarks.leftEye.x + (earWidth * innerScale) / 2, landmarks.leftEye.y);
  ctx.closePath();
  ctx.fill();

  // Right inner ear
  ctx.beginPath();
  ctx.moveTo(landmarks.rightEye.x - (earWidth * innerScale) / 2, landmarks.rightEye.y);
  ctx.lineTo(landmarks.rightEye.x, landmarks.rightEye.y - earHeight * innerScale);
  ctx.lineTo(landmarks.rightEye.x + (earWidth * innerScale) / 2, landmarks.rightEye.y);
  ctx.closePath();
  ctx.fill();

  // Dog nose (black oval over nose tip)
  const noseSize = faceWidth * 0.12;
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.ellipse(
    landmarks.noseTip.x,
    landmarks.noseTip.y,
    noseSize,
    noseSize * 0.7,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Tongue when mouth is open
  if (mouthOpen > 0.4) {
    const tongueLength = faceWidth * 0.2 * mouthOpen;
    ctx.fillStyle = '#FF6B8A';
    ctx.beginPath();
    ctx.ellipse(
      landmarks.mouthCenter.x,
      landmarks.mouthCenter.y + tongueLength * 0.5,
      faceWidth * 0.08,
      tongueLength,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

function drawWebCatFilter(ctx, faceData, settings) {
  const { landmarks, faceWidth } = faceData;

  // Cat ears (pointed triangles)
  const earWidth = faceWidth * 0.3;
  const earHeight = faceWidth * 0.45;

  ctx.fillStyle = '#888';
  // Left ear
  ctx.beginPath();
  ctx.moveTo(landmarks.leftEye.x - earWidth * 0.6, landmarks.leftEye.y);
  ctx.lineTo(landmarks.leftEye.x - earWidth * 0.1, landmarks.leftEye.y - earHeight);
  ctx.lineTo(landmarks.leftEye.x + earWidth * 0.3, landmarks.leftEye.y);
  ctx.closePath();
  ctx.fill();

  // Right ear
  ctx.beginPath();
  ctx.moveTo(landmarks.rightEye.x - earWidth * 0.3, landmarks.rightEye.y);
  ctx.lineTo(landmarks.rightEye.x + earWidth * 0.1, landmarks.rightEye.y - earHeight);
  ctx.lineTo(landmarks.rightEye.x + earWidth * 0.6, landmarks.rightEye.y);
  ctx.closePath();
  ctx.fill();

  // Inner ears
  ctx.fillStyle = '#FFB6C1';
  const s = 0.5;
  ctx.beginPath();
  ctx.moveTo(landmarks.leftEye.x - earWidth * 0.6 * s, landmarks.leftEye.y);
  ctx.lineTo(landmarks.leftEye.x - earWidth * 0.1 * s, landmarks.leftEye.y - earHeight * s);
  ctx.lineTo(landmarks.leftEye.x + earWidth * 0.3 * s, landmarks.leftEye.y);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(landmarks.rightEye.x - earWidth * 0.3 * s, landmarks.rightEye.y);
  ctx.lineTo(landmarks.rightEye.x + earWidth * 0.1 * s, landmarks.rightEye.y - earHeight * s);
  ctx.lineTo(landmarks.rightEye.x + earWidth * 0.6 * s, landmarks.rightEye.y);
  ctx.closePath();
  ctx.fill();

  // Whiskers
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1.5;
  const whiskerLen = faceWidth * 0.35;
  const noseY = landmarks.noseTip.y;

  for (let i = -1; i <= 1; i++) {
    // Left whiskers
    ctx.beginPath();
    ctx.moveTo(landmarks.noseTip.x - faceWidth * 0.05, noseY + i * 6);
    ctx.lineTo(landmarks.noseTip.x - whiskerLen, noseY + i * 12);
    ctx.stroke();

    // Right whiskers
    ctx.beginPath();
    ctx.moveTo(landmarks.noseTip.x + faceWidth * 0.05, noseY + i * 6);
    ctx.lineTo(landmarks.noseTip.x + whiskerLen, noseY + i * 12);
    ctx.stroke();
  }

  // Small cat nose
  ctx.fillStyle = '#FF69B4';
  ctx.beginPath();
  const noseSize = faceWidth * 0.05;
  ctx.moveTo(landmarks.noseTip.x, landmarks.noseTip.y - noseSize);
  ctx.lineTo(landmarks.noseTip.x - noseSize, landmarks.noseTip.y + noseSize * 0.5);
  ctx.lineTo(landmarks.noseTip.x + noseSize, landmarks.noseTip.y + noseSize * 0.5);
  ctx.closePath();
  ctx.fill();
}

function drawWebGlassesFilter(ctx, faceData, settings) {
  const { landmarks, faceWidth } = faceData;

  const eyeDist = dist(landmarks.leftEye, landmarks.rightEye);
  const glassRadius = eyeDist * 0.32;
  const bridgeY = (landmarks.leftEye.y + landmarks.rightEye.y) / 2;

  ctx.strokeStyle = '#333';
  ctx.lineWidth = 3;

  // Left lens
  ctx.beginPath();
  ctx.arc(landmarks.leftEye.x, landmarks.leftEye.y, glassRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Right lens
  ctx.beginPath();
  ctx.arc(landmarks.rightEye.x, landmarks.rightEye.y, glassRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Bridge
  ctx.beginPath();
  ctx.moveTo(landmarks.leftEye.x + glassRadius, bridgeY);
  ctx.lineTo(landmarks.rightEye.x - glassRadius, bridgeY);
  ctx.stroke();

  // Tinted lenses
  ctx.fillStyle = 'rgba(100, 100, 255, 0.15)';
  ctx.beginPath();
  ctx.arc(landmarks.leftEye.x, landmarks.leftEye.y, glassRadius - 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(landmarks.rightEye.x, landmarks.rightEye.y, glassRadius - 1, 0, Math.PI * 2);
  ctx.fill();
}

function drawWebCrownFilter(ctx, faceData, settings) {
  const { landmarks, faceWidth } = faceData;

  const crownWidth = faceWidth * 0.8;
  const crownHeight = faceWidth * 0.35;
  const cx = landmarks.foreheadCenter.x;
  const cy = landmarks.foreheadCenter.y - crownHeight * 0.8;

  ctx.fillStyle = '#FFD700';
  ctx.strokeStyle = '#DAA520';
  ctx.lineWidth = 2;

  // Crown shape
  ctx.beginPath();
  ctx.moveTo(cx - crownWidth / 2, cy + crownHeight);
  ctx.lineTo(cx - crownWidth / 2, cy + crownHeight * 0.4);
  ctx.lineTo(cx - crownWidth * 0.25, cy + crownHeight * 0.7);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx + crownWidth * 0.25, cy + crownHeight * 0.7);
  ctx.lineTo(cx + crownWidth / 2, cy + crownHeight * 0.4);
  ctx.lineTo(cx + crownWidth / 2, cy + crownHeight);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Jewels
  const jewelSize = crownHeight * 0.1;
  ctx.fillStyle = '#FF0000';
  ctx.beginPath();
  ctx.arc(cx, cy + crownHeight * 0.35, jewelSize, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0000FF';
  ctx.beginPath();
  ctx.arc(cx - crownWidth * 0.22, cy + crownHeight * 0.55, jewelSize * 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + crownWidth * 0.22, cy + crownHeight * 0.55, jewelSize * 0.8, 0, Math.PI * 2);
  ctx.fill();
}

// ═══════════════════════════════════════════════════════════════════
//  NATIVE IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

function NativeFaceFilterEngine({
  activeFilters,
  filterSettings,
  cameraPosition,
  onFaceDetected,
  style,
  children,
  innerRef,
}) {
  const [faceData, setFaceData] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError] = useState(null);
  const prevFaceDataRef = useRef(null);
  const faceLostTimerRef = useRef(null);
  const cameraRef = useRef(null);
  const skiaRef = useCanvasRef ? useCanvasRef() : useRef(null);

  const device = useCameraDevice ? useCameraDevice(cameraPosition || 'front') : null;

  // Merged settings
  const mergedSettings = useMemo(() => {
    const merged = {};
    for (const f of activeFilters || []) {
      merged[f] = { ...(DEFAULT_FILTER_SETTINGS[f] || {}), ...(filterSettings?.[f] || {}) };
    }
    return merged;
  }, [activeFilters, filterSettings]);

  // Expose face data via ref
  useImperativeHandle(innerRef, () => ({
    getFaceData: () => prevFaceDataRef.current,
  }));

  // Request camera permission
  useEffect(() => {
    if (!Camera) {
      setError('Camera module not available');
      return;
    }

    Camera.requestCameraPermission().then((status) => {
      if (status === 'granted') {
        setHasPermission(true);
      } else {
        setError('Camera permission denied');
      }
    });

    return () => {
      if (faceLostTimerRef.current) clearTimeout(faceLostTimerRef.current);
    };
  }, []);

  // Frame processor for ML Kit face detection
  const frameProcessor = useFrameProcessor
    ? useFrameProcessor(
        (frame) => {
          'worklet';

          if (!MLKitFaceDetection) return;

          try {
            const faces = MLKitFaceDetection.detectFaces(frame, {
              performanceMode: 'fast',
              landmarkMode: 'all',
              contourMode: 'all',
              classificationMode: 'all',
            });

            if (faces && faces.length > 0) {
              const raw = normalizeMLKitFace(faces[0], frame.width, frame.height);
              // Smoothing and state updates happen on JS thread
              runOnJS(handleNativeFaceResult)(raw);
            } else {
              runOnJS(handleNativeFaceLost)();
            }
          } catch (e) {
            // Frame processing errors are non-fatal
          }
        },
        [mergedSettings]
      )
    : undefined;

  const handleNativeFaceResult = useCallback(
    (raw) => {
      const smoothed = smoothFaceData(prevFaceDataRef.current, raw, LANDMARK_SMOOTHING);
      prevFaceDataRef.current = smoothed;
      setFaceData(smoothed);
      if (onFaceDetected) onFaceDetected(smoothed);

      if (faceLostTimerRef.current) {
        clearTimeout(faceLostTimerRef.current);
        faceLostTimerRef.current = null;
      }
    },
    [onFaceDetected]
  );

  const handleNativeFaceLost = useCallback(() => {
    if (!faceLostTimerRef.current) {
      faceLostTimerRef.current = setTimeout(() => {
        prevFaceDataRef.current = null;
        setFaceData(null);
        if (onFaceDetected) onFaceDetected(null);
        faceLostTimerRef.current = null;
      }, FACE_LOST_DEBOUNCE_MS);
    }
  }, [onFaceDetected]);

  if (error) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Camera Error</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
        </View>
      </View>
    );
  }

  if (!hasPermission || !device) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorSubtext}>
            {!hasPermission ? 'Requesting camera permission...' : 'No camera device found'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <FaceDataContext.Provider value={faceData}>
      <View style={[styles.container, style]}>
        {Camera && (
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            frameProcessor={frameProcessor}
            frameProcessorFps={FACE_DETECTION_FPS}
          />
        )}

        {/* Skia overlay for native filter rendering */}
        {SkiaCanvas && faceData && (
          <SkiaCanvas ref={skiaRef} style={StyleSheet.absoluteFill}>
            {(activeFilters || []).map((filterName) => (
              <NativeFilterOverlay
                key={filterName}
                filterName={filterName}
                faceData={faceData}
                settings={mergedSettings[filterName] || {}}
              />
            ))}
          </SkiaCanvas>
        )}

        {children}
      </View>
    </FaceDataContext.Provider>
  );
}

// ── Native Skia filter overlay (placeholder for per-filter Skia drawing) ──

function NativeFilterOverlay({ filterName, faceData, settings }) {
  // Each filter would use Skia primitives (Path, Circle, Image, etc.)
  // to render its overlay. This is a structural placeholder that filter
  // implementations will fill in.
  //
  // For production, each filter file (e.g., filters/beauty/skinSmoothing.js)
  // would export a Skia component that receives faceData + settings.
  return null;
}

// ═══════════════════════════════════════════════════════════════════
//  ERROR BOUNDARY
// ═══════════════════════════════════════════════════════════════════

class FaceFilterErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[FaceFilterEngine] Uncaught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={[styles.container, this.props.style]}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Face Filter Error</Text>
            <Text style={styles.errorSubtext}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </Text>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  PUBLIC COMPONENT
// ═══════════════════════════════════════════════════════════════════

/**
 * FaceFilterEngine - cross-platform face filter component.
 *
 * On native (iOS/Android): uses VisionCamera + ML Kit + Skia.
 * On web: uses MediaPipe FaceMesh + HTML Canvas.
 *
 * @param {Object} props
 * @param {string[]}  props.activeFilters   - filter IDs to apply (e.g. ['dog', 'skinSmoothing'])
 * @param {Object}    props.filterSettings  - per-filter settings keyed by filter ID
 * @param {'front'|'back'} props.cameraPosition - camera to use (default: 'front')
 * @param {Function}  props.onFaceDetected  - callback with NormalizedFaceData or null
 * @param {Object}    props.style           - container style
 */
const FaceFilterEngine = forwardRef(function FaceFilterEngine(props, ref) {
  const {
    activeFilters = [],
    filterSettings = {},
    cameraPosition = 'front',
    onFaceDetected,
    style,
    children,
    ...rest
  } = props;

  const Engine = Platform.OS === 'web' ? WebFaceFilterEngine : NativeFaceFilterEngine;

  return (
    <FaceFilterErrorBoundary style={style}>
      <Engine
        activeFilters={activeFilters}
        filterSettings={filterSettings}
        cameraPosition={cameraPosition}
        onFaceDetected={onFaceDetected}
        style={style}
        innerRef={ref}
        {...rest}
      >
        {children}
      </Engine>
    </FaceFilterErrorBoundary>
  );
});

export default FaceFilterEngine;

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorSubtext: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
});
