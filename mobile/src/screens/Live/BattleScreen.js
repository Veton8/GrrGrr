import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../../utils/theme';

const CREATOR_A = { username: 'DJ_Sparkle', team: 'Team Alpha', color: '#1a3a5c' };
const CREATOR_B = { username: 'ArtByLuna', team: 'Team Omega', color: '#3a1a4c' };

const CHAT_MESSAGES = [
  { id: 1, user: 'StarGazer', color: colors.secondary, text: 'Go Team Alpha!', vip: false },
  { id: 2, user: 'VIP_King', color: colors.tertiary, text: 'Sending mega gifts!', vip: true },
  { id: 3, user: 'System', color: colors.primary, text: 'x10 COMBO activated!', system: true },
];

const GIFT_ICONS = [
  { icon: 'diamond', color: colors.tertiary },
  { icon: 'rocket', color: colors.primary },
  { icon: 'flash', color: colors.secondary },
];

export default function BattleScreen({ route, navigation }) {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const [scoreA, setScoreA] = useState(842500);
  const [scoreB, setScoreB] = useState(631200);
  const [timeRemaining, setTimeRemaining] = useState(300);
  const [comboMultiplier, setComboMultiplier] = useState(5);
  const [status, setStatus] = useState('active');

  const progressAnim = useRef(new Animated.Value(0.5)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const comboAnim = useRef(new Animated.Value(1)).current;
  const winnerScaleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;
  const sendPulseAnim = useRef(new Animated.Value(1)).current;

  // Auto-simulate scoring
  useEffect(() => {
    if (status !== 'active') return;
    const interval = setInterval(() => {
      const addToA = Math.floor(Math.random() * 5000) + 500;
      const addToB = Math.floor(Math.random() * 5000) + 500;
      setScoreA((prev) => prev + addToA);
      setScoreB((prev) => prev + addToB);
      setComboMultiplier((prev) => {
        const r = Math.random();
        if (r < 0.3) return Math.min(prev + 1, 15);
        if (r < 0.5) return Math.max(prev - 1, 1);
        return prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [status]);

  // Animate progress bar
  useEffect(() => {
    const total = scoreA + scoreB;
    const ratio = total > 0 ? scoreA / total : 0.5;
    Animated.spring(progressAnim, {
      toValue: ratio,
      tension: 50,
      friction: 7,
      useNativeDriver: false,
    }).start();
  }, [scoreA, scoreB]);

  // Countdown timer
  useEffect(() => {
    if (status !== 'active' || timeRemaining <= 0) return;
    const timer = setInterval(() => {
      setTimeRemaining((t) => {
        if (t <= 1) {
          setStatus('ended');
          clearInterval(timer);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  // VS badge pulse
  useEffect(() => {
    if (status !== 'active') return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [status]);

  // Combo bounce animation
  useEffect(() => {
    Animated.sequence([
      Animated.timing(comboAnim, {
        toValue: 1.3,
        duration: 150,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(comboAnim, {
        toValue: 1,
        tension: 300,
        friction: 5,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [comboMultiplier]);

  // Glow animation for VS
  useEffect(() => {
    if (status !== 'active') return;
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(glowAnim, {
          toValue: 0.6,
          duration: 1200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    glow.start();
    return () => glow.stop();
  }, [status]);

  // Send button pulse
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(sendPulseAnim, {
          toValue: 1.08,
          duration: 1000,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(sendPulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Winner announcement animation
  useEffect(() => {
    if (status === 'ended') {
      Animated.spring(winnerScaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 6,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [status]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const progressWidthB = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['100%', '0%'],
  });

  const percentA = scoreA + scoreB > 0 ? Math.round((scoreA / (scoreA + scoreB)) * 100) : 50;
  const percentB = 100 - percentA;

  const winner =
    status === 'ended'
      ? scoreA > scoreB
        ? CREATOR_A.team
        : scoreB > scoreA
          ? CREATOR_B.team
          : 'Tie'
      : null;

  const isUrgent = timeRemaining <= 30 && status === 'active';

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0.6, 1],
    outputRange: [0.4, 0.9],
  });

  return (
    <View style={styles.container}>
      {/* Split screen */}
      <View style={styles.splitScreen}>
        {/* Creator A (left) */}
        <View style={[styles.creatorPanel, { backgroundColor: CREATOR_A.color }]}>
          <View style={styles.gradientOverlayLeft} />

          {/* Team label - top left */}
          <View style={[styles.teamPanel, styles.teamPanelLeft]}>
            <Text style={[styles.teamLabel, { color: colors.primary }]}>{CREATOR_A.team}</Text>
            <Text style={styles.teamScore}>{scoreA.toLocaleString()}</Text>
          </View>

          {/* Combo badge - bottom left */}
          <Animated.View
            style={[styles.comboBadge, { transform: [{ scale: comboAnim }] }]}
          >
            <Ionicons name="flame" size={16} color="#fff" />
            <Text style={styles.comboText}>x{comboMultiplier} COMBO</Text>
          </Animated.View>
        </View>

        {/* Center VS divider */}
        <View style={styles.dividerLine} />

        <Animated.View
          style={[
            styles.vsBadge,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Animated.View style={[styles.vsGlow, { opacity: glowOpacity }]} />
          <Text style={styles.vsText}>VS</Text>
        </Animated.View>

        {/* Creator B (right) */}
        <View style={[styles.creatorPanel, { backgroundColor: CREATOR_B.color }]}>
          <View style={styles.gradientOverlayRight} />

          {/* Team label - top right */}
          <View style={[styles.teamPanel, styles.teamPanelRight]}>
            <Text style={[styles.teamLabel, { color: colors.secondary }]}>{CREATOR_B.team}</Text>
            <Text style={styles.teamScore}>{scoreB.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      {/* Progress bar section */}
      <View style={styles.progressSection}>
        <View style={styles.progressBar}>
          <Animated.View style={[styles.progressFillA, { width: progressWidth }]} />
          <Animated.View style={[styles.progressFillB, { width: progressWidthB }]} />
        </View>
        <View style={styles.progressLabels}>
          <Text style={[styles.progressPercent, { color: colors.primary }]}>{percentA}%</Text>
          <Text style={[styles.progressPercent, { color: colors.secondary }]}>{percentB}%</Text>
        </View>
      </View>

      {/* Timer - top center */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={[styles.timerPanel, isUrgent && styles.timerUrgent]}>
          <Text style={styles.timerLabel}>Ending In</Text>
          <Text style={[styles.timerText, isUrgent && styles.timerTextUrgent]}>
            {formatTime(timeRemaining)}
          </Text>
        </View>

        <View style={styles.viewerBadge}>
          <Ionicons name="eye" size={14} color={colors.textSecondary} />
          <Text style={styles.viewerCount}>2.1K</Text>
        </View>
      </SafeAreaView>

      {/* Chat overlay - bottom left */}
      <View style={styles.chatOverlay}>
        {CHAT_MESSAGES.map((msg) => (
          <View
            key={msg.id}
            style={[
              styles.chatBubble,
              msg.vip && styles.chatBubbleVip,
              msg.system && styles.chatBubbleSystem,
            ]}
          >
            <Text
              style={[
                styles.chatUser,
                { color: msg.color },
                msg.vip && { color: colors.tertiary },
              ]}
            >
              {msg.vip && '👑 '}
              {msg.user}
            </Text>
            <Text style={styles.chatText}>{msg.text}</Text>
          </View>
        ))}
      </View>

      {/* Side gift icons - right */}
      <View style={styles.giftIcons}>
        {GIFT_ICONS.map((gift, idx) => (
          <TouchableOpacity key={idx} style={styles.giftCircle}>
            <Ionicons name={gift.icon} size={22} color={gift.color} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Bottom navigation bar */}
      <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
        <TouchableOpacity style={styles.navIcon}>
          <Ionicons name="chatbubble-outline" size={24} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navIcon}>
          <Ionicons name="heart-outline" size={24} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Center SEND GIFT button */}
        <Animated.View style={{ transform: [{ scale: sendPulseAnim }] }}>
          <TouchableOpacity style={styles.sendGiftButton} activeOpacity={0.8}>
            <Ionicons name="gift" size={28} color="#fff" />
            <Text style={styles.sendGiftText}>SEND GIFT</Text>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity style={styles.navIcon}>
          <Ionicons name="share-outline" size={24} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navIcon}>
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.textMuted} />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Winner overlay */}
      {status === 'ended' && (
        <Animated.View
          style={[
            styles.winnerOverlay,
            { transform: [{ scale: winnerScaleAnim }] },
          ]}
        >
          <View style={styles.winnerContent}>
            <Ionicons
              name={winner === 'Tie' ? 'ribbon' : 'trophy'}
              size={72}
              color={colors.tertiary}
            />
            <Text style={styles.winnerLabel}>Battle Ended!</Text>
            <Text style={styles.winnerName}>
              {winner === 'Tie' ? "It's a Tie!" : `${winner} Wins!`}
            </Text>
            <View style={styles.finalScores}>
              <View style={[styles.finalScoreBox, { borderColor: colors.primary }]}>
                <Text style={[styles.finalScoreLabel, { color: colors.primary }]}>
                  {CREATOR_A.team}
                </Text>
                <Text style={styles.finalScoreValue}>{scoreA.toLocaleString()}</Text>
              </View>
              <Text style={styles.finalVs}>vs</Text>
              <View style={[styles.finalScoreBox, { borderColor: colors.secondary }]}>
                <Text style={[styles.finalScoreLabel, { color: colors.secondary }]}>
                  {CREATOR_B.team}
                </Text>
                <Text style={styles.finalScoreValue}>{scoreB.toLocaleString()}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  splitScreen: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  creatorPanel: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  gradientOverlayLeft: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    opacity: 0.4,
  },
  gradientOverlayRight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    opacity: 0.4,
  },

  // Team panels (glass)
  teamPanel: {
    position: 'absolute',
    top: 100,
    backgroundColor: colors.glass,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  teamPanelLeft: {
    left: 12,
  },
  teamPanelRight: {
    right: 12,
  },
  teamLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  teamScore: {
    color: '#fff',
    fontSize: fontSize.xl,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },

  // Combo badge
  comboBadge: {
    position: 'absolute',
    bottom: 140,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.errorDim,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  comboText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Divider
  dividerLine: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 2,
    zIndex: 2,
    backgroundColor: colors.primaryDim,
    opacity: 0.6,
  },

  // VS Badge
  vsBadge: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -48,
    marginTop: -48,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceContainerHighest,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
    elevation: 10,
    shadowColor: colors.primaryDim,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    borderWidth: 2,
    borderColor: colors.primaryFixed,
  },
  vsGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 48,
    backgroundColor: colors.primaryDim,
    opacity: 0.3,
  },
  vsText: {
    color: colors.primaryFixed,
    fontSize: fontSize.hero,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: colors.primaryDim,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },

  // Progress section
  progressSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceContainerHigh,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressFillA: {
    height: '100%',
    backgroundColor: colors.primary,
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
  },
  progressFillB: {
    height: '100%',
    backgroundColor: colors.secondary,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressPercent: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerPanel: {
    backgroundColor: colors.glass,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  timerUrgent: {
    borderColor: colors.errorDim,
    backgroundColor: 'rgba(215, 51, 87, 0.3)',
  },
  timerLabel: {
    color: colors.tertiary,
    fontSize: fontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  timerText: {
    color: '#fff',
    fontSize: fontSize.xxl,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    textShadowColor: colors.tertiary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  timerTextUrgent: {
    color: colors.error,
    textShadowColor: colors.errorDim,
  },
  viewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.glass,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  viewerCount: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },

  // Chat overlay
  chatOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 12,
    maxWidth: 220,
    gap: 6,
  },
  chatBubble: {
    backgroundColor: colors.glass,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  chatBubbleVip: {
    borderColor: colors.tertiary,
    borderWidth: 1,
  },
  chatBubbleSystem: {
    backgroundColor: 'rgba(170, 48, 250, 0.25)',
    borderColor: colors.primaryDim,
  },
  chatUser: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginBottom: 2,
  },
  chatText: {
    color: colors.text,
    fontSize: fontSize.sm,
  },

  // Gift icons
  giftIcons: {
    position: 'absolute',
    right: 12,
    bottom: 160,
    gap: 12,
    alignItems: 'center',
  },
  giftCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  navIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendGiftButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -24,
    elevation: 8,
    shadowColor: colors.primaryDim,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    gap: 2,
  },
  sendGiftText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Winner overlay
  winnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(21, 6, 41, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  winnerContent: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  winnerLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xl,
    fontWeight: '600',
  },
  winnerName: {
    color: colors.tertiary,
    fontSize: fontSize.hero,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: colors.tertiaryDim,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  finalScores: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  finalScoreBox: {
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minWidth: 110,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  finalScoreLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: 4,
  },
  finalScoreValue: {
    color: '#fff',
    fontSize: fontSize.xl,
    fontWeight: '900',
  },
  finalVs: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: colors.primaryDim,
    borderRadius: 24,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    marginTop: spacing.lg,
    shadowColor: colors.primaryDim,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
});
