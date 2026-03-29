import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  Alert,
  ActivityIndicator,
  FlatList,
  Share,
  Keyboard,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../../utils/theme';
import api from '../../services/api';
import { connectLiveSocket, disconnectLiveSocket } from '../../services/socket';
import { LiveKitPublisher } from '../../components/live/LiveKitRoom';
import { useSnapCamera } from '../../features/camera/SnapCameraProvider';
import LensPicker from '../../features/camera/LensPicker';

// --- Platform-aware camera imports ---
let CameraView, useCameraPermissions;
if (Platform.OS !== 'web') {
  try {
    const cam = require('expo-camera');
    CameraView = cam.CameraView;
    useCameraPermissions = cam.useCameraPermissions;
  } catch (e) {
    // expo-camera not available
  }
}

// --- Snap Camera Kit (dev build only) ---
let SnapCameraKitView = null;
try {
  const snapModule = require('@snap/camera-kit-react-native');
  SnapCameraKitView = snapModule.CameraKitCameraView || snapModule.default;
} catch {
  // Not available in Expo Go — will fall back to expo-camera
}

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// Gift icon mapping (matches LiveStreamScreen)
const GIFT_ICON_MAP = {
  rose: '\u{1F339}',
  heart: '\u{2764}\u{FE0F}',
  star: '\u{2B50}',
  fire: '\u{1F525}',
  diamond: '\u{1F48E}',
  crown: '\u{1F451}',
  rocket: '\u{1F680}',
  castle: '\u{1F3F0}',
  lion: '\u{1F981}',
  universe: '\u{1F30C}',
};

// ==================== WEB CAMERA COMPONENT ====================
function WebCameraPreview({ facing, style }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
        const facingMode = facing === 'front' ? 'user' : 'environment';
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Web camera error:', err);
      }
    })();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [facing]);

  return (
    <View style={style}>
      <video
        ref={videoRef}
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
  );
}

// ==================== PERMISSION DENIED SCREEN ====================
function PermissionDenied({ onRequest, onBack }) {
  return (
    <View style={styles.permissionContainer}>
      <Ionicons name="camera-outline" size={64} color={colors.textMuted} />
      <Text style={styles.permissionTitle}>Camera Access Required</Text>
      <Text style={styles.permissionSubtext}>
        We need camera and microphone access to start a livestream.
      </Text>
      <TouchableOpacity style={styles.permissionBtn} onPress={onRequest}>
        <Text style={styles.permissionBtnText}>Grant Permission</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack} style={{ marginTop: spacing.md }}>
        <Text style={[styles.permissionSubtext, { textDecorationLine: 'underline' }]}>Go back</Text>
      </TouchableOpacity>
    </View>
  );
}

