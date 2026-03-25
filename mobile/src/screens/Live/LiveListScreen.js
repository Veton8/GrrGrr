import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../../utils/theme';

const MOCK_STREAMS = [
  {
    id: 'live-1',
    hostName: 'DJ_Sparkle',
    title: 'Late Night Vibes',
    viewers: '1.2K',
    bgColor: '#E91E63',
    hostInitial: 'D',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  },
  {
    id: 'live-2',
    hostName: 'CookWithMaya',
    title: 'Making Pasta from Scratch!',
    viewers: '567',
    bgColor: '#FF9800',
    hostInitial: 'C',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  },
  {
    id: 'live-3',
    hostName: 'FitnessPro',
    title: 'Morning Workout HIIT',
    viewers: '234',
    bgColor: '#4CAF50',
    hostInitial: 'F',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  },
  {
    id: 'live-4',
    hostName: 'ArtByLuna',
    title: 'Painting Session',
    viewers: '892',
    bgColor: '#9C27B0',
    hostInitial: 'A',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  },
  {
    id: 'live-5',
    hostName: 'GamerX',
    title: 'Ranked Matches',
    viewers: '3.4K',
    bgColor: '#2196F3',
    hostInitial: 'G',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  },
  {
    id: 'live-6',
    hostName: 'TravelWithSam',
    title: 'Exploring Tokyo Streets',
    viewers: '1.8K',
    bgColor: '#00BCD4',
    hostInitial: 'T',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  },
];

// Pulsing dot for LIVE badge
function PulsingDot() {
  const dotAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(dotAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.liveDot, { opacity: dotAnim }]} />
  );
}

export default function LiveListScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const cardWidth = (width - spacing.md * 3) / 2;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Live Now</Text>
        <TouchableOpacity
          style={styles.goLiveBtn}
          onPress={() => navigation.navigate('GoLive')}
          activeOpacity={0.8}
        >
          <Ionicons name="radio" size={16} color="#fff" />
          <Text style={styles.goLiveText}>Go Live</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stream grid */}
        <View style={styles.grid}>
          {MOCK_STREAMS.map((stream) => (
            <TouchableOpacity
              key={stream.id}
              style={[styles.card, { width: cardWidth }]}
              activeOpacity={0.8}
              onPress={() =>
                navigation.navigate('LiveStream', {
                  streamId: stream.id,
                  hostName: stream.hostName,
                })
              }
            >
              {/* Thumbnail with video preview */}
              <View
                style={[
                  styles.thumbnail,
                  { height: cardWidth * 1.3, backgroundColor: stream.bgColor },
                ]}
              >
                <Video
                  source={{ uri: stream.videoUrl }}
                  style={StyleSheet.absoluteFill}
                  resizeMode={ResizeMode.COVER}
                  videoStyle={Platform.OS === 'web' ? { width: '100%', height: '100%', objectFit: 'cover' } : undefined}
                  isLooping
                  shouldPlay
                  isMuted
                />

                {/* Darker overlay for depth */}
                <View style={styles.thumbnailOverlay} />

                {/* LIVE badge */}
                <View style={styles.liveBadge}>
                  <PulsingDot />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>

                {/* Viewer count */}
                <View style={styles.viewerBadge}>
                  <Ionicons name="eye" size={11} color={colors.text} />
                  <Text style={styles.viewerText}>{stream.viewers}</Text>
                </View>
              </View>

              {/* Card info */}
              <View style={styles.cardInfo}>
                <View
                  style={[styles.hostAvatar, { backgroundColor: stream.bgColor }]}
                >
                  <Text style={styles.hostAvatarText}>
                    {stream.hostInitial}
                  </Text>
                </View>
                <View style={styles.cardMeta}>
                  <Text style={styles.hostName} numberOfLines={1}>
                    {stream.hostName}
                  </Text>
                  <Text style={styles.streamTitle} numberOfLines={1}>
                    {stream.title}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Battle card */}
        <TouchableOpacity
          style={styles.battleCard}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Battle', { battleId: 'demo' })}
        >
          <View style={styles.battleContent}>
            <View style={styles.battleIconContainer}>
              <Ionicons name="flash" size={26} color={colors.tertiary} />
            </View>
            <View style={styles.battleInfo}>
              <Text style={styles.battleTitle}>Live Battle</Text>
              <Text style={styles.battleSubtitle}>
                Watch creators compete in real-time!
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={22}
              color={colors.textMuted}
            />
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  goLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryDim,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  goLiveText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  // Scroll content
  scrollContent: {
    paddingBottom: spacing.xxl + 60,
  },
  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  // Card
  card: {
    marginBottom: spacing.sm,
  },
  thumbnail: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  liveBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E53935',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  viewerBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.glass,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  viewerText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  // Card info
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  hostAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  hostAvatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  cardMeta: {
    flex: 1,
  },
  hostName: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  streamTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: 1,
  },
  // Battle card
  battleCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  battleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  battleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  battleInfo: {
    flex: 1,
  },
  battleTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  battleSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
});
