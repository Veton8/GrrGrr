import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Platform,
  Animated,
  Easing,
  useWindowDimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../../utils/theme';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import { LiveKitViewer } from '../../components/live/LiveKitRoom';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const BACKGROUND_VIDEO_URL =
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

const MOCK_USERNAMES = [
  'sparkle_queen', 'dj_mike42', 'luna_star', 'cool_cat99', 'neon_vibes',
  'pixel_dust', 'vibe_master', 'glow_girl', 'turbo_fan', 'star_gazer',
  'wave_rider', 'dream_chaser', 'flash_mob', 'sunny_days', 'midnight_owl',
  'cosmic_ray', 'fire_dancer', 'ocean_breeze', 'thunder_bolt', 'crystal_clear',
];

const MOCK_MESSAGES = [
  'omg so cool!', 'send gifts!', 'love this!', 'first time here',
  'where are you from?', 'amazing!!', 'hello everyone!', 'you are the best!',
  'keep going!', 'so talented!', 'wow just wow', 'can you say hi to me?',
  'greetings from Brazil!', 'love from Japan', 'this is fire!',
  'how do you do that??', 'incredible!', 'goals!!', 'share your secret!',
  'I just followed you!',
];

const NEON_HEART_COLORS = ['#FF1493', '#00FFFF', '#FF00FF', '#FFFFFF'];

const FLOATING_ICONS = ['\u2764\uFE0F', '\uD83D\uDC8E', '\uD83E\uDE99', '\u2B50', '\uD83D\uDC9C', '\uD83D\uDC96'];

// Gift tiers based on cost
const GIFT_TIERS = {
  1: {
    bg: 'rgba(170, 48, 250, 0.15)',
    borderColor: 'rgba(170, 48, 250, 0.3)',
    labelColor: '#b388ff',
    label: 'Gift',
  },
  2: {
    bg: 'rgba(211, 148, 255, 0.2)',
    borderColor: 'rgba(211, 148, 255, 0.5)',
    labelColor: '#d394ff',
    label: 'Super Gift',
  },
  3: {
    bg: 'rgba(0, 238, 252, 0.15)',
    borderColor: 'rgba(0, 238, 252, 0.4)',
    labelColor: '#00eefc',
    label: 'Ultra Gift',
  },
  4: {
    bg: 'linear-gradient',
    borderColor: '#ffe792',
    labelColor: '#ffe792',
    label: 'LEGENDARY',
    bgFallback: 'rgba(255, 215, 9, 0.2)',
  },
};

const GIFT_ICON_MAP = {
  rose: '\uD83C\uDF39',
  heart: '\u2764\uFE0F',
  star: '\u2B50',
  fire: '\uD83D\uDD25',
  diamond: '\uD83D\uDC8E',
  crown: '\uD83D\uDC51',
  rocket: '\uD83D\uDE80',
  castle: '\uD83C\uDFF0',
  lion: '\uD83E\uDD81',
  universe: '\uD83C\uDF0C',
};

const MOCK_TOP_GIFTERS = [
  { id: 1, username: 'sparkle_queen', initial: 'S', borderColor: '#FFD700' },
  { id: 2, username: 'dj_mike42', initial: 'D', borderColor: '#C0C0C0' },
  { id: 3, username: 'luna_star', initial: 'L', borderColor: '#CD7F32' },
  { id: 4, username: 'cool_cat99', initial: 'C', borderColor: 'rgba(255,255,255,0.3)' },
  { id: 5, username: 'neon_vibes', initial: 'N', borderColor: 'rgba(255,255,255,0.3)' },
];

const GIFT_CATEGORIES = ['Popular', 'New', 'Premium'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getGiftTier(cost) {
  if (cost >= 1000) return 4;
  if (cost >= 200) return 3;
  if (cost >= 25) return 2;
  return 1;
}

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomRole() {
  const r = Math.random();
  if (r < 0.15) return 'vip';
  if (r < 0.35) return 'elite';
  return 'regular';
}

function abbreviateCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

// ---------------------------------------------------------------------------
// Shared text shadow for readability on video
// ---------------------------------------------------------------------------
const TEXT_SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.75)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
};

// ---------------------------------------------------------------------------
// Floating Heart Component (tap-to-heart)
// ---------------------------------------------------------------------------
function TapHeart({ x, y, color, screenHeight }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -(screenHeight * 0.25 + Math.random() * screenHeight * 0.15),
        duration: 1500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.2, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(scale, { toValue: 0.8, duration: 1300, useNativeDriver: Platform.OS !== 'web' }),
      ]),
      Animated.timing(translateX, {
        toValue: (Math.random() - 0.5) * 80,
        duration: 1500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 1500,
        easing: Easing.in(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - 12,
        top: y - 12,
        opacity,
        transform: [{ translateY }, { translateX }, { scale }],
      }}
    >
      <Ionicons name="heart" size={24} color={color} />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Ambient Floating Icon (auto-spawned, rises from bottom-right)
// ---------------------------------------------------------------------------
function FloatingIcon({ icon, startX, delay, screenHeight }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const startAnimation = () => {
      translateY.setValue(0);
      translateX.setValue(0);
      opacity.setValue(0);
      scale.setValue(0.5);

      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -(screenHeight * 0.4),
            duration: 3000 + Math.random() * 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
            Animated.delay(1500),
            Animated.timing(opacity, { toValue: 0, duration: 1000, useNativeDriver: Platform.OS !== 'web' }),
          ]),
          Animated.timing(scale, { toValue: 1.2, duration: 3000, useNativeDriver: Platform.OS !== 'web' }),
          Animated.sequence([
            Animated.timing(translateX, { toValue: Math.random() * 40 - 20, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(translateX, { toValue: Math.random() * -40 + 20, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
          ]),
        ]),
      ]).start(() => startAnimation());
    };
    startAnimation();
  }, []);

  return (
    <Animated.View style={{ position: 'absolute', bottom: 180, right: startX, opacity, transform: [{ translateY }, { translateX }, { scale }] }}>
      <Text style={{ fontSize: 24 }}>{icon}</Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Pulsing Ring for Streamer Avatar
// ---------------------------------------------------------------------------
function PulsingNeonRing() {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
        ]),
        Animated.sequence([
          Animated.timing(opacityAnim, { toValue: 0.3, duration: 1200, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(opacityAnim, { toValue: 0.8, duration: 1200, useNativeDriver: Platform.OS !== 'web' }),
        ]),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#FF1493',
        opacity: opacityAnim,
        transform: [{ scale: pulseAnim }],
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Pulsing Red Dot for LIVE badge
// ---------------------------------------------------------------------------
function PulsingDot() {
  const dotAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 0.3, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(dotAnim, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    ).start();
  }, []);
  return <Animated.View style={[styles.liveDot, { opacity: dotAnim }]} />;
}

