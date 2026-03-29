import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import api from '../../services/api';
import { colors, spacing, fontSize } from '../../utils/theme';
import FilterPicker from '../../features/camera/FilterPicker';
import { getFilterById } from '../../features/camera/filters';
import LensPicker from '../../features/camera/LensPicker';
import { useSnapCamera } from '../../features/camera/SnapCameraProvider';

// --- Platform-aware camera imports ---
let CameraView, useCameraPermissions;
if (Platform.OS !== 'web') {
  try {
    const cam = require('expo-camera');
    CameraView = cam.CameraView;
    useCameraPermissions = cam.useCameraPermissions;
  } catch (e) {}
}

// --- Snap Camera Kit (dev build only) ---
let SnapCameraKitView = null;
try {
  const snapModule = require('@snap/camera-kit-react-native');
  SnapCameraKitView = snapModule.CameraKitCameraView || snapModule.default;
} catch {
  // Not available in Expo Go — will fall back to expo-camera
}

const MAX_DURATION = 60; // seconds

// ==================== WEB CAMERA + RECORDER ====================
function useWebCamera(facing) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [ready, setReady] = useState(false);

  const startPreview = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const facingMode = facing === 'front' ? 'user' : 'environment';
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setReady(true);
    } catch (err) {
      console.error('Web camera error:', err);
      setReady(false);
    }
  }, [facing]);

  const stopPreview = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setReady(false);
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return null;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = recorder;
    recorder.start(100);
    return recorder;
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        resolve(url);
      };
      recorder.stop();
    });
  }, []);

  return { videoRef, ready, startPreview, stopPreview, startRecording, stopRecording };
}

