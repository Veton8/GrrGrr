/**
 * types.js - Face filter type definitions and constants
 *
 * MediaPipe 468-landmark indices, performance tuning constants,
 * and filter category enums used across the face filter system.
 */

// ── MediaPipe Face Mesh landmark indices (468 total) ────────────────

/**
 * @typedef {Object} FaceLandmark
 * @property {number} x - normalized x coordinate (0-1)
 * @property {number} y - normalized y coordinate (0-1)
 * @property {number} [z] - depth (MediaPipe only)
 */

/**
 * @typedef {Object} FaceBounds
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} FaceRotation
 * @property {number} pitch - up/down tilt in degrees
 * @property {number} yaw   - left/right turn in degrees
 * @property {number} roll  - head tilt in degrees
 */

/**
 * @typedef {Object} FaceLandmarks
 * @property {{ x: number, y: number }} leftEye
 * @property {{ x: number, y: number }} rightEye
 * @property {{ x: number, y: number }} noseTip
 * @property {{ x: number, y: number }} mouthCenter
 * @property {{ x: number, y: number }} mouthLeft
 * @property {{ x: number, y: number }} mouthRight
 * @property {{ x: number, y: number }} leftCheek
 * @property {{ x: number, y: number }} rightCheek
 * @property {{ x: number, y: number }} foreheadCenter
 * @property {{ x: number, y: number }} chinBottom
 */

/**
 * @typedef {Object} FaceContour
 * @property {Array<{ x: number, y: number }>} face      - jawline points
 * @property {Array<{ x: number, y: number }>} leftEye   - left eye contour
 * @property {Array<{ x: number, y: number }>} rightEye  - right eye contour
 * @property {Array<{ x: number, y: number }>} upperLip
 * @property {Array<{ x: number, y: number }>} lowerLip
 * @property {Array<{ x: number, y: number }>} noseBridge
 */

/**
 * @typedef {Object} NormalizedFaceData
 * @property {FaceBounds}    bounds
 * @property {FaceLandmarks} landmarks
 * @property {FaceContour}   contour
 * @property {FaceRotation}  rotation
 * @property {number}        mouthOpen     - 0-1 normalized
 * @property {number}        leftEyeOpen   - 0-1 normalized
 * @property {number}        rightEyeOpen  - 0-1 normalized
 * @property {number}        faceWidth
 * @property {number}        faceHeight
 */

export const MP_LANDMARKS = {
  // Key single-point landmarks
  LEFT_EYE_CENTER: 159,
  RIGHT_EYE_CENTER: 386,
  NOSE_TIP: 1,
  MOUTH_CENTER: 13,
  MOUTH_LEFT: 61,
  MOUTH_RIGHT: 291,
  UPPER_LIP_TOP: 0,
  LOWER_LIP_BOTTOM: 17,
  LEFT_CHEEK: 234,
  RIGHT_CHEEK: 454,
  FOREHEAD: 10,
  CHIN: 152,

  // Eye contour indices (closed polygon)
  LEFT_EYE_CONTOUR: [
    33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
  ],
  RIGHT_EYE_CONTOUR: [
    362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398,
  ],

  // Lip contour indices
  UPPER_LIP: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
  LOWER_LIP: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291],

  // Face contour (jawline + forehead outline)
  FACE_CONTOUR: [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365,
    379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93,
    234, 127, 162, 21, 54, 103, 67, 109,
  ],

  // Nose bridge for contour
  NOSE_BRIDGE: [6, 197, 195, 5, 4, 1],

  // Iris landmarks (added in later MediaPipe versions)
  LEFT_IRIS: [468, 469, 470, 471, 472],
  RIGHT_IRIS: [473, 474, 475, 476, 477],

  // Upper/lower eyelid for blink detection
  LEFT_EYE_UPPER: [159, 160, 161, 246, 33],
  LEFT_EYE_LOWER: [145, 144, 163, 7, 33],
  RIGHT_EYE_UPPER: [386, 385, 384, 398, 362],
  RIGHT_EYE_LOWER: [374, 380, 381, 382, 362],
};

// ── Performance tuning ──────────────────────────────────────────────

/** Target FPS for face detection loop */
export const FACE_DETECTION_FPS = 24;

/** If a frame takes longer than this (ms), skip next frame to stay responsive */
export const FRAME_SKIP_THRESHOLD = 16;

/** Lerp factor for smoothing landmark jitter between frames (0 = no smoothing, 1 = full prev) */
export const LANDMARK_SMOOTHING = 0.7;

/** Maximum faces to detect simultaneously */
export const MAX_FACES = 1;

/** Minimum detection confidence (0-1) to accept a face */
export const MIN_DETECTION_CONFIDENCE = 0.5;

/** Minimum tracking confidence (0-1) for MediaPipe tracker */
export const MIN_TRACKING_CONFIDENCE = 0.5;

/** Debounce ms before reporting "face lost" to avoid flicker */
export const FACE_LOST_DEBOUNCE_MS = 300;

// ── Filter categories ───────────────────────────────────────────────

export const FILTER_CATEGORIES = {
  BEAUTY: 'beauty',
  FUNNY: 'funny',
  FANTASY: 'fantasy',
  EFFECTS: 'effects',
};

// ── Default filter settings ─────────────────────────────────────────

export const DEFAULT_FILTER_SETTINGS = {
  skinSmoothing: { intensity: 50, tone: 0 },
  eyeEnlarge: { scale: 1.15 },
  faceThin: { amount: 0.1 },
  dog: {},
  cat: {},
  glasses: {},
  crown: {},
};
