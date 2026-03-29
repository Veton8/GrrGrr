import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import { colors, spacing, fontSize } from '../../utils/theme';

export default function UploadVideoScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const [videoUri, setVideoUri] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  /** Video player for upload preview (expo-video) — paused by default, native controls */
  const previewPlayer = useVideoPlayer(videoUri || null, (p) => {
    p.loop = false;
  });

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library to upload videos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      quality: 1,
      videoMaxDuration: 180,
    });

    if (!result.canceled && result.assets?.[0]) {
      setVideoUri(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!videoUri) {
      Alert.alert('No video', 'Please select a video first.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const response = await fetch(videoUri);
        const blob = await response.blob();
        formData.append('video', blob, 'video.mp4');
      } else {
        const ext = videoUri.split('.').pop() || 'mp4';
        formData.append('video', {
          uri: videoUri,
          type: `video/${ext}`,
          name: `upload.${ext}`,
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
      Alert.alert('Upload failed', err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const previewWidth = width - spacing.xl * 2;
  const previewHeight = previewWidth * (16 / 9);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>New Post</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Video preview / picker */}
      <View style={styles.content}>
        <TouchableOpacity
          style={[styles.previewContainer, { width: previewWidth, height: previewHeight }]}
          onPress={pickVideo}
          activeOpacity={0.8}
        >
          {videoUri ? (
            <VideoView
              player={previewPlayer}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              nativeControls
            />
          ) : (
            <View style={styles.pickerPlaceholder}>
              <View style={styles.pickerIconCircle}>
                <Ionicons name="cloud-upload-outline" size={40} color={colors.primary} />
              </View>
              <Text style={styles.pickerText}>Tap to select a video</Text>
              <Text style={styles.pickerSubtext}>MP4, MOV — up to 3 min</Text>
            </View>
          )}
        </TouchableOpacity>

        {videoUri && (
          <TouchableOpacity style={styles.changeButton} onPress={pickVideo}>
            <Ionicons name="refresh" size={16} color={colors.primary} />
            <Text style={styles.changeText}>Change video</Text>
          </TouchableOpacity>
        )}

        {/* Caption input */}
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

        {/* Upload button */}
        <TouchableOpacity
          style={[styles.uploadButton, (!videoUri || uploading) && styles.uploadButtonDisabled]}
          onPress={handleUpload}
          disabled={!videoUri || uploading}
          activeOpacity={0.8}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="arrow-up-circle" size={22} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.uploadButtonText}>Post</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  previewContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 400,
  },
  pickerPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(170, 48, 250, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pickerText: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  pickerSubtext: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 4,
  },
  changeText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
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
  charCount: {
    alignSelf: 'flex-end',
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 4,
  },
  uploadButton: {
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
      ios: {
        shadowColor: colors.primaryDim,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
      web: { boxShadow: `0 4px 20px rgba(170, 48, 250, 0.4)` },
    }),
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