// ==================== MAIN SCREEN ====================
export default function RecordVideoScreen({ navigation }) {
  const [facing, setFacing] = useState('front');
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [videoUri, setVideoUri] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [showFilters, setShowFilters] = useState(false);
  const [filterMode, setFilterMode] = useState('color'); // 'color' | 'ar'
  const cameraRef = useRef(null);
  const timerRef = useRef(null);

  // Snap Camera Kit state
  const {
    isSnapAvailable,
    lenses,
    activeLens,
    applyLens,
    clearLens,
    isLoading: lensesLoading,
  } = useSnapCamera();

  const activeFilter = getFilterById(selectedFilter);

  /** Video player for review preview (expo-video) */
  const reviewPlayer = useVideoPlayer(videoUri || null, (p) => {
    p.loop = true;
    p.play();
  });

  // --- Web ---
  const web = Platform.OS === 'web' ? useWebCamera(facing) : null;
  const [webPermission, setWebPermission] = useState(Platform.OS === 'web' ? null : undefined);

  // --- Native ---
  const nativeHook = Platform.OS !== 'web' && useCameraPermissions ? useCameraPermissions() : [null, null];
  const [nativePerm, requestNativePerm] = nativeHook || [null, null];

  const hasPermission =
    Platform.OS === 'web' ? webPermission === true : nativePerm?.granted === true;

  // Request permissions on mount
  useEffect(() => {
    if (Platform.OS === 'web') {
      (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          stream.getTracks().forEach((t) => t.stop());
          setWebPermission(true);
        } catch {
          setWebPermission(false);
        }
      })();
    } else if (requestNativePerm && !nativePerm?.granted) {
      requestNativePerm();
    }
  }, []);

  // Start web preview when permission granted
  useEffect(() => {
    if (Platform.OS === 'web' && webPermission && web && !videoUri) {
      web.startPreview();
      return () => web.stopPreview();
    }
  }, [webPermission, facing, videoUri]);

  // Recording timer
  useEffect(() => {
    if (recording) {
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          if (prev + 1 >= MAX_DURATION) {
            stopRecording();
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recording]);

  const flipCamera = () => setFacing((f) => (f === 'front' ? 'back' : 'front'));

  const startRecording = async () => {
    setRecording(true);
    if (Platform.OS === 'web') {
      web.startRecording();
    } else if (cameraRef.current) {
      try {
        const result = await cameraRef.current.recordAsync({ maxDuration: MAX_DURATION });
        if (result?.uri) {
          setVideoUri(result.uri);
        }
      } catch (err) {
        console.error('Native record error:', err);
      }
    }
  };

  const stopRecording = async () => {
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (Platform.OS === 'web') {
      const uri = await web.stopRecording();
      if (uri) setVideoUri(uri);
    } else if (cameraRef.current) {
      try {
        cameraRef.current.stopRecording();
      } catch {}
    }
  };

  const retake = () => {
    setVideoUri(null);
    setCaption('');
    setElapsed(0);
  };

  const handleUpload = async () => {
    if (!videoUri) return;
    setUploading(true);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const response = await fetch(videoUri);
        const blob = await response.blob();
        formData.append('video', blob, 'recorded.webm');
      } else {
        const ext = videoUri.split('.').pop() || 'mp4';
        formData.append('video', {
          uri: videoUri,
          type: `video/${ext}`,
          name: `recorded.${ext}`,
        });
      }
      formData.append('caption', caption.trim());

      const { data: uploadedVideo } = await api.post('/feed/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });

      // Navigate directly to the uploaded video
      navigation.replace('VideoPlayer', {
        videos: [uploadedVideo],
        startIndex: 0,
      });
    } catch (err) {
      console.error('Upload error:', err);
      Alert.alert('Upload failed', err.response?.data?.error || 'Something went wrong.');
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ---- PERMISSION LOADING ----
  if (Platform.OS === 'web' ? webPermission === null : !nativePerm) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.permHint}>Requesting camera access...</Text>
      </View>
    );
  }

  // ---- PERMISSION DENIED ----
  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Ionicons name="camera-outline" size={64} color={colors.textMuted} />
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permHint}>We need camera and microphone access to record videos.</Text>
        <TouchableOpacity
          style={styles.permBtn}
          onPress={() => {
            if (Platform.OS === 'web') {
              navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then((s) => { s.getTracks().forEach((t) => t.stop()); setWebPermission(true); })
                .catch(() => setWebPermission(false));
            } else if (requestNativePerm) {
              requestNativePerm();
            }
          }}
        >
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: spacing.md }}>
          <Text style={[styles.permHint, { textDecorationLine: 'underline' }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---- REVIEW / CAPTION SCREEN ----
  if (videoUri) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={retake} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.reviewContent}>
          <View style={styles.videoPreview}>
            <VideoView
              player={reviewPlayer}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              nativeControls
            />
          </View>

          <TouchableOpacity style={styles.retakeBtn} onPress={retake}>
            <Ionicons name="refresh" size={16} color={colors.primary} />
            <Text style={styles.retakeText}>Record again</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.captionInput}
            placeholder="Write a caption..."
            placeholderTextColor={colors.textMuted}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={300}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{caption.length}/300</Text>

          <TouchableOpacity
            style={[styles.postBtn, uploading && styles.postBtnDisabled]}
            onPress={handleUpload}
            disabled={uploading}
            activeOpacity={0.8}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="arrow-up-circle" size={22} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.postBtnText}>Post</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ---- RECORDING SCREEN ----
  return (
    <View style={styles.container}>
      {/* Camera */}
      {Platform.OS === 'web' ? (
        <View style={styles.cameraFill}>
          <video
            ref={web.videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: facing === 'front' ? 'scaleX(-1)' : 'none',
            }}
          />
        </View>
      ) : isSnapAvailable && SnapCameraKitView ? (
        /* Snap Camera Kit — full AR lens support (dev build) */
        <SnapCameraKitView
          ref={cameraRef}
          style={styles.cameraFill}
          facing={facing}
        />
      ) : CameraView ? (
        <CameraView
          ref={cameraRef}
          style={styles.cameraFill}
          facing={facing}
          mode="video"
        />
      ) : (
        <View style={[styles.cameraFill, styles.cameraFallback]}>
          <Ionicons name="camera-outline" size={80} color={colors.textMuted} />
          <Text style={styles.fallbackText}>Camera not available</Text>
        </View>
      )}

      {/* Color filter overlay */}
      {selectedFilter !== 'none' && (
        <View style={styles.filterOverlay} pointerEvents="none">
          <View style={[
            styles.filterOverlayInner,
            selectedFilter === 'warm' && { backgroundColor: 'rgba(255, 165, 0, 0.12)' },
            selectedFilter === 'cool' && { backgroundColor: 'rgba(0, 100, 255, 0.12)' },
            selectedFilter === 'vintage' && { backgroundColor: 'rgba(200, 150, 50, 0.15)' },
            selectedFilter === 'bw' && { backgroundColor: 'rgba(0, 0, 0, 0.0)' },
            selectedFilter === 'dramatic' && { backgroundColor: 'rgba(0, 0, 0, 0.08)' },
            selectedFilter === 'sunset' && { backgroundColor: 'rgba(255, 100, 50, 0.12)' },
            selectedFilter === 'neon' && { backgroundColor: 'rgba(100, 0, 255, 0.1)' },
            selectedFilter === 'rose' && { backgroundColor: 'rgba(255, 100, 150, 0.1)' },
            selectedFilter === 'beauty' && { backgroundColor: 'rgba(255, 200, 200, 0.08)' },
          ]} />
        </View>
      )}

      {/* Top bar */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBtn}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>

        {/* Timer */}
        <View style={[styles.timerBadge, recording && styles.timerRecording]}>
          {recording && <View style={styles.recDot} />}
          <Text style={styles.timerText}>{formatTime(elapsed)} / {formatTime(MAX_DURATION)}</Text>
        </View>

        <View style={{ width: 44 }} />
      </SafeAreaView>

      {/* Progress bar */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${(elapsed / MAX_DURATION) * 100}%` }]} />
      </View>

      {/* Side controls */}
      <View style={styles.sideControls}>
        <TouchableOpacity style={styles.sideBtn} onPress={flipCamera}>
          <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
          <Text style={styles.sideBtnLabel}>Flip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sideBtn}>
          <Ionicons name="flash-outline" size={24} color="#fff" />
          <Text style={styles.sideBtnLabel}>Flash</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sideBtn} onPress={() => {
          setFilterMode('color');
          setShowFilters(!showFilters || filterMode !== 'color');
        }}>
          <Ionicons
            name={showFilters && filterMode === 'color' ? 'color-filter' : 'color-filter-outline'}
            size={24}
            color={selectedFilter !== 'none' ? '#d394ff' : '#fff'}
          />
          <Text style={[styles.sideBtnLabel, selectedFilter !== 'none' && { color: '#d394ff' }]}>
            {selectedFilter !== 'none' ? activeFilter.name : 'Filters'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sideBtn} onPress={() => {
          setFilterMode('ar');
          setShowFilters(!showFilters || filterMode !== 'ar');
        }}>
          <Ionicons
            name={activeLens ? 'happy' : 'happy-outline'}
            size={24}
            color={activeLens ? '#FFFC00' : '#fff'}
          />
          <Text style={[styles.sideBtnLabel, activeLens && { color: '#FFFC00' }]}>
            {activeLens ? 'AR On' : 'Face AR'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sideBtn}>
          <Ionicons name="timer-outline" size={24} color="#fff" />
          <Text style={styles.sideBtnLabel}>Timer</Text>
        </TouchableOpacity>
      </View>

      {/* Filter picker — color filters or AR lenses */}
      {showFilters && !recording && (
        <View style={styles.filterPickerContainer}>
          {/* Tab toggle between Color and AR */}
          <View style={styles.filterTabRow}>
            <TouchableOpacity
              style={[styles.filterTab, filterMode === 'color' && styles.filterTabActive]}
              onPress={() => setFilterMode('color')}
            >
              <Text style={[styles.filterTabText, filterMode === 'color' && styles.filterTabTextActive]}>
                Color Filters
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, filterMode === 'ar' && styles.filterTabActive]}
              onPress={() => setFilterMode('ar')}
            >
              <Text style={[styles.filterTabText, filterMode === 'ar' && styles.filterTabTextActive]}>
                Face AR
              </Text>
            </TouchableOpacity>
          </View>

          {filterMode === 'color' ? (
            <FilterPicker selectedId={selectedFilter} onSelect={setSelectedFilter} />
          ) : isSnapAvailable ? (
            <LensPicker
              lenses={lenses}
              activeLensId={activeLens?.id}
              onSelectLens={applyLens}
              onClear={clearLens}
              isLoading={lensesLoading}
            />
          ) : (
            <View style={styles.arNotAvailable}>
              <Ionicons name="warning-outline" size={18} color="#FFFC00" />
              <Text style={styles.arNotAvailableText}>
                AR face filters require a dev build.{'\n'}
                Run: npx expo prebuild && npx expo run:ios
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Bottom: record button */}
      <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
        <Text style={styles.durationHint}>Hold or tap to record (max {MAX_DURATION}s)</Text>
        <View style={styles.recordRow}>
          <View style={{ width: 60 }} />

          <TouchableOpacity
            onPress={recording ? stopRecording : startRecording}
            activeOpacity={0.7}
            style={styles.recordOuter}
          >
            <View style={[styles.recordInner, recording && styles.recordInnerActive]}>
              {recording ? (
                <View style={styles.stopSquare} />
              ) : (
                <View style={styles.recordCircle} />
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.galleryBtn} onPress={() => navigation.replace('UploadVideo')}>
            <Ionicons name="images-outline" size={26} color="#fff" />
            <Text style={styles.sideBtnLabel}>Gallery</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  permTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700', marginTop: spacing.lg },
  permHint: { color: colors.textMuted, fontSize: fontSize.md, textAlign: 'center', marginTop: spacing.sm },
  permBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: spacing.xl,
  },
  permBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },

  // Camera
  cameraFill: { ...StyleSheet.absoluteFillObject },
  cameraFallback: { backgroundColor: colors.surfaceContainer, justifyContent: 'center', alignItems: 'center' },
  fallbackText: { color: colors.textMuted, marginTop: spacing.sm },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  topBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  timerRecording: { backgroundColor: 'rgba(255, 45, 85, 0.8)' },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  timerText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // Progress bar
  progressBarBg: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: spacing.md,
    borderRadius: 2,
    marginTop: spacing.xs,
  },
  progressBarFill: {
    height: 3,
    backgroundColor: colors.error,
    borderRadius: 2,
  },

  // Filter overlay
  filterOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  filterOverlayInner: {
    flex: 1,
  },
  filterPickerContainer: {
    position: 'absolute',
    bottom: 180,
    left: 0,
    right: 0,
    zIndex: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    marginHorizontal: 8,
    paddingBottom: 4,
  },
  filterTabRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  filterTabActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterTabText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  arNotAvailable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
  },
  arNotAvailableText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },

  // Side controls
  sideControls: {
    position: 'absolute',
    right: spacing.md,
    top: 140,
    gap: spacing.lg,
    alignItems: 'center',
  },
  sideBtn: { alignItems: 'center', gap: 4 },
  sideBtnLabel: { color: '#fff', fontSize: fontSize.xs, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },

  // Bottom
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
  },
  durationHint: { color: 'rgba(255,255,255,0.6)', fontSize: fontSize.sm },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: spacing.xl,
  },
  recordOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordInnerActive: {
    backgroundColor: 'transparent',
  },
  recordCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.error,
  },
  stopSquare: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.error,
  },
  galleryBtn: { alignItems: 'center', gap: 4, width: 60 },

  // Review screen
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  reviewContent: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  videoPreview: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 380,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainer,
  },
  retakeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  retakeText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },
  captionInput: {
    width: '100%',
    minHeight: 80,
    maxHeight: 120,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 12,
    padding: spacing.md,
    color: colors.text,
    fontSize: fontSize.md,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  charCount: { alignSelf: 'flex-end', color: colors.textMuted, fontSize: fontSize.xs, marginTop: 4 },
  postBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryDim,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: spacing.xl,
    width: '100%',
    ...Platform.select({
      ios: { shadowColor: colors.primaryDim, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12 },
      android: { elevation: 8 },
      web: { boxShadow: '0 4px 20px rgba(170, 48, 250, 0.4)' },
    }),
  },
  postBtnDisabled: { opacity: 0.5 },
  postBtnText: { color: '#fff', fontSize: fontSize.lg, fontWeight: '800', letterSpacing: 0.5 },
});