// ==================== COUNTDOWN OVERLAY ====================
function CountdownOverlay({ onComplete }) {
  const [count, setCount] = useState(3);
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let current = 3;
    const animateNumber = () => {
      scaleAnim.setValue(0.3);
      opacityAnim.setValue(0);
      ringAnim.setValue(0);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 120,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(ringAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start(() => {
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          delay: 0,
          useNativeDriver: USE_NATIVE_DRIVER,
        }).start(() => {
          current -= 1;
          if (current > 0) {
            setCount(current);
            animateNumber();
          } else {
            // Show "LIVE!" text
            setCount(0);
            scaleAnim.setValue(0.3);
            opacityAnim.setValue(0);
            ringAnim.setValue(0);
            Animated.parallel([
              Animated.spring(scaleAnim, {
                toValue: 1.2,
                friction: 4,
                tension: 100,
                useNativeDriver: USE_NATIVE_DRIVER,
              }),
              Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: USE_NATIVE_DRIVER,
              }),
              Animated.timing(ringAnim, {
                toValue: 1.5,
                duration: 600,
                useNativeDriver: USE_NATIVE_DRIVER,
              }),
            ]).start(() => {
              setTimeout(() => {
                onComplete();
              }, 500);
            });
          }
        });
      });
    };
    animateNumber();
  }, []);

  const ringScale = ringAnim.interpolate({
    inputRange: [0, 1, 1.5],
    outputRange: [0.5, 1.3, 1.8],
  });
  const ringOpacity = ringAnim.interpolate({
    inputRange: [0, 0.5, 1, 1.5],
    outputRange: [0.8, 0.5, 0.1, 0],
  });

  return (
    <View style={styles.countdownContainer}>
      {/* Neon ring */}
      <Animated.View
        style={[
          styles.countdownRing,
          {
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />
      <Animated.Text
        style={[
          styles.countdownText,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {count > 0 ? count : 'LIVE!'}
      </Animated.Text>
    </View>
  );
}

// ==================== GIFT NOTIFICATION BANNER ====================
function GiftNotificationBanner({ gift, onDone }) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        tension: 80,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: -100,
            duration: 300,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]).start(() => onDone());
      }, 2500);
    });
  }, []);

  const emoji = GIFT_ICON_MAP[gift.giftName?.toLowerCase()] || '\u{1F381}';

  return (
    <Animated.View
      style={[
        styles.giftBanner,
        {
          opacity: opacityAnim,
          transform: [{ translateX: slideAnim }],
        },
      ]}
    >
      <Text style={styles.giftBannerEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.giftBannerText}>
          <Text style={styles.giftBannerUser}>{gift.senderName || 'Someone'}</Text>
          {' sent '}
          <Text style={styles.giftBannerGiftName}>{gift.giftName || 'a gift'}</Text>
        </Text>
        {gift.coinValue ? (
          <Text style={styles.giftBannerCoins}>{gift.coinValue} coins</Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

// ==================== ANIMATING NUMBER ====================
function AnimatingNumber({ target, duration = 1500, style: textStyle }) {
  const [display, setDisplay] = useState(0);
  const animRef = useRef(null);

  useEffect(() => {
    let start = 0;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplay(Math.floor(eased * target));
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [target, duration]);

  return <Text style={textStyle}>{display.toLocaleString()}</Text>;
}

// ==================== POST-STREAM SUMMARY ====================
function PostStreamSummary({ stats, topSupporters, onDone }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 60,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, []);

  const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

  return (
    <View style={styles.summaryOverlay}>
      <Animated.View
        style={[
          styles.summaryCard,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Header */}
        <Text style={styles.summaryTitle}>Great Stream!</Text>
        <Text style={styles.summarySubtitle}>Here is how it went</Text>

        {/* Stats grid */}
        <View style={styles.summaryStatsGrid}>
          <View style={styles.summaryStat}>
            <AnimatingNumber target={stats.totalViewers} style={styles.summaryStatNumber} />
            <Text style={styles.summaryStatLabel}>Total Viewers</Text>
          </View>
          <View style={styles.summaryStat}>
            <AnimatingNumber target={stats.peakViewers} style={styles.summaryStatNumber} />
            <Text style={styles.summaryStatLabel}>Peak Viewers</Text>
          </View>
          <View style={styles.summaryStat}>
            <AnimatingNumber target={stats.newFollowers} style={styles.summaryStatNumber} />
            <Text style={styles.summaryStatLabel}>New Followers</Text>
          </View>
          <View style={styles.summaryStat}>
            <AnimatingNumber target={stats.coinsEarned} style={styles.summaryStatNumber} />
            <Text style={styles.summaryStatLabel}>Coins Earned</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatNumber}>{stats.duration}</Text>
            <Text style={styles.summaryStatLabel}>Duration</Text>
          </View>
          <View style={styles.summaryStat}>
            <AnimatingNumber target={stats.chatMessages} style={styles.summaryStatNumber} />
            <Text style={styles.summaryStatLabel}>Chat Messages</Text>
          </View>
        </View>

        {/* Top supporters */}
        {topSupporters.length > 0 && (
          <View style={styles.summaryTopSection}>
            <Text style={styles.summaryTopTitle}>Top Supporters</Text>
            {topSupporters.slice(0, 3).map((supporter, i) => (
              <View key={supporter.name} style={styles.summaryTopRow}>
                <Text style={styles.summaryMedal}>{medals[i]}</Text>
                <Text style={styles.summaryTopName}>{supporter.name}</Text>
                <Text style={styles.summaryTopCoins}>{supporter.coins} coins</Text>
              </View>
            ))}
          </View>
        )}

        {/* Done button */}
        <TouchableOpacity style={styles.summaryDoneBtn} onPress={onDone} activeOpacity={0.8}>
          <Text style={styles.summaryDoneBtnText}>Done</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ==================== CHAT MESSAGE ITEM ====================
const ChatMessageItem = React.memo(({ item }) => {
  if (item.type === 'join') {
    return (
      <View style={styles.chatJoinRow}>
        <Ionicons name="enter-outline" size={12} color={colors.textMuted} />
        <Text style={styles.chatJoinText}>{item.username} joined</Text>
      </View>
    );
  }

  if (item.type === 'gift') {
    const emoji = GIFT_ICON_MAP[item.giftName?.toLowerCase()] || '\u{1F381}';
    return (
      <View style={[styles.chatMessageRow, styles.chatGiftRow]}>
        <Text style={styles.chatGiftEmoji}>{emoji}</Text>
        <Text style={styles.chatMessageText}>
          <Text style={styles.chatGiftUsername}>{item.username}</Text>
          {' sent '}
          <Text style={{ color: colors.tertiary }}>{item.giftName}</Text>
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.chatMessageRow}>
      <Text style={styles.chatMessageText}>
        <Text style={styles.chatUsername}>{item.username}</Text>
        {'  '}
        {item.message}
      </Text>
    </View>
  );
});

// ==================== MAIN SCREEN ====================
export default function GoLiveScreen({ navigation }) {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();

  // Pre-live state
  const [title, setTitle] = useState('');
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [facing, setFacing] = useState('front');
  const [goingLive, setGoingLive] = useState(false);

  // Stream state
  const [isLive, setIsLive] = useState(false);
  const [streamId, setStreamId] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [peakViewerCount, setPeakViewerCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Countdown state
  const [showCountdown, setShowCountdown] = useState(false);
  const [pendingStreamData, setPendingStreamData] = useState(null);

  // Post-stream summary
  const [showSummary, setShowSummary] = useState(false);
  const [summaryStats, setSummaryStats] = useState(null);
  const [topSupporters, setTopSupporters] = useState([]);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatListRef = useRef(null);
  const chatMessageCountRef = useRef(0);

  // Gift tracking
  const [topGifters, setTopGifters] = useState([]);
  const [giftNotifications, setGiftNotifications] = useState([]);
  const giftNotifIdRef = useRef(0);
  const gifterMapRef = useRef({});
  const totalCoinsRef = useRef(0);

  const cameraRef = useRef(null);
  const socketRef = useRef(null);
  const timerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // LiveKit state
  const [livekitToken, setLivekitToken] = useState(null);
  const [livekitUrl, setLivekitUrl] = useState(null);

  // Snap Camera Kit state
  const [showLenses, setShowLenses] = useState(false);
  const {
    isSnapAvailable,
    lenses,
    activeLens,
    applyLens,
    clearLens,
  } = useSnapCamera();

  // --- Web permission state ---
  const [webPermission, setWebPermission] = useState(Platform.OS === 'web' ? null : undefined);

  // --- Native permission hook ---
  const nativePermHook = Platform.OS !== 'web' && useCameraPermissions ? useCameraPermissions() : [null, null];
  const [nativePerm, requestNativePerm] = nativePermHook || [null, null];

  const hasPermission =
    Platform.OS === 'web'
      ? webPermission === true
      : nativePerm?.granted === true;

  const permissionDenied =
    Platform.OS === 'web'
      ? webPermission === false
      : nativePerm && !nativePerm.granted && !nativePerm.canAskAgain;

  // Request web camera permission on mount
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
    }
  }, []);

  // Request native permission on mount
  useEffect(() => {
    if (Platform.OS !== 'web' && requestNativePerm && !nativePerm?.granted) {
      requestNativePerm();
    }
  }, []);

  const filters = [
    { id: 'beauty', label: 'Beauty', icon: 'sparkles' },
    { id: 'funny', label: 'Funny', icon: 'happy' },
    { id: 'cool', label: 'Cool', icon: 'snow' },
    { id: 'vintage', label: 'Vintage', icon: 'film' },
  ];

  // Track peak viewers
  useEffect(() => {
    if (viewerCount > peakViewerCount) {
      setPeakViewerCount(viewerCount);
    }
  }, [viewerCount]);

  // Pulse animation for Go Live button
  useEffect(() => {
    if (isLive || showCountdown) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: USE_NATIVE_DRIVER }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isLive, showCountdown]);

  // Live timer
  useEffect(() => {
    if (isLive) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamId) {
        api.post(`/live/${streamId}/end`).catch(() => {});
      }
      disconnectLiveSocket();
    };
  }, [streamId]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const flipCamera = () => {
    setFacing((f) => (f === 'front' ? 'back' : 'front'));
  };

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    // If LiveKit is active, toggle the microphone track
    // This is a UI toggle; LiveKit track muting would be handled by LiveKitPublisher
  }, []);

  const handleShare = useCallback(async () => {
    const streamLink = streamId
      ? `https://grgr.app/live/${streamId}`
      : 'https://grgr.app/live';
    try {
      await Share.share({
        message: `Watch me live on GRGR! ${streamLink}`,
        url: streamLink,
      });
    } catch (err) {
      // User cancelled or share failed silently
    }
  }, [streamId]);

  // Add a gift to the tracking map and update top gifters
  const trackGift = useCallback((senderName, coinValue) => {
    const map = gifterMapRef.current;
    if (!map[senderName]) {
      map[senderName] = 0;
    }
    map[senderName] += coinValue;
    totalCoinsRef.current += coinValue;

    // Recalculate top 3
    const sorted = Object.entries(map)
      .map(([name, coins]) => ({ name, coins }))
      .sort((a, b) => b.coins - a.coins)
      .slice(0, 3);
    setTopGifters(sorted);
  }, []);

  // Show a gift notification banner
  const showGiftNotification = useCallback((gift) => {
    const id = giftNotifIdRef.current++;
    setGiftNotifications((prev) => [...prev, { ...gift, _id: id }]);
  }, []);

  const removeGiftNotification = useCallback((id) => {
    setGiftNotifications((prev) => prev.filter((n) => n._id !== id));
  }, []);

  // Setup socket listeners for chat/gifts when live
  const setupSocketListeners = useCallback((socket, sid) => {
    socket.emit('join-stream', sid);

    socket.on('viewer-count', (payload) => {
      setViewerCount(payload.count);
    });

    socket.on('chat-message', (payload) => {
      chatMessageCountRef.current += 1;
      setChatMessages((prev) => [
        {
          id: `chat-${Date.now()}-${chatMessageCountRef.current}`,
          type: 'message',
          username: payload.username || payload.user?.username || 'viewer',
          message: payload.message || payload.text || '',
        },
        ...prev,
      ].slice(0, 100));
    });

    socket.on('gift-sent', (payload) => {
      const senderName = payload.senderName || payload.user?.username || 'Someone';
      const giftName = payload.giftName || payload.gift?.name || 'Gift';
      const coinValue = payload.coinValue || payload.gift?.coin_cost || 1;

      // Add as highlighted chat message
      chatMessageCountRef.current += 1;
      setChatMessages((prev) => [
        {
          id: `gift-${Date.now()}-${chatMessageCountRef.current}`,
          type: 'gift',
          username: senderName,
          giftName,
          coinValue,
        },
        ...prev,
      ].slice(0, 100));

      // Track gifter
      trackGift(senderName, coinValue);

      // Show banner notification
      showGiftNotification({ senderName, giftName, coinValue });
    });

    socket.on('viewer-joined', (payload) => {
      const username = payload.username || payload.user?.username || 'Someone';
      setChatMessages((prev) => [
        {
          id: `join-${Date.now()}-${Math.random()}`,
          type: 'join',
          username,
        },
        ...prev,
      ].slice(0, 100));
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message);
    });
  }, [trackGift, showGiftNotification]);

  const handleGoLive = async () => {
    setGoingLive(true);
    try {
      // 1. Create stream on backend
      const { data } = await api.post('/live/start', { title: title.trim() || 'My Livestream' });
      const sid = data.stream?.id || data.id;

      // 2. Store LiveKit credentials if returned
      const token = data.token || null;
      const url = data.livekitUrl || null;

      // 3. Connect to socket.io /live namespace
      const socket = await connectLiveSocket();
      socketRef.current = socket;

      // Store pending data and show countdown
      setPendingStreamData({ sid, token, url, socket });
      setGoingLive(false);
      setShowCountdown(true);
    } catch (err) {
      console.error('Go live error:', err);
      Alert.alert('Failed to go live', err.response?.data?.error || 'Please try again.');
      setGoingLive(false);
    }
  };

  const handleCountdownComplete = useCallback(() => {
    setShowCountdown(false);
    if (!pendingStreamData) return;

    const { sid, token, url, socket } = pendingStreamData;
    setStreamId(sid);

    if (token && url) {
      setLivekitToken(token);
      setLivekitUrl(url);
    }

    // Setup socket listeners
    setupSocketListeners(socket, sid);

    setIsLive(true);
    setElapsed(0);
    setPendingStreamData(null);
  }, [pendingStreamData, setupSocketListeners]);

  const handleEndLive = async () => {
    Alert.alert('End Livestream?', 'Are you sure you want to stop streaming?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End',
        style: 'destructive',
        onPress: async () => {
          try {
            if (streamId) {
              await api.post(`/live/${streamId}/end`);
            }
          } catch {}
          disconnectLiveSocket();
          socketRef.current = null;
          setLivekitToken(null);
          setLivekitUrl(null);
          setIsLive(false);

          // Generate summary stats (mock where backend data isn't available)
          const duration = formatTime(elapsed);
          const totalViewers = Math.max(peakViewerCount, viewerCount, Math.floor(Math.random() * 200) + 50);
          const peak = peakViewerCount || Math.floor(totalViewers * 0.8);
          const newFollowers = Math.floor(Math.random() * 30) + 5;
          const coinsEarned = totalCoinsRef.current || Math.floor(Math.random() * 500) + 100;
          const chatCount = chatMessageCountRef.current || Math.floor(Math.random() * 150) + 20;

          setSummaryStats({
            totalViewers,
            peakViewers: peak,
            newFollowers,
            coinsEarned,
            duration,
            chatMessages: chatCount,
          });

          // Top supporters from tracked gifters, or mock data
          const supporters = topGifters.length > 0
            ? topGifters
            : [
                { name: 'sparkle_queen', coins: 250 },
                { name: 'dj_mike42', coins: 120 },
                { name: 'neon_vibes', coins: 85 },
              ];
          setTopSupporters(supporters);
          setShowSummary(true);

          setStreamId(null);
          setViewerCount(0);
        },
      },
    ]);
  };

  const handleSummaryDone = useCallback(() => {
    setShowSummary(false);
    navigation.goBack();
  }, [navigation]);

  const handleSendMessage = useCallback(() => {
    const text = chatInput.trim();
    if (!text || !socketRef.current) return;

    socketRef.current.emit('send-message', {
      streamId,
      message: text,
    });

    // Add locally immediately
    chatMessageCountRef.current += 1;
    setChatMessages((prev) => [
      {
        id: `self-${Date.now()}-${chatMessageCountRef.current}`,
        type: 'message',
        username: 'You',
        message: text,
      },
      ...prev,
    ].slice(0, 100));

    setChatInput('');
  }, [chatInput, streamId]);

  const requestPermission = async () => {
    if (Platform.OS === 'web') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stream.getTracks().forEach((t) => t.stop());
        setWebPermission(true);
      } catch {
        setWebPermission(false);
        Alert.alert('Permission denied', 'Please enable camera access in your browser settings.');
      }
    } else if (requestNativePerm) {
      await requestNativePerm();
    }
  };

  // Chat key extractor
  const chatKeyExtractor = useCallback((item) => item.id, []);

  // Chat render item
  const renderChatItem = useCallback(({ item }) => <ChatMessageItem item={item} />, []);

  // ---- RENDER ----

  // Permission not yet determined — loading
  if (Platform.OS === 'web' ? webPermission === null : !nativePerm) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.permissionSubtext, { marginTop: spacing.md }]}>Requesting camera access...</Text>
      </View>
    );
  }

  // Permission denied
  if (!hasPermission) {
    return <PermissionDenied onRequest={requestPermission} onBack={() => navigation.goBack()} />;
  }

  // Post-stream summary
  if (showSummary && summaryStats) {
    return (
      <PostStreamSummary
        stats={summaryStats}
        topSupporters={topSupporters}
        onDone={handleSummaryDone}
      />
    );
  }

  // When live with LiveKit token, wrap everything in LiveKitPublisher
  const useLiveKit = isLive && livekitToken && livekitUrl;

  const renderCameraPreview = () => {
    // When LiveKit is connected, it handles the camera track — skip local preview
    if (useLiveKit) return null;

    if (Platform.OS === 'web') {
      return <WebCameraPreview facing={facing} style={styles.cameraPreview} />;
    } else if (Platform.OS !== 'web' && isSnapAvailable && SnapCameraKitView) {
      // Use Snap Camera Kit when available (dev build) — supports AR lenses
      return (
        <SnapCameraKitView
          style={styles.cameraPreview}
          facing={facing}
        />
      );
    } else if (CameraView) {
      return (
        <CameraView
          ref={cameraRef}
          style={styles.cameraPreview}
          facing={facing}
          mode="video"
        />
      );
    } else {
      return (
        <View style={[styles.cameraPreview, styles.cameraFallback]}>
          <Ionicons name="camera-outline" size={80} color={colors.textMuted} />
          <Text style={styles.cameraHint}>Camera not available</Text>
        </View>
      );
    }
  };

  const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

  const overlayContent = (
    <>
      {/* Countdown overlay */}
      {showCountdown && (
        <CountdownOverlay onComplete={handleCountdownComplete} />
      )}

      {/* LIVE indicator overlay */}
      {isLive && (
        <View style={styles.liveIndicatorRow}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <View style={styles.timerBadge}>
            <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
          </View>
          <View style={styles.viewerBadge}>
            <Ionicons name="eye" size={14} color="#fff" />
            <Text style={styles.viewerText}>{viewerCount}</Text>
          </View>
        </View>
      )}

      {/* Top gifters strip — below LIVE indicator when live */}
      {isLive && topGifters.length > 0 && (
        <View style={styles.topGiftersStrip}>
          {topGifters.slice(0, 3).map((gifter, i) => (
            <View key={gifter.name} style={styles.topGifterItem}>
              <Text style={styles.topGifterMedal}>{medals[i]}</Text>
              <Text style={styles.topGifterName} numberOfLines={1}>{gifter.name}</Text>
              <Text style={styles.topGifterCoins}>{gifter.coins}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Gift notification banners */}
      {isLive && (
        <View style={styles.giftNotifContainer}>
          {giftNotifications.map((gift) => (
            <GiftNotificationBanner
              key={gift._id}
              gift={gift}
              onDone={() => removeGiftNotification(gift._id)}
            />
          ))}
        </View>
      )}

      {/* Top bar */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <TouchableOpacity onPress={isLive ? handleEndLive : () => navigation.goBack()} style={styles.closeBtn}>
          <Ionicons name={isLive ? 'stop' : 'close'} size={26} color={isLive ? colors.error : colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isLive ? '' : 'Go Live'}</Text>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      {/* Camera controls (right side) */}
      <View style={styles.cameraControls}>
        {/* Flip — always visible */}
        <TouchableOpacity style={styles.cameraControlBtn} onPress={flipCamera}>
          <View style={styles.controlCircle}>
            <Ionicons name="camera-reverse-outline" size={22} color={colors.text} />
          </View>
          <Text style={styles.cameraControlLabel}>Flip</Text>
        </TouchableOpacity>

        {/* AR Lens toggle — always visible */}
        {Platform.OS !== 'web' && (
          <TouchableOpacity
            style={styles.cameraControlBtn}
            onPress={() => setShowLenses((v) => !v)}
          >
            <View style={[styles.controlCircle, activeLens && styles.controlCircleActive]}>
              <Ionicons
                name={activeLens ? 'happy' : 'happy-outline'}
                size={22}
                color={activeLens ? '#FFFC00' : colors.text}
              />
            </View>
            <Text style={[styles.cameraControlLabel, activeLens && { color: '#FFFC00' }]}>
              {activeLens ? 'AR On' : 'Face AR'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Mute mic — visible when live */}
        {isLive && (
          <TouchableOpacity style={styles.cameraControlBtn} onPress={toggleMute}>
            <View style={[styles.controlCircle, isMuted && styles.controlCircleMuted]}>
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic-outline'}
                size={22}
                color={isMuted ? colors.error : colors.text}
              />
            </View>
            <Text style={[styles.cameraControlLabel, isMuted && { color: colors.error }]}>
              {isMuted ? 'Muted' : 'Mic'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Share — visible when live */}
        {isLive && (
          <TouchableOpacity style={styles.cameraControlBtn} onPress={handleShare}>
            <View style={styles.controlCircle}>
              <Ionicons name="share-outline" size={22} color={colors.text} />
            </View>
            <Text style={styles.cameraControlLabel}>Share</Text>
          </TouchableOpacity>
        )}

        {/* Pre-live only controls */}
        {!isLive && !showCountdown && (
          <>
            <TouchableOpacity style={styles.cameraControlBtn}>
              <View style={styles.controlCircle}>
                <Ionicons name="flash-outline" size={22} color={colors.text} />
              </View>
              <Text style={styles.cameraControlLabel}>Flash</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cameraControlBtn}>
              <View style={styles.controlCircle}>
                <Ionicons name="timer-outline" size={22} color={colors.text} />
              </View>
              <Text style={styles.cameraControlLabel}>Timer</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Snap AR Lens Picker */}
      {showLenses && Platform.OS !== 'web' && (
        <View style={styles.lensPickerContainer}>
          {isSnapAvailable ? (
            <LensPicker
              lenses={lenses}
              activeLensId={activeLens?.id}
              onSelect={applyLens}
              onClear={clearLens}
            />
          ) : (
            <View style={styles.arUnavailable}>
              <Ionicons name="warning-outline" size={18} color={colors.textMuted} />
              <Text style={styles.arUnavailableText}>
                AR lenses require a development build
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Live chat overlay + input */}
      {isLive && (
        <KeyboardAvoidingView
          style={styles.chatKeyboardWrapper}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={10}
          pointerEvents="box-none"
        >
          {/* Tap above chat to dismiss keyboard */}
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.chatDismissZone} />
          </TouchableWithoutFeedback>

          {/* Chat messages */}
          <View style={styles.chatOverlayContainer}>
            <FlatList
              ref={chatListRef}
              data={chatMessages}
              keyExtractor={chatKeyExtractor}
              renderItem={renderChatItem}
              inverted={true}
              style={styles.chatList}
              contentContainerStyle={styles.chatListContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          </View>

          {/* Chat input */}
          <View style={styles.chatInputBar}>
            <View style={styles.chatInputContainer}>
              <Ionicons name="chatbubble-outline" size={16} color={colors.textMuted} style={{ marginLeft: 14 }} />
              {Platform.OS === 'web' ? (
                <input
                  type="text"
                  placeholder="Say something..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#fff',
                    fontSize: 14,
                    paddingLeft: 8,
                    paddingRight: 8,
                    paddingTop: 10,
                    paddingBottom: 10,
                    fontFamily: 'inherit',
                  }}
                />
              ) : (
                <TextInput
                  style={styles.chatInputField}
                  placeholder="Say something..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={chatInput}
                  onChangeText={setChatInput}
                  onSubmitEditing={handleSendMessage}
                  returnKeyType="send"
                  blurOnSubmit={false}
                />
              )}
              <TouchableOpacity
                style={[styles.chatSendBtn, chatInput.trim() && styles.chatSendBtnActive]}
                onPress={handleSendMessage}
                disabled={!chatInput.trim()}
              >
                <Ionicons
                  name="send"
                  size={16}
                  color={chatInput.trim() ? '#fff' : 'rgba(255,255,255,0.3)'}
                />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Bottom controls — only before going live */}
      {!isLive && !showCountdown && (
        <SafeAreaView style={styles.bottomSection} edges={['bottom']}>
          <View style={styles.filtersRow}>
            {filters.map((filter) => {
              const isActive = selectedFilter === filter.id;
              return (
                <TouchableOpacity
                  key={filter.id}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setSelectedFilter(isActive ? null : filter.id)}
                >
                  <Ionicons name={filter.icon} size={14} color={isActive ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={styles.titleInput}
            placeholder="Add a title for your stream..."
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  setShowLenses((v) => !v);
                }
              }}
            >
              <View style={styles.actionBtnCircle}>
                <Ionicons name="color-wand-outline" size={22} color={colors.text} />
              </View>
              <Text style={styles.actionLabel}>Effects</Text>
            </TouchableOpacity>

            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={styles.goLiveButton}
                activeOpacity={0.8}
                onPress={handleGoLive}
                disabled={goingLive}
              >
                <View style={styles.goLiveInner}>
                  {goingLive ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="radio" size={26} color="#fff" />
                      <Text style={styles.goLiveText}>Go LIVE</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity style={styles.actionBtn}>
              <View style={styles.actionBtnCircle}>
                <Ionicons name="people-outline" size={22} color={colors.text} />
              </View>
              <Text style={styles.actionLabel}>Battle</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}

      {/* End stream button when live */}
      {isLive && (
        <SafeAreaView style={styles.endLiveSection} edges={['bottom']} pointerEvents="box-none">
          <TouchableOpacity style={styles.endLiveButton} onPress={handleEndLive} activeOpacity={0.8}>
            <Ionicons name="stop-circle" size={22} color="#fff" />
            <Text style={styles.endLiveText}>End Stream</Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}
    </>
  );

  // Render with or without LiveKit wrapper
  if (useLiveKit) {
    return (
      <LiveKitPublisher
        url={livekitUrl}
        token={livekitToken}
        style={styles.container}
        onConnected={() => console.log('[LiveKit] Publisher connected')}
        onDisconnected={() => console.log('[LiveKit] Publisher disconnected')}
      >
        {overlayContent}
      </LiveKitPublisher>
    );
  }

  return (
    <View style={styles.container}>
      {renderCameraPreview()}
      {overlayContent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cameraPreview: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraFallback: {
    backgroundColor: colors.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraHint: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
    opacity: 0.5,
  },

  // Permission screen
  permissionContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  permissionTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  permissionSubtext: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: spacing.xl,
  },
  permissionBtnText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '700',
  },

  // Countdown
  countdownContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 100,
  },
  countdownRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 4,
    borderColor: colors.primary,
    shadowColor: colors.primaryDim,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 20,
  },
  countdownText: {
    fontSize: 96,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: colors.primaryDim,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },

  // LIVE indicator
  liveIndicatorRow: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 60 : 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 10,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  liveText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: '900',
    letterSpacing: 1,
  },
  timerBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  timerText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  viewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  viewerText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },

  // Top gifters strip
  topGiftersStrip: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 90 : 130,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    zIndex: 10,
  },
  topGifterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  topGifterMedal: {
    fontSize: 14,
  },
  topGifterName: {
    color: colors.text,
    fontSize: fontSize.xs,
    fontWeight: '600',
    maxWidth: 70,
  },
  topGifterCoins: {
    color: colors.tertiary,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },

  // Gift notification banners
  giftNotifContainer: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 120 : 165,
    left: spacing.md,
    right: spacing.md,
    zIndex: 15,
    gap: spacing.sm,
  },
  giftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(170, 48, 250, 0.25)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(211, 148, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: spacing.sm,
  },
  giftBannerEmoji: {
    fontSize: 28,
  },
  giftBannerText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  giftBannerUser: {
    fontWeight: '700',
    color: colors.primary,
  },
  giftBannerGiftName: {
    fontWeight: '700',
    color: colors.tertiary,
  },
  giftBannerCoins: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },

  // Camera controls
  cameraControls: {
    position: 'absolute',
    right: spacing.md,
    top: 120,
    gap: spacing.lg,
    alignItems: 'center',
  },
  cameraControlBtn: {
    alignItems: 'center',
    gap: 6,
  },
  controlCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlCircleActive: {
    backgroundColor: 'rgba(255, 252, 0, 0.15)',
    borderColor: 'rgba(255, 252, 0, 0.4)',
  },
  controlCircleMuted: {
    backgroundColor: 'rgba(255, 110, 132, 0.15)',
    borderColor: 'rgba(255, 110, 132, 0.4)',
  },
  cameraControlLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },

  // Bottom section (pre-live)
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    gap: spacing.md,
  },

  // End live button section — right-aligned above chat
  endLiveSection: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    padding: spacing.md,
    paddingBottom: spacing.md,
    alignItems: 'flex-end',
  },

  // Filter chips
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.glass,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  filterChipActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  filterLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  filterLabelActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // Title input
  titleInput: {
    backgroundColor: colors.glass,
    borderRadius: 14,
    padding: spacing.md,
    color: colors.text,
    fontSize: fontSize.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.md,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 6,
  },
  actionBtnCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },

  // Go Live button
  goLiveButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  goLiveInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryDim,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    elevation: 8,
    shadowColor: colors.primaryDim,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  goLiveText: {
    color: '#fff',
    fontSize: fontSize.xs,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // End live button
  endLiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.error,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  endLiveText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '800',
  },

  // Chat layout
  chatKeyboardWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  chatDismissZone: {
    height: 200,
  },
  chatOverlayContainer: {
    maxHeight: 220,
    width: '78%',
    paddingHorizontal: spacing.sm,
  },
  chatList: {
    flexGrow: 0,
  },
  chatListContent: {
    paddingVertical: spacing.xs,
  },
  chatMessageRow: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginVertical: 2,
    alignSelf: 'flex-start',
  },
  chatGiftRow: {
    backgroundColor: 'rgba(170, 48, 250, 0.25)',
    borderRadius: 14,
    marginVertical: 2,
    paddingVertical: 5,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(170, 48, 250, 0.3)',
  },
  chatGiftEmoji: {
    fontSize: 14,
  },
  chatMessageText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    lineHeight: 17,
  },
  chatUsername: {
    fontWeight: '700',
    color: colors.primary,
    marginRight: 4,
  },
  chatGiftUsername: {
    fontWeight: '700',
    color: colors.tertiary,
    marginRight: 4,
  },
  chatJoinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 10,
    opacity: 0.5,
    alignSelf: 'flex-start',
  },
  chatJoinText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },

  // Chat input
  chatInputBar: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.md,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chatInputField: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    color: '#fff',
    fontSize: 14,
  },
  chatSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatSendBtnActive: {
    backgroundColor: colors.primary,
  },

  // AR Lens controls
  lensPickerContainer: {
    position: 'absolute',
    bottom: 220,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.sm,
    zIndex: 20,
  },
  arUnavailable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  arUnavailableText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },

  // Post-stream summary
  summaryOverlay: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  summaryCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 24,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: {
    fontSize: fontSize.xxl,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  summarySubtitle: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  summaryStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryStat: {
    width: '30%',
    alignItems: 'center',
    gap: 4,
  },
  summaryStatNumber: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.primary,
  },
  summaryStatLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  summaryTopSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryTopTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: spacing.sm,
  },
  summaryMedal: {
    fontSize: 20,
  },
  summaryTopName: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  summaryTopCoins: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.tertiary,
  },
  summaryDoneBtn: {
    backgroundColor: colors.primaryDim,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  summaryDoneBtnText: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
});