// ---------------------------------------------------------------------------
// Gift Button with Breathing Glow
// ---------------------------------------------------------------------------
function GiftButtonGlow({ onPress }) {
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    ).start();
  }, []);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Animated.View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: '#FF1493',
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#FF1493',
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 12,
          elevation: 8,
          ...Platform.select({
            web: {},
            default: {},
          }),
          shadowOpacity: glowAnim.__getValue ? undefined : 0.6,
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: '#FF1493',
            opacity: glowAnim,
            ...Platform.select({
              web: { boxShadow: '0 0 20px rgba(255,20,147,0.6)' },
              default: {},
            }),
          }}
        />
        <Ionicons name="gift" size={24} color="#fff" style={{ zIndex: 1 }} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Chat Input (cross-platform: web uses <input>, native uses TextInput)
// ---------------------------------------------------------------------------
function ChatInput({ onSend, screenWidth }) {
  const domRef = useRef(null);
  const [nativeValue, setNativeValue] = useState('');
  const inputWidth = screenWidth * 0.7;

  const handleSendNative = () => {
    const val = nativeValue.trim();
    if (val) {
      onSend(val);
      setNativeValue('');
    }
  };

  return (
    <View style={[chatInputStyles.container, { width: inputWidth + 56 }]}>
      <View style={[chatInputStyles.pill, { width: inputWidth }]}>
        <Ionicons name="happy-outline" size={20} color="rgba(255,255,255,0.4)" style={{ marginLeft: 12 }} />
        {Platform.OS === 'web' ? (
          <input
            ref={domRef}
            type="text"
            placeholder="Say something..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#E0E0E0',
              fontSize: 14,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 10,
              paddingBottom: 10,
              fontFamily: 'inherit',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const val = domRef.current?.value?.trim();
                if (val) { onSend(val); domRef.current.value = ''; }
              }
            }}
          />
        ) : (
          <TextInput
            style={chatInputStyles.textInput}
            placeholder="Say something..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={nativeValue}
            onChangeText={setNativeValue}
            onSubmitEditing={handleSendNative}
            returnKeyType="send"
            blurOnSubmit={false}
          />
        )}
      </View>
      <TouchableOpacity
        style={chatInputStyles.sendBtn}
        onPress={() => {
          if (Platform.OS === 'web' && domRef.current) {
            const val = domRef.current.value?.trim();
            if (val) { onSend(val); domRef.current.value = ''; }
          } else {
            handleSendNative();
          }
        }}
      >
        <Ionicons name="send" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const chatInputStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  pill: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    color: '#E0E0E0',
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF1493',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ---------------------------------------------------------------------------
// Stream End Screen
// ---------------------------------------------------------------------------
function StreamEndOverlay({ hostName, navigation, screenWidth }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const autoDismissRef = useRef(null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }).start();
    autoDismissRef.current = setTimeout(() => {
      navigation.goBack();
    }, 8000);
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, []);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', zIndex: 999, opacity: fadeAnim }]}>
      {/* Streamer Avatar */}
      <View style={endStyles.avatarOuter}>
        <View style={endStyles.avatarNeonRing} />
        <View style={endStyles.avatar}>
          <Ionicons name="person" size={36} color="#fff" />
        </View>
      </View>

      <Text style={endStyles.username}>@{hostName}</Text>
      <Text style={endStyles.endedText}>Stream ended</Text>

      {/* Stats Row */}
      <View style={endStyles.statsRow}>
        <View style={endStyles.statItem}>
          <Text style={endStyles.statValue}>1h 23m</Text>
          <Text style={endStyles.statLabel}>Duration</Text>
        </View>
        <View style={[endStyles.statItem, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.15)' }]}>
          <Text style={endStyles.statValue}>2.4K</Text>
          <Text style={endStyles.statLabel}>Peak Viewers</Text>
        </View>
      </View>

      {/* Top 3 Gifters */}
      <Text style={endStyles.topGiftersTitle}>Top Gifters</Text>
      <View style={endStyles.topGiftersRow}>
        {MOCK_TOP_GIFTERS.slice(0, 3).map((g, i) => (
          <View key={g.id} style={endStyles.topGifterItem}>
            <View style={[endStyles.topGifterAvatar, { borderColor: g.borderColor }]}>
              <Text style={endStyles.topGifterInitial}>{g.initial}</Text>
            </View>
            <Text style={endStyles.topGifterRank}>#{i + 1}</Text>
          </View>
        ))}
      </View>

      {/* Follow Button */}
      <TouchableOpacity style={endStyles.followBtn}>
        <Text style={endStyles.followBtnText}>Follow @{hostName}</Text>
      </TouchableOpacity>

      {/* Back to Feed */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
        <Text style={endStyles.backText}>Back to Feed</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const endStyles = StyleSheet.create({
  avatarOuter: { width: 88, height: 88, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarNeonRing: {
    position: 'absolute', width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: '#FF1493',
    ...Platform.select({ web: { boxShadow: '0 0 20px rgba(255,20,147,0.5)' }, default: { shadowColor: '#FF1493', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 16 } }),
  },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
  username: { color: '#fff', fontSize: 18, fontWeight: '700', ...TEXT_SHADOW },
  endedText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 4, ...TEXT_SHADOW },
  statsRow: { flexDirection: 'row', marginTop: 24, gap: 0 },
  statItem: { alignItems: 'center', paddingHorizontal: 24 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '700', ...TEXT_SHADOW },
  statLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2, ...TEXT_SHADOW },
  topGiftersTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600', marginTop: 24, marginBottom: 8, ...TEXT_SHADOW },
  topGiftersRow: { flexDirection: 'row', gap: 16 },
  topGifterItem: { alignItems: 'center' },
  topGifterAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
  topGifterInitial: { color: '#fff', fontSize: 14, fontWeight: '700' },
  topGifterRank: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '600', marginTop: 2 },
  followBtn: {
    marginTop: 24, backgroundColor: '#FF1493', borderRadius: 24, paddingVertical: 14, paddingHorizontal: 48,
    ...Platform.select({ web: { boxShadow: '0 0 20px rgba(255,20,147,0.4)' }, default: { shadowColor: '#FF1493', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12 } }),
  },
  followBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, ...TEXT_SHADOW },
});

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================
export default function LiveStreamScreen({ route, navigation }) {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const streamId = route?.params?.streamId;
  const hostName = route?.params?.hostName || 'DJ_Sparkle';
  const hostId = route?.params?.hostId;
  const { user, updateUser } = useAuthStore();

  // ---- Background video player (expo-video) fallback ----
  const bgPlayer = useVideoPlayer(BACKGROUND_VIDEO_URL, (p) => {
    p.loop = true;
    p.muted = false;
    p.showNowPlayingNotification = false;
    p.play();
  });

  // ---- State ----
  const [livekitToken, setLivekitToken] = useState(null);
  const [livekitUrl, setLivekitUrl] = useState(null);
  const [streamEnded, setStreamEnded] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [messages, setMessages] = useState([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [followerCount] = useState(12500);
  const [floatingIcons, setFloatingIcons] = useState([]);
  const [tapHearts, setTapHearts] = useState([]);
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [giftCategory, setGiftCategory] = useState('Popular');
  const [availableGifts, setAvailableGifts] = useState([]);
  const [selectedGift, setSelectedGift] = useState(null);
  const [sendingGift, setSendingGift] = useState(false);
  const sendingGiftRef = useRef(false);
  const [giftMessage, setGiftMessage] = useState('');
  const [giftPopups, setGiftPopups] = useState([]);
  const giftPopupIdRef = useRef(0);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  const chatListRef = useRef(null);
  const messageIndexRef = useRef(0);
  const floatIdRef = useRef(0);
  const tapHeartIdRef = useRef(0);

  // Remove buffering after a short delay (simulates stream ready)
  useEffect(() => {
    const t = setTimeout(() => setBuffering(false), 1500);
    return () => clearTimeout(t);
  }, []);

  // ---- Fetch available gifts from API ----
  useEffect(() => {
    const fetchGifts = async () => {
      try {
        const { data } = await api.get('/gifts');
        setAvailableGifts(data);
      } catch (err) {
        setAvailableGifts([
          { id: 1, name: 'Rose', coin_cost: 1 },
          { id: 2, name: 'Heart', coin_cost: 5 },
          { id: 3, name: 'Star', coin_cost: 10 },
          { id: 4, name: 'Fire', coin_cost: 25 },
          { id: 5, name: 'Diamond', coin_cost: 50 },
          { id: 6, name: 'Crown', coin_cost: 100 },
          { id: 7, name: 'Rocket', coin_cost: 200 },
          { id: 8, name: 'Castle', coin_cost: 500 },
          { id: 9, name: 'Lion', coin_cost: 1000 },
          { id: 10, name: 'Universe', coin_cost: 5000 },
        ]);
      }
    };
    fetchGifts();
  }, []);

  // ---- Join LiveKit room as viewer ----
  useEffect(() => {
    if (!streamId) return;
    (async () => {
      try {
        const { data } = await api.post(`/live/${streamId}/join`);
        if (data.token && data.livekitUrl) {
          setLivekitToken(data.token);
          setLivekitUrl(data.livekitUrl);
        }
        if (data.stream?.viewerCount) {
          setViewerCount(data.stream.viewerCount);
        }
      } catch (err) {
        console.warn('[LiveKit] Failed to join stream:', err.message);
      }
    })();
  }, [streamId]);

  // ---- Fluctuating viewer count ----
  useEffect(() => {
    setViewerCount(Math.floor(Math.random() * 400) + 100);
    const interval = setInterval(() => {
      setViewerCount((prev) => Math.max(100, Math.min(500, prev + Math.floor(Math.random() * 40) - 15)));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // ---- Auto-populate chat messages ----
  useEffect(() => {
    const addMessage = () => {
      const username = getRandomItem(MOCK_USERNAMES);
      const message = getRandomItem(MOCK_MESSAGES);
      const role = getRandomRole();
      setMessages((prev) => [
        ...prev.slice(-49),
        { id: `msg-${Date.now()}-${messageIndexRef.current++}`, username, message, role, isGift: false, isSystem: false, isJoin: false, giftTier: null },
      ]);
    };
    const addJoinMessage = () => {
      const username = getRandomItem(MOCK_USERNAMES);
      setMessages((prev) => [
        ...prev.slice(-49),
        { id: `join-${Date.now()}`, username, message: 'joined', role: 'regular', isGift: false, isSystem: false, isJoin: true, giftTier: null },
      ]);
    };
    const addSystemMessage = () => {
      const msgs = ['New follower joined!', 'Someone shared this live!', 'Gift streak activated!', 'Welcome to the party!'];
      setMessages((prev) => [
        ...prev.slice(-49),
        { id: `sys-${Date.now()}`, username: '', message: getRandomItem(msgs), role: 'system', isGift: false, isSystem: true, isJoin: false, giftTier: null },
      ]);
    };
    addMessage();
    const msgInterval = setInterval(addMessage, 1000 + Math.random() * 1000);
    const joinInterval = setInterval(addJoinMessage, 4000 + Math.random() * 3000);
    const sysInterval = setInterval(addSystemMessage, 8000 + Math.random() * 5000);
    return () => { clearInterval(msgInterval); clearInterval(joinInterval); clearInterval(sysInterval); };
  }, []);

  // ---- Auto gift animations from mock users ----
  const launchGiftAnimation = useCallback((emoji, name, tier, sender) => {
    const popupId = `popup-${giftPopupIdRef.current++}`;
    const fadeAnim = new Animated.Value(0);
    const scaleAnim = new Animated.Value(tier >= 3 ? 0 : 0.3);
    const overlayAnim = new Animated.Value(0);
    const slideAnim = new Animated.Value(tier >= 3 ? SCREEN_HEIGHT : 0);
    const glowAnim = new Animated.Value(0);
    const shakeAnim = new Animated.Value(0);
    const textFadeAnim = new Animated.Value(0);

    const popup = { id: popupId, emoji, name, sender, tier, fadeAnim, scaleAnim, overlayAnim, slideAnim, glowAnim, shakeAnim, textFadeAnim };
    setGiftPopups(prev => [...prev, popup]);

    const cleanup = () => setGiftPopups(prev => prev.filter(p => p.id !== popupId));

    if (tier <= 1) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: false }),
        Animated.timing(textFadeAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
      ]).start(() => {
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
            Animated.timing(textFadeAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
          ]).start(cleanup);
        }, 1800);
      });
    } else if (tier === 2) {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
          Animated.spring(scaleAnim, { toValue: 1.2, friction: 4, tension: 120, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: false }),
          Animated.timing(textFadeAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
        ]),
        Animated.delay(1500),
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
          Animated.timing(textFadeAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
        ]),
      ]).start(cleanup);
    } else if (tier === 3) {
      Animated.sequence([
        Animated.timing(overlayAnim, { toValue: 0.5, duration: 200, useNativeDriver: false }),
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
          Animated.spring(slideAnim, { toValue: 0, friction: 6, tension: 60, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.spring(scaleAnim, { toValue: 1.5, friction: 3, tension: 200, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: false }),
          Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: false }),
            Animated.timing(shakeAnim, { toValue: -7, duration: 50, useNativeDriver: false }),
            Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: false }),
            Animated.timing(shakeAnim, { toValue: -5, duration: 50, useNativeDriver: false }),
            Animated.timing(shakeAnim, { toValue: 3, duration: 50, useNativeDriver: false }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: false }),
          ]),
          Animated.timing(textFadeAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
        ]),
        Animated.delay(2000),
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
          Animated.timing(overlayAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
          Animated.timing(scaleAnim, { toValue: 2, duration: 600, useNativeDriver: false }),
          Animated.timing(textFadeAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
        ]),
      ]).start(cleanup);
    } else {
      // LEGENDARY (tier 4)
      Animated.sequence([
        Animated.timing(overlayAnim, { toValue: 0.65, duration: 300, useNativeDriver: false }),
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
          Animated.timing(slideAnim, { toValue: 0, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.spring(scaleAnim, { toValue: 2, friction: 3, tension: 180, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        ]),
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1.5, duration: 100, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.8, duration: 200, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.spring(scaleAnim, { toValue: 1.3, friction: 4, useNativeDriver: false }),
          Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 12, duration: 40, useNativeDriver: false }),
            Animated.timing(shakeAnim, { toValue: -11, duration: 40, useNativeDriver: false }),
            Animated.timing(shakeAnim, { toValue: 10, duration: 40, useNativeDriver: false }),
            Animated.timing(shakeAnim, { toValue: -8, duration: 40, useNativeDriver: false }),
            Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: false }),
            Animated.timing(shakeAnim, { toValue: -4, duration: 50, useNativeDriver: false }),
            Animated.timing(shakeAnim, { toValue: 2, duration: 60, useNativeDriver: false }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: false }),
          ]),
          Animated.timing(textFadeAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
        ]),
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.4, duration: 500, useNativeDriver: false }),
          Animated.timing(scaleAnim, { toValue: 1.2, duration: 500, useNativeDriver: false }),
          Animated.timing(scaleAnim, { toValue: 1.35, duration: 500, useNativeDriver: false }),
          Animated.timing(scaleAnim, { toValue: 1.25, duration: 500, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 0, duration: 800, useNativeDriver: false }),
          Animated.timing(overlayAnim, { toValue: 0, duration: 800, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0, duration: 700, useNativeDriver: false }),
          Animated.timing(scaleAnim, { toValue: 3, duration: 800, useNativeDriver: false }),
          Animated.timing(textFadeAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
        ]),
      ]).start(cleanup);
    }
  }, [SCREEN_HEIGHT]);

  useEffect(() => {
    const mockGiftPool = [
      { name: 'Rose', cost: 1, emoji: '\uD83C\uDF39' },
      { name: 'Heart', cost: 5, emoji: '\u2764\uFE0F' },
      { name: 'Star', cost: 10, emoji: '\u2B50' },
      { name: 'Fire', cost: 25, emoji: '\uD83D\uDD25' },
      { name: 'Diamond', cost: 50, emoji: '\uD83D\uDC8E' },
      { name: 'Crown', cost: 100, emoji: '\uD83D\uDC51' },
      { name: 'Rocket', cost: 200, emoji: '\uD83D\uDE80' },
      { name: 'Sports Car', cost: 300, emoji: '\uD83C\uDFCE\uFE0F' },
    ];
    const showGift = () => {
      const gift = getRandomItem(mockGiftPool);
      const sender = getRandomItem(MOCK_USERNAMES);
      const tier = getGiftTier(gift.cost);
      launchGiftAnimation(gift.emoji, gift.name, tier, sender);
      setMessages((prev) => [
        ...prev.slice(-49),
        { id: `gift-msg-${Date.now()}-${Math.random()}`, username: sender, message: `sent a ${gift.name} ${gift.emoji}`, role: 'regular', isGift: true, isSystem: false, isJoin: false, giftTier: tier, giftEmoji: gift.emoji },
      ]);
    };
    const interval = setInterval(showGift, 6000 + Math.random() * 4000);
    return () => clearInterval(interval);
  }, []);

  // ---- Floating icons ----
  useEffect(() => {
    const spawnFloat = () => {
      const id = `float-${floatIdRef.current++}`;
      const icon = getRandomItem(FLOATING_ICONS);
      const startX = 20 + Math.random() * 60;
      setFloatingIcons((prev) => [...prev.slice(-8), { id, icon, startX }]);
    };
    const interval = setInterval(spawnFloat, 2000 + Math.random() * 1500);
    return () => clearInterval(interval);
  }, []);

  // ---- Tap-to-Heart handler ----
  const handleVideoTap = useCallback((e) => {
    const { locationX, locationY } = e.nativeEvent || {};
    const x = locationX ?? e.nativeEvent?.pageX ?? SCREEN_WIDTH / 2;
    const y = locationY ?? e.nativeEvent?.pageY ?? SCREEN_HEIGHT / 2;
    const color = getRandomItem(NEON_HEART_COLORS);
    const id = `tap-${tapHeartIdRef.current++}`;
    setTapHearts((prev) => [...prev.slice(-15), { id, x, y, color }]);
    // Clean up after animation
    setTimeout(() => {
      setTapHearts((prev) => prev.filter(h => h.id !== id));
    }, 1600);
  }, [SCREEN_WIDTH, SCREEN_HEIGHT]);

  // ---- Chat send ----
  const handleChatSend = useCallback((text) => {
    setMessages((prev) => [
      ...prev.slice(-49),
      { id: `user-${Date.now()}`, username: user?.username || 'You', message: text, role: 'elite', isGift: false, isSystem: false, isJoin: false, giftTier: null },
    ]);
  }, [user?.username]);

  // ---- Send a real gift via API ----
  const handleSendGift = async (gift) => {
    if (sendingGiftRef.current) return;
    sendingGiftRef.current = true;
    setSendingGift(true);

    try {
      const { data } = await api.post('/gifts/send', {
        giftId: gift.id,
        receiverId: hostId || 1,
        livestreamId: streamId || 1,
        quantity: 1,
      });
      updateUser({ coinBalance: data.remainingBalance });
    } catch (err) {
      // Silently handle - still show gift animation for demo
    }

    const emoji = GIFT_ICON_MAP[gift.name.toLowerCase()] || '\uD83C\uDF81';
    const tier = getGiftTier(gift.coin_cost);
    const senderName = user?.username || 'You';

    launchGiftAnimation(emoji, gift.name, tier, senderName);

    const commentText = giftMessage.trim() || `sent a ${gift.name} ${emoji}`;
    setMessages((prev) => [
      ...prev.slice(-49),
      {
        id: `user-gift-msg-${Date.now()}`,
        username: user?.username || 'You',
        message: commentText,
        role: 'elite',
        isGift: true,
        isSystem: false,
        isJoin: false,
        giftTier: tier,
        giftEmoji: emoji,
        giftName: gift.name,
        giftCost: gift.coin_cost,
      },
    ]);

    sendingGiftRef.current = false;
    setSendingGift(false);
    setGiftMessage('');
    setSelectedGift(null);
  };

  // ---- Chat scroll handling ----
  const handleChatScroll = useCallback((e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const isAtBottom = contentOffset.y >= contentSize.height - layoutMeasurement.height - 40;
    setIsAutoScroll(isAtBottom);
    if (!isAtBottom) {
      setHasNewMessages(true);
    } else {
      setHasNewMessages(false);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    chatListRef.current?.scrollToEnd({ animated: true });
    setIsAutoScroll(true);
    setHasNewMessages(false);
  }, []);

  // ---- Chat message renderer ----
  const renderChatMessage = useCallback((item) => {
    // Join notification
    if (item.isJoin) {
      return (
        <View style={styles.joinMessage}>
          <Text style={styles.joinText}>
            <Text style={styles.joinUsername}>{item.username}</Text> joined
          </Text>
        </View>
      );
    }

    // System message
    if (item.isSystem) {
      return (
        <View style={styles.systemMessage}>
          <Ionicons name="heart" size={12} color="#00FFFF" />
          <Text style={styles.systemText}>{item.message}</Text>
        </View>
      );
    }

    const isVip = item.role === 'vip';
    const isElite = item.role === 'elite';
    const tier = item.giftTier ? GIFT_TIERS[item.giftTier] : null;

    // Gift message with purple tint
    if (tier) {
      return (
        <View style={[
          styles.chatMessage,
          {
            backgroundColor: item.giftTier === 4 ? GIFT_TIERS[4].bgFallback : 'rgba(128,0,255,0.3)',
            borderWidth: item.giftTier >= 3 ? 1.5 : 1,
            borderColor: tier.borderColor,
          },
          item.giftTier === 4 && styles.legendaryMessage,
        ]}>
          <View style={styles.giftFlairHeader}>
            <Text style={{ fontSize: 14 }}>{item.giftEmoji || '\uD83C\uDF81'}</Text>
            <Text style={[styles.giftFlairLabel, { color: tier.labelColor }]}>
              {tier.label}
            </Text>
            {item.giftCost && (
              <View style={styles.giftCostBadge}>
                <Ionicons name="diamond" size={8} color={colors.tertiaryDim} />
                <Text style={styles.giftCostText}>{item.giftCost}</Text>
              </View>
            )}
          </View>
          <View style={styles.chatContentRow}>
            <Text style={[styles.chatUsername, { color: tier.labelColor }, TEXT_SHADOW]}>
              {item.username}
            </Text>
            <Text style={[styles.chatText, TEXT_SHADOW]}>
              {item.message}
            </Text>
          </View>
        </View>
      );
    }

    // Regular / VIP / Elite message
    const usernameColor = isVip ? '#FF1493' : isElite ? '#00FFFF' : '#E0E0E0';

    return (
      <View style={styles.chatMessage}>
        <View style={styles.chatContentRow}>
          <Text style={[styles.chatUsername, { color: usernameColor }, TEXT_SHADOW]}>
            {item.username}
          </Text>
          <Text style={[styles.chatText, TEXT_SHADOW]}>
            {item.message}
          </Text>
        </View>
      </View>
    );
  }, []);

  // ---- Social proof line ----
  const giftSocialProof = availableGifts.length > 0
    ? `${Math.floor(Math.random() * 50 + 20)} viewers sent ${availableGifts[0]?.name || 'Rose'} today`
    : '';

  // ---- Determine rendering mode ----
  const useLiveKit = livekitToken && livekitUrl;

  const backgroundContent = useLiveKit ? null : (
    <VideoView
      player={bgPlayer}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
      pointerEvents="none"
    />
  );

  // ===========================================================================
  // Overlay Content
  // ===========================================================================
  const overlayContent = (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* ---- Top gradient overlay ---- */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent']}
        style={styles.gradientTop}
        pointerEvents="none"
      />

      {/* ---- Bottom gradient overlay ---- */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        locations={[0.4, 1]}
        style={styles.gradientBottom}
        pointerEvents="none"
      />

      {/* ---- Tap-to-Heart Zone ---- */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={handleVideoTap}
      />

      {/* Tap hearts */}
      {tapHearts.map(h => (
        <TapHeart key={h.id} x={h.x} y={h.y} color={h.color} screenHeight={SCREEN_HEIGHT} />
      ))}

      {/* ---- Buffering spinner ---- */}
      {buffering && (
        <View style={styles.bufferingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}

      {/* ---- Stream End Screen ---- */}
      {streamEnded && (
        <StreamEndOverlay hostName={hostName} navigation={navigation} screenWidth={SCREEN_WIDTH} />
      )}

      {/* ==== TOP HEADER ==== */}
      <View style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.headerRow}>
          {/* Streamer Info Pill */}
          <View style={styles.streamerPill}>
            <View style={styles.avatarContainer}>
              <PulsingNeonRing />
              <View style={styles.hostAvatar}>
                <Ionicons name="person" size={14} color="#fff" />
              </View>
            </View>
            <View style={styles.hostMeta}>
              <Text style={[styles.hostName, TEXT_SHADOW]} numberOfLines={1}>{hostName}</Text>
              <Text style={[styles.followerCount, TEXT_SHADOW]}>{abbreviateCount(followerCount)}</Text>
            </View>
            <TouchableOpacity style={styles.followIconBtn}>
              <Ionicons name="add" size={18} color="#FF1493" />
            </TouchableOpacity>
          </View>

          {/* LIVE Badge */}
          <View style={styles.liveBadge}>
            <PulsingDot />
            <Text style={styles.liveText}>LIVE</Text>
          </View>

          {/* Viewer Count */}
          <View style={styles.viewerBadge}>
            <Ionicons name="eye" size={13} color="#fff" />
            <Text style={[styles.viewerCount, TEXT_SHADOW]}>{abbreviateCount(viewerCount)}</Text>
          </View>

          {/* Close Button */}
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ---- Top Gifter Avatars Row ---- */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topGiftersRow} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8 }}>
          {MOCK_TOP_GIFTERS.map((g, i) => (
            <View key={g.id} style={styles.topGifterItem}>
              <View style={[styles.topGifterAvatar, { borderColor: g.borderColor }]}>
                <Text style={styles.topGifterInitial}>{g.initial}</Text>
              </View>
              {i < 3 && (
                <View style={[styles.topGifterRankBadge, { backgroundColor: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : '#CD7F32' }]}>
                  <Text style={styles.topGifterRankText}>{i + 1}</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* ---- Floating Icons (ambient) ---- */}
      <View style={styles.floatingArea} pointerEvents="none">
        {floatingIcons.map((f) => (
          <FloatingIcon key={f.id} icon={f.icon} startX={f.startX} delay={0} screenHeight={SCREEN_HEIGHT} />
        ))}
      </View>

      {/* ==== RIGHT SIDE ACTIONS ==== */}
      <View style={styles.rightActions} pointerEvents="box-none">
        <TouchableOpacity style={styles.actionCircle}>
          <Ionicons name="share-social" size={20} color="#fff" />
        </TouchableOpacity>
        <GiftButtonGlow onPress={() => setShowGiftPanel(true)} />
      </View>

      {/* ==== BOTTOM SECTION: Chat + Input ==== */}
      <View style={styles.bottomSection} pointerEvents="box-none">
        {/* Chat Overlay */}
        <View style={[styles.chatContainer, { width: SCREEN_WIDTH * 0.45, height: SCREEN_HEIGHT * 0.3 }]}>
          <ScrollView
            ref={chatListRef}
            style={styles.chatList}
            showsVerticalScrollIndicator={false}
            onScroll={handleChatScroll}
            scrollEventThrottle={100}
            onContentSizeChange={() => {
              if (isAutoScroll) {
                chatListRef.current?.scrollToEnd({ animated: true });
              }
            }}
          >
            {messages.map((item) => (
              <View key={item.id}>{renderChatMessage(item)}</View>
            ))}
          </ScrollView>

          {/* New Messages Button */}
          {hasNewMessages && !isAutoScroll && (
            <TouchableOpacity style={styles.newMessagesBtn} onPress={scrollToBottom}>
              <Ionicons name="chevron-down" size={14} color="#fff" />
              <Text style={styles.newMessagesBtnText}>New messages</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Chat Input */}
        <ChatInput onSend={handleChatSend} screenWidth={SCREEN_WIDTH} />
      </View>

      {/* ==== TIERED GIFT ANIMATIONS ==== */}
      {giftPopups.map(popup => {
        const t = popup.tier || 1;
        const tierColor = t >= 4 ? '#ffe792' : t >= 3 ? '#00FFFF' : t >= 2 ? '#FF00FF' : '#FF1493';
        const emojiSize = t >= 4 ? 120 : t >= 3 ? 96 : t >= 2 ? 72 : 48;
        const showOverlay = t >= 3;
        const showGlow = t >= 2;
        const labelText = t >= 4 ? 'LEGENDARY GIFT' : t >= 3 ? 'EPIC GIFT' : '';

        return (
          <View key={popup.id} pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}>
            {showOverlay && (
              <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', opacity: popup.overlayAnim }} />
            )}
            <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', transform: [{ translateX: popup.shakeAnim }] }}>
              {showGlow && (
                <Animated.View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: tierColor, opacity: popup.glowAnim }} />
              )}
              <Animated.View style={{ opacity: popup.fadeAnim, transform: [{ scale: popup.scaleAnim }, { translateY: popup.slideAnim }] }}>
                <Text style={{ fontSize: emojiSize }}>{popup.emoji}</Text>
              </Animated.View>
              <Animated.View style={{ opacity: popup.textFadeAnim, marginTop: 12, alignItems: 'center' }}>
                {labelText !== '' && (
                  <Text style={{ color: tierColor, fontSize: 11, fontWeight: '900', letterSpacing: 3, marginBottom: 6, ...TEXT_SHADOW }}>{labelText}</Text>
                )}
                <View style={{ backgroundColor: 'rgba(18,18,18,0.85)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 8, borderWidth: showOverlay ? 1 : 0, borderColor: tierColor + '55' }}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center', ...TEXT_SHADOW }}>{popup.sender}</Text>
                  <Text style={{ color: tierColor, fontSize: 18, fontWeight: '900', textAlign: 'center', ...TEXT_SHADOW }}>sent {popup.name}</Text>
                </View>
              </Animated.View>
            </Animated.View>
          </View>
        );
      })}

      {/* ==== GIFT PANEL (bottom sheet) ==== */}
      {showGiftPanel && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={() => setShowGiftPanel(false)} />
          <View style={styles.giftPanel}>
            {/* Drag Handle */}
            <View style={styles.dragHandleContainer}>
              <View style={styles.dragHandle} />
            </View>

            {/* Header: Category Tabs + Coin Balance */}
            <View style={styles.giftPanelHeader}>
              <View style={styles.giftCategoryTabs}>
                {GIFT_CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setGiftCategory(cat)}
                    style={[styles.giftCategoryTab, giftCategory === cat && styles.giftCategoryTabActive]}
                  >
                    <Text style={[styles.giftCategoryTabText, giftCategory === cat && styles.giftCategoryTabTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.coinBalancePill}>
                <Ionicons name="diamond" size={14} color="#FFD700" />
                <Text style={styles.coinBalanceText}>{user?.coinBalance || 0}</Text>
                <TouchableOpacity style={styles.rechargeBtn}>
                  <Ionicons name="add" size={14} color="#FFD700" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Gift Grid */}
            <ScrollView style={styles.giftScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.giftGrid}>
                {availableGifts.map((gift) => {
                  const emoji = GIFT_ICON_MAP[gift.name.toLowerCase()] || '\uD83C\uDF81';
                  const tier = getGiftTier(gift.coin_cost);
                  const tierStyle = GIFT_TIERS[tier];
                  const isSelected = selectedGift?.id === gift.id;
                  const canAfford = (user?.coinBalance || 0) >= gift.coin_cost;
                  return (
                    <TouchableOpacity
                      key={gift.id}
                      style={[
                        styles.giftGridItem,
                        isSelected && {
                          borderColor: '#FF1493',
                          borderWidth: 2,
                          transform: [{ scale: 1.05 }],
                        },
                        !canAfford && { opacity: 0.5 },
                      ]}
                      onPress={() => setSelectedGift(gift)}
                    >
                      <Text style={{ fontSize: 36 }}>{emoji}</Text>
                      <Text style={styles.giftGridName}>{gift.name}</Text>
                      <View style={styles.giftGridCost}>
                        <Ionicons name="diamond" size={10} color="#FFD700" />
                        <Text style={styles.giftGridCostText}>{gift.coin_cost}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Social Proof */}
            {giftSocialProof !== '' && (
              <Text style={styles.socialProofText}>{giftSocialProof}</Text>
            )}

            {/* Send Gift Button */}
            <TouchableOpacity
              style={[
                styles.sendGiftButton,
                !selectedGift && { opacity: 0.4 },
                sendingGift && { opacity: 0.6 },
              ]}
              onPress={() => selectedGift && handleSendGift(selectedGift)}
              disabled={!selectedGift || sendingGift}
            >
              <Text style={styles.sendGiftText}>
                {selectedGift ? `Send ${selectedGift.name}` : 'Select a Gift'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  // ===========================================================================
  // Render
  // ===========================================================================
  if (useLiveKit) {
    return (
      <LiveKitViewer
        url={livekitUrl}
        token={livekitToken}
        style={styles.container}
        onConnected={() => console.log('[LiveKit] Viewer connected')}
        onDisconnected={() => console.log('[LiveKit] Viewer disconnected')}
        onStreamEnded={() => setStreamEnded(true)}
      >
        {overlayContent}
      </LiveKitViewer>
    );
  }

  return (
    <View style={styles.container}>
      {backgroundContent}
      {overlayContent}
    </View>
  );
}

// ===========================================================================
// Styles
// ===========================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // ---- Gradient overlays ----
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '25%',
    zIndex: 1,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    zIndex: 1,
  },

  // ---- Buffering ----
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },

  // ---- Top Header ----
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  streamerPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingRight: 8,
    paddingLeft: 4,
    paddingVertical: 4,
    gap: 8,
    maxWidth: 200,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hostAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hostMeta: {
    flex: 1,
  },
  hostName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  followerCount: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },
  followIconBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,20,147,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ---- LIVE Badge ----
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E53935',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#fff',
  },
  liveText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // ---- Viewer Count ----
  viewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewerCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  // ---- Close Button ----
  closeBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ---- Top Gifters Row ----
  topGiftersRow: {
    marginTop: 8,
    maxHeight: 48,
  },
  topGifterItem: {
    position: 'relative',
  },
  topGifterAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topGifterInitial: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  topGifterRankBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topGifterRankText: {
    color: '#000',
    fontSize: 8,
    fontWeight: '900',
  },

  // ---- Floating Icons Area ----
  floatingArea: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 120,
    height: '50%',
  },

  // ---- Right Side Actions ----
  rightActions: {
    position: 'absolute',
    right: spacing.md,
    bottom: 120,
    alignItems: 'center',
    gap: spacing.md,
    zIndex: 20,
  },
  actionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ---- Bottom Section ----
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },

  // ---- Chat Overlay ----
  chatContainer: {
    marginLeft: spacing.md,
    marginBottom: 8,
  },
  chatList: {
    flex: 1,
  },

  // ---- Chat Messages ----
  chatMessage: {
    marginBottom: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  chatContentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  chatUsername: {
    fontSize: 14,
    fontWeight: '700',
  },
  chatText: {
    color: '#E0E0E0',
    fontSize: 14,
  },

  // ---- Join Messages ----
  joinMessage: {
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  joinText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontStyle: 'italic',
    ...TEXT_SHADOW,
  },
  joinUsername: {
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },

  // ---- System Messages ----
  systemMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  systemText: {
    color: '#00FFFF',
    fontSize: 12,
    fontWeight: '500',
    ...TEXT_SHADOW,
  },

  // ---- Gift Flair on Chat ----
  giftFlairHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  giftFlairLabel: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  giftCostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
  },
  giftCostText: {
    color: colors.tertiaryDim,
    fontSize: 9,
    fontWeight: '700',
  },
  legendaryMessage: {
    borderWidth: 2,
    ...Platform.select({
      ios: { shadowColor: '#ffe792', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8 },
      android: { elevation: 6 },
      web: { boxShadow: '0 0 12px rgba(255, 231, 146, 0.4)' },
    }),
  },

  // ---- New Messages Button ----
  newMessagesBtn: {
    position: 'absolute',
    bottom: 4,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  newMessagesBtnText: {
    color: '#00FFFF',
    fontSize: 11,
    fontWeight: '600',
  },

  // ---- Gift Panel ----
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 50,
  },
  modalDismiss: {
    flex: 1,
  },
  giftPanel: {
    backgroundColor: 'rgba(18,18,18,0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '45%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  giftPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: 8,
  },
  giftCategoryTabs: {
    flexDirection: 'row',
    gap: 4,
  },
  giftCategoryTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  giftCategoryTabActive: {
    backgroundColor: '#FF1493',
  },
  giftCategoryTabText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  giftCategoryTabTextActive: {
    color: '#fff',
  },
  coinBalancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  coinBalanceText: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '700',
  },
  rechargeBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,215,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  giftScrollView: {
    maxHeight: 220,
  },
  giftGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.sm,
  },
  giftGridItem: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: spacing.xs,
  },
  giftGridName: {
    color: '#E0E0E0',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  giftGridCost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  giftGridCostText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  socialProofText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 6,
  },
  sendGiftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF1493',
    marginHorizontal: spacing.md,
    paddingVertical: 14,
    borderRadius: 28,
    marginTop: 4,
    ...Platform.select({
      web: { boxShadow: '0 0 16px rgba(255,20,147,0.4)' },
      default: { shadowColor: '#FF1493', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
    }),
  },
  sendGiftText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
