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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../../utils/theme';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
// Animation engine completely disabled — using simple inline animations instead

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

const FLOATING_ICONS = ['\u{2764}\u{FE0F}', '\u{1F48E}', '\u{1FA99}', '\u{2B50}', '\u{1F49C}', '\u{1F496}'];

// Gift tiers based on cost — determines comment flair
const GIFT_TIERS = {
  // tier 1: cost 1-10 (Rose, Heart, Star) — subtle flair
  1: {
    bg: 'rgba(170, 48, 250, 0.15)',
    borderColor: 'rgba(170, 48, 250, 0.3)',
    labelColor: '#b388ff',
    label: 'Gift',
  },
  // tier 2: cost 25-100 (Fire, Diamond, Crown) — medium flair
  2: {
    bg: 'rgba(211, 148, 255, 0.2)',
    borderColor: 'rgba(211, 148, 255, 0.5)',
    labelColor: '#d394ff',
    label: 'Super Gift',
  },
  // tier 3: cost 200-500 (Rocket, Castle) — flashy flair
  3: {
    bg: 'rgba(0, 238, 252, 0.15)',
    borderColor: 'rgba(0, 238, 252, 0.4)',
    labelColor: '#00eefc',
    label: 'Ultra Gift',
  },
  // tier 4: cost 1000+ (Lion, Universe) — legendary flair
  4: {
    bg: 'linear-gradient', // handled specially
    borderColor: '#ffe792',
    labelColor: '#ffe792',
    label: 'LEGENDARY',
    bgFallback: 'rgba(255, 215, 9, 0.2)',
  },
};

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

// Floating heart/diamond animation component
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

// Pulsing ring for avatar
function PulsingRing() {
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
    <Animated.View style={[styles.avatarPulseRing, { opacity: opacityAnim, transform: [{ scale: pulseAnim }] }]} />
  );
}

// Pulsing dot for LIVE badge
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

// Chat input — renders inline, reads DOM value directly on web
function ChatInputWeb({ onSend }) {
  const domRef = useRef(null);

  return (
    <View style={chatInputStyles.actionBar}>
      <View style={chatInputStyles.chatInputContainer}>
        <Ionicons name="happy-outline" size={20} color={colors.textMuted} style={{ marginLeft: 12 }} />
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
              color: colors.text,
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
            style={chatInputStyles.chatInput}
            placeholder="Say something..."
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={(e) => {
              const val = e.nativeEvent.text?.trim();
              if (val) onSend(val);
            }}
            returnKeyType="send"
            blurOnSubmit={false}
          />
        )}
        <Ionicons name="at" size={20} color={colors.textMuted} style={{ marginRight: 12 }} />
      </View>
      <TouchableOpacity style={chatInputStyles.boltButton} onPress={() => {
        if (Platform.OS === 'web' && domRef.current) {
          const val = domRef.current.value?.trim();
          if (val) { onSend(val); domRef.current.value = ''; }
        }
      }}>
        <Ionicons name="flash" size={26} color={colors.onTertiary} />
      </TouchableOpacity>
    </View>
  );
}

const chatInputStyles = StyleSheet.create({
  actionBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  chatInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(21, 6, 41, 0.85)', borderRadius: 28, borderWidth: 1, borderColor: colors.border },
  chatInput: { flex: 1, paddingHorizontal: spacing.sm, paddingVertical: Platform.OS === 'ios' ? 12 : 10, color: colors.text, fontSize: fontSize.md },
  boltButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.tertiaryContainer, justifyContent: 'center', alignItems: 'center', shadowColor: colors.tertiaryDim, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
});

// Gift icons mapping
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

const GIFT_EMOJIS = [
  { emoji: '\u{1F339}', name: 'Rose' },
  { emoji: '\u{2764}\u{FE0F}', name: 'Heart' },
  { emoji: '\u{2B50}', name: 'Star' },
  { emoji: '\u{1F451}', name: 'Crown' },
  { emoji: '\u{1F48E}', name: 'Diamond' },
  { emoji: '\u{1F680}', name: 'Rocket' },
];

export default function LiveStreamScreen({ route, navigation }) {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const streamId = route?.params?.streamId;
  const hostName = route?.params?.hostName || 'DJ_Sparkle';
  const { user, updateUser } = useAuthStore();

  const [messages, setMessages] = useState([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [floatingIcons, setFloatingIcons] = useState([]);
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [availableGifts, setAvailableGifts] = useState([]);
  const [selectedGift, setSelectedGift] = useState(null);
  const [sendingGift, setSendingGift] = useState(false);
  const sendingGiftRef = useRef(false);
  const [giftMessage, setGiftMessage] = useState('');
  const [giftPopups, setGiftPopups] = useState([]);
  const giftPopupIdRef = useRef(0);

  // Tiered gift animation launcher — all inline, no external modules
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
      // CHEAP: Small popup, quick fade
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
      // MEDIUM: Bigger entrance with glow
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
      // EPIC: Full screen takeover — dim, icon flies up, burst, shake, text
      Animated.sequence([
        // Dim screen
        Animated.timing(overlayAnim, { toValue: 0.5, duration: 200, useNativeDriver: false }),
        // Icon flies from bottom to center
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
          Animated.spring(slideAnim, { toValue: 0, friction: 6, tension: 60, useNativeDriver: false }),
        ]),
        // Burst scale + glow
        Animated.parallel([
          Animated.spring(scaleAnim, { toValue: 1.5, friction: 3, tension: 200, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
        ]),
        // Settle + shake
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
        // Hold
        Animated.delay(2000),
        // Fade out
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
          Animated.timing(overlayAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
          Animated.timing(scaleAnim, { toValue: 2, duration: 600, useNativeDriver: false }),
          Animated.timing(textFadeAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
        ]),
      ]).start(cleanup);
    } else {
      // LEGENDARY (tier 4): Maximum spectacle — longer, bigger, more dramatic
      Animated.sequence([
        // Heavy dim with color tint
        Animated.timing(overlayAnim, { toValue: 0.65, duration: 300, useNativeDriver: false }),
        // Icon rises slowly from bottom
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
          Animated.timing(slideAnim, { toValue: 0, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        ]),
        // MASSIVE burst
        Animated.parallel([
          Animated.spring(scaleAnim, { toValue: 2, friction: 3, tension: 180, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        ]),
        // Screen flash (glow spikes)
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1.5, duration: 100, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.8, duration: 200, useNativeDriver: false }),
        ]),
        // Heavy shake
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
        // Dramatic hold with gentle pulse
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.4, duration: 500, useNativeDriver: false }),
          Animated.timing(scaleAnim, { toValue: 1.2, duration: 500, useNativeDriver: false }),
          Animated.timing(scaleAnim, { toValue: 1.35, duration: 500, useNativeDriver: false }),
          Animated.timing(scaleAnim, { toValue: 1.25, duration: 500, useNativeDriver: false }),
        ]),
        // Cinematic fade out
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
  const chatListRef = useRef(null);
  const messageIndexRef = useRef(0);
  const floatIdRef = useRef(0);


  // Fetch available gifts from API
  useEffect(() => {
    const fetchGifts = async () => {
      try {
        const { data } = await api.get('/gifts');
        setAvailableGifts(data);
      } catch (err) {
        // Fallback mock gifts if API fails
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

  // Fluctuating viewer count
  useEffect(() => {
    setViewerCount(Math.floor(Math.random() * 400) + 100);
    const interval = setInterval(() => {
      setViewerCount((prev) => Math.max(100, Math.min(500, prev + Math.floor(Math.random() * 40) - 15)));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Auto-populate chat messages
  useEffect(() => {
    const addMessage = () => {
      const username = getRandomItem(MOCK_USERNAMES);
      const message = getRandomItem(MOCK_MESSAGES);
      const role = getRandomRole();
      setMessages((prev) => [
        ...prev.slice(-49),
        { id: `msg-${Date.now()}-${messageIndexRef.current++}`, username, message, role, isGift: false, isSystem: false, giftTier: null },
      ]);
    };
    const addSystemMessage = () => {
      const msgs = ['New follower joined!', 'Someone shared this live!', 'Gift streak activated!', 'Welcome to the party!'];
      setMessages((prev) => [
        ...prev.slice(-49),
        { id: `sys-${Date.now()}`, username: '', message: getRandomItem(msgs), role: 'system', isGift: false, isSystem: true, giftTier: null },
      ]);
    };
    addMessage();
    const msgInterval = setInterval(addMessage, 1000 + Math.random() * 1000);
    const sysInterval = setInterval(addSystemMessage, 8000 + Math.random() * 5000);
    return () => { clearInterval(msgInterval); clearInterval(sysInterval); };
  }, []);

  // Auto gift animations from mock users — triggers the new animation engine
  useEffect(() => {
    const mockGiftPool = [
      { name: 'Rose', cost: 1, emoji: '\u{1F339}' },
      { name: 'Heart', cost: 5, emoji: '\u{2764}\u{FE0F}' },
      { name: 'Star', cost: 10, emoji: '\u{2B50}' },
      { name: 'Fire', cost: 25, emoji: '\u{1F525}' },
      { name: 'Diamond', cost: 50, emoji: '\u{1F48E}' },
      { name: 'Crown', cost: 100, emoji: '\u{1F451}' },
      // Rare silver tier gifts (less frequent)
      { name: 'Rocket', cost: 200, emoji: '\u{1F680}' },
      { name: 'Sports Car', cost: 300, emoji: '\u{1F3CE}\u{FE0F}' },
    ];
    const showGift = () => {
      const gift = getRandomItem(mockGiftPool);
      const sender = getRandomItem(MOCK_USERNAMES);
      const tier = getGiftTier(gift.cost);

      // Launch tiered gift animation
      launchGiftAnimation(gift.emoji, gift.name, tier, sender);

      // Add gift message to chat
      setMessages((prev) => [
        ...prev.slice(-49),
        { id: `gift-msg-${Date.now()}-${Math.random()}`, username: sender, message: `sent a ${gift.name} ${gift.emoji}`, role: 'regular', isGift: true, isSystem: false, giftTier: tier, giftEmoji: gift.emoji },
      ]);
    };
    const interval = setInterval(showGift, 6000 + Math.random() * 4000);
    return () => clearInterval(interval);
  }, []);

  // Floating icons
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

  // Stable callback for chat input
  const handleChatSend = useCallback((text) => {
    setMessages((prev) => [
      ...prev.slice(-49),
      { id: `user-${Date.now()}`, username: user?.username || 'You', message: text, role: 'elite', isGift: false, isSystem: false, giftTier: null },
    ]);
  }, [user?.username]);

  // Send a real gift via API
  const handleSendGift = async (gift) => {
    if (sendingGiftRef.current) return;
    sendingGiftRef.current = true;
    setSendingGift(true);

    try {
      const { data } = await api.post('/gifts/send', {
        giftId: gift.id,
        receiverId: route?.params?.hostId || 1,
        livestreamId: streamId || 1,
        quantity: 1,
      });
      updateUser({ coinBalance: data.remainingBalance });
    } catch (err) {
      // Silently handle - still show gift animation for demo
    }

    // Show gift animation based on tier
    const emoji = GIFT_ICON_MAP[gift.name.toLowerCase()] || '\u{1F381}';
    const tier = getGiftTier(gift.coin_cost);
    const senderName = user?.username || 'You';

    // Launch tiered gift animation
    launchGiftAnimation(emoji, gift.name, tier, senderName);

    // Add gifted comment to chat with flair
    const commentText = giftMessage.trim() || `sent a ${gift.name} ${emoji}`;
    const msgId = `user-gift-msg-${Date.now()}`;
    setMessages((prev) => [
      ...prev.slice(-49),
      {
        id: msgId,
        username: user?.username || 'You',
        message: commentText,
        role: 'elite',
        isGift: true,
        isSystem: false,
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
    // Keep panel open so user can gift again without re-opening
  };

  // Chat message renderer with gift flair
  const renderChatMessage = useCallback(({ item }) => {
    if (item.isSystem) {
      return (
        <View style={styles.systemMessage}>
          <Ionicons name="heart" size={12} color={colors.secondary} />
          <Text style={styles.systemText}>{item.message}</Text>
        </View>
      );
    }

    const isVip = item.role === 'vip';
    const isElite = item.role === 'elite';
    const tier = item.giftTier ? GIFT_TIERS[item.giftTier] : null;

    // Gifted comment with flair
    if (tier) {
      return (
        <View style={[
          styles.chatMessage,
          {
            backgroundColor: item.giftTier === 4 ? GIFT_TIERS[4].bgFallback : tier.bg,
            borderWidth: item.giftTier >= 3 ? 1.5 : 1,
            borderColor: tier.borderColor,
          },
          item.giftTier === 4 && styles.legendaryMessage,
        ]}>
          <View style={styles.giftFlairHeader}>
            <Text style={{ fontSize: 14 }}>{item.giftEmoji || '\u{1F381}'}</Text>
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
            <Text style={[styles.chatUsername, { color: tier.labelColor }]}>
              {item.username}
            </Text>
            <Text style={[styles.chatText, { color: colors.text }]}>
              {item.message}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[
        styles.chatMessage,
        isVip && styles.chatMessageVip,
        isElite && styles.chatMessageElite,
      ]}>
        {isVip ? (
          <View style={styles.chatBadgeRow}>
            <Ionicons name="diamond" size={12} color={colors.tertiary} />
            <Text style={styles.vipLabel}>Level 99 Legend</Text>
          </View>
        ) : isElite ? (
          <View style={styles.chatBadgeRow}>
            <Ionicons name="star" size={12} color={colors.primary} />
            <Text style={styles.eliteLabel}>Elite Member</Text>
          </View>
        ) : null}
        <View style={styles.chatContentRow}>
          {!isVip && !isElite && (
            <View style={styles.chatAvatar}>
              <Text style={styles.chatAvatarText}>{item.username.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={[
            styles.chatUsername,
            isVip && { color: colors.tertiary },
            isElite && { color: colors.primary },
            !isVip && !isElite && { color: colors.secondary },
          ]}>
            {item.username}
          </Text>
          <Text style={[styles.chatText, item.isGift && styles.giftText]}>
            {item.message}
          </Text>
        </View>
      </View>
    );
  }, []);

  return (
    <View style={styles.container}>
      {/* Background video */}
      <Video
        source={{ uri: BACKGROUND_VIDEO_URL }}
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
        resizeMode={ResizeMode.COVER}
        videoStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
        isLooping
        shouldPlay
        isMuted={false}
      />

      {/* Gradient overlays */}
      <View style={styles.gradientOverlayTop} />
      <View style={styles.gradientOverlayBottom} />

      {/* Top header */}
      <SafeAreaView style={styles.topOverlay} edges={['top']}>
        <View style={styles.headerRow}>
          <View style={styles.hostInfo}>
            <View style={styles.avatarContainer}>
              <PulsingRing />
              <View style={styles.hostAvatar}>
                <Ionicons name="person" size={16} color={colors.text} />
              </View>
            </View>
            <View style={styles.hostMeta}>
              <Text style={styles.brandingText}>GrrGrr Live</Text>
              <Text style={styles.hostName}>{hostName}</Text>
            </View>
          </View>
          <View style={styles.liveBadge}>
            <PulsingDot />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <View style={styles.viewerBadge}>
            <Ionicons name="eye" size={14} color={colors.text} />
            <Text style={styles.viewerCount}>{viewerCount}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Floating icons */}
      <View style={styles.floatingArea} pointerEvents="none">
        {floatingIcons.map((f) => (
          <FloatingIcon key={f.id} icon={f.icon} startX={f.startX} delay={0} screenHeight={SCREEN_HEIGHT} />
        ))}
      </View>


      {/* Bottom section - chat + input */}
      <View style={styles.bottomSection} pointerEvents="box-none">
        <ScrollView
          ref={chatListRef}
          style={styles.chatList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((item) => (
            <View key={item.id}>{renderChatMessage({ item })}</View>
          ))}
        </ScrollView>
        <ChatInputWeb onSend={handleChatSend} />
      </View>

      {/* Right side action buttons — rendered AFTER chat so it's above in z-order */}
      <View style={styles.rightActions} pointerEvents="box-none">
        <TouchableOpacity style={styles.actionCircle}>
          <Ionicons name="share-social" size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCircle}>
          <Ionicons name="chatbubble-ellipses" size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.giftActionButton} onPress={() => setShowGiftPanel(true)}>
          <Ionicons name="gift" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tiered gift animations */}
      {giftPopups.map(popup => {
        const t = popup.tier || 1;
        const tierColor = t >= 4 ? '#ffe792' : t >= 3 ? '#00eefc' : t >= 2 ? '#d394ff' : '#b7a3cf';
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
                  <Text style={{ color: tierColor, fontSize: 11, fontWeight: '900', letterSpacing: 3, marginBottom: 6 }}>{labelText}</Text>
                )}
                <View style={{ backgroundColor: 'rgba(21,6,41,0.8)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 8, borderWidth: showOverlay ? 1 : 0, borderColor: tierColor + '55' }}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center' }}>{popup.sender}</Text>
                  <Text style={{ color: tierColor, fontSize: 18, fontWeight: '900', textAlign: 'center' }}>sent {popup.name}</Text>
                </View>
              </Animated.View>
            </Animated.View>
          </View>
        );
      })}


      {/* Gift Panel (inline, no Modal) */}
      {showGiftPanel && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={() => setShowGiftPanel(false)} />
          <View style={styles.giftPanel}>
            <View style={styles.giftPanelHeader}>
              <Text style={styles.giftPanelTitle}>Send a Gift</Text>
              <View style={styles.coinBalancePill}>
                <Ionicons name="diamond" size={14} color={colors.tertiaryDim} />
                <Text style={styles.coinBalanceText}>{user?.coinBalance || 0}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowGiftPanel(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Gift message input */}
            <View style={styles.giftMessageRow}>
              <TextInput
                style={styles.giftMessageInput}
                placeholder="Add a message with your gift..."
                placeholderTextColor={colors.textMuted}
                value={giftMessage}
                onChangeText={setGiftMessage}
              />
            </View>

            {/* Gift grid */}
            <ScrollView style={styles.giftScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.giftGrid}>
                {availableGifts.map((gift) => {
                  const emoji = GIFT_ICON_MAP[gift.name.toLowerCase()] || '\u{1F381}';
                  const tier = getGiftTier(gift.coin_cost);
                  const tierStyle = GIFT_TIERS[tier];
                  const isSelected = selectedGift?.id === gift.id;
                  const canAfford = (user?.coinBalance || 0) >= gift.coin_cost;
                  return (
                    <TouchableOpacity
                      key={gift.id}
                      style={[
                        styles.giftGridItem,
                        isSelected && { borderColor: tierStyle.borderColor, borderWidth: 2, backgroundColor: tierStyle.bg || tierStyle.bgFallback },
                        !canAfford && { opacity: 0.5 },
                      ]}
                      onPress={() => setSelectedGift(gift)}
                    >
                      <Text style={{ fontSize: 28 }}>{emoji}</Text>
                      <Text style={styles.giftGridName}>{gift.name}</Text>
                      <View style={styles.giftGridCost}>
                        <Ionicons name="diamond" size={10} color={colors.tertiaryDim} />
                        <Text style={styles.giftGridCostText}>{gift.coin_cost}</Text>
                      </View>
                      {tier >= 3 && (
                        <View style={[styles.giftTierBadge, { backgroundColor: tierStyle.borderColor }]}>
                          <Text style={styles.giftTierBadgeText}>{tier === 4 ? '\u{1F525}' : '\u{2728}'}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Send button */}
            {selectedGift && (
              <TouchableOpacity
                style={[styles.sendGiftButton, sendingGift && { opacity: 0.6 }]}
                onPress={() => handleSendGift(selectedGift)}
                disabled={sendingGift}
              >
                <Text style={styles.sendGiftEmoji}>
                  {GIFT_ICON_MAP[selectedGift.name.toLowerCase()] || '\u{1F381}'}
                </Text>
                <Text style={styles.sendGiftText}>
                  Send {selectedGift.name} for {selectedGift.coin_cost} coins
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradientOverlayTop: { ...StyleSheet.absoluteFillObject, bottom: '60%', backgroundColor: 'rgba(21, 6, 41, 0.8)' },
  gradientOverlayBottom: { ...StyleSheet.absoluteFillObject, top: '60%', backgroundColor: 'rgba(21, 6, 41, 0.4)' },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  hostInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatarContainer: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  avatarPulseRing: { position: 'absolute', width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.primary },
  hostAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryDim, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: colors.secondary },
  hostMeta: { flex: 1 },
  brandingText: { color: colors.primary, fontSize: fontSize.lg, fontWeight: '800', letterSpacing: 0.5 },
  hostName: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: '500' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E53935', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: fontSize.xs, fontWeight: '900', letterSpacing: 1 },
  viewerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.glass, borderRadius: 14, paddingHorizontal: spacing.sm, paddingVertical: 5, borderWidth: 1, borderColor: colors.glassBorder },
  viewerCount: { color: colors.text, fontSize: fontSize.sm, fontWeight: '700' },
  closeBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.glass, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.glassBorder },
  floatingArea: { position: 'absolute', right: 0, bottom: 0, width: 120, height: '50%' },
  rightActions: { position: 'absolute', right: spacing.md, bottom: 100, alignItems: 'center', gap: spacing.md, zIndex: 20 },
  actionCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.glass, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.glassBorder },
  giftActionButton: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryDim, justifyContent: 'center', alignItems: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  bottomSection: { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '50%', zIndex: 10 },
  chatList: { paddingHorizontal: spacing.md, maxHeight: 280, marginRight: 80 },
  // Chat messages
  chatMessage: { marginBottom: 6, backgroundColor: colors.glass, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start', maxWidth: '90%', borderWidth: 1, borderColor: colors.glassBorder },
  chatMessageVip: { borderLeftWidth: 3, borderLeftColor: colors.tertiary },
  chatMessageElite: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  // Gift flair on comments
  giftFlairHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  giftFlairLabel: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  giftCostBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 'auto' },
  giftCostText: { color: colors.tertiaryDim, fontSize: 9, fontWeight: '700' },
  legendaryMessage: {
    borderWidth: 2,
    ...Platform.select({
      ios: { shadowColor: '#ffe792', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8 },
      android: { elevation: 6 },
      web: { boxShadow: '0 0 12px rgba(255, 231, 146, 0.4)' },
    }),
  },
  chatBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  vipLabel: { color: colors.tertiary, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  eliteLabel: { color: colors.primary, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  chatContentRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chatAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surfaceContainerHighest, justifyContent: 'center', alignItems: 'center' },
  chatAvatarText: { color: colors.textSecondary, fontSize: 9, fontWeight: '700' },
  chatUsername: { fontSize: fontSize.sm, fontWeight: '700' },
  chatText: { color: colors.text, fontSize: fontSize.sm },
  giftText: { color: colors.tertiary },
  systemMessage: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, backgroundColor: 'rgba(0, 105, 112, 0.3)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  systemText: { color: colors.secondary, fontSize: fontSize.xs, fontWeight: '500' },
  footerSafeArea: { backgroundColor: 'transparent' },
  actionBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  chatInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(21, 6, 41, 0.85)', borderRadius: 28, borderWidth: 1, borderColor: colors.border },
  chatInput: { flex: 1, paddingHorizontal: spacing.sm, paddingVertical: Platform.OS === 'ios' ? 12 : 10, color: colors.text, fontSize: fontSize.md },
  boltButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.tertiaryContainer, justifyContent: 'center', alignItems: 'center', shadowColor: colors.tertiaryDim, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  // Gift panel modal
  modalOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50 },
  modalDismiss: { flex: 1 },
  giftPanel: { backgroundColor: colors.surfaceContainer, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '60%', paddingBottom: Platform.OS === 'ios' ? 34 : 16 },
  giftPanelHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm },
  giftPanelTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800', flex: 1 },
  coinBalancePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.glass, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: colors.glassBorder },
  coinBalanceText: { color: colors.tertiaryDim, fontSize: fontSize.sm, fontWeight: '700' },
  giftMessageRow: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  giftMessageInput: { backgroundColor: colors.glass, borderRadius: 16, borderWidth: 1, borderColor: colors.glassBorder, paddingHorizontal: 16, paddingVertical: 10, color: colors.text, fontSize: fontSize.md },
  giftScrollView: { maxHeight: 280 },
  giftGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.sm },
  giftGridItem: { width: '25%', alignItems: 'center', padding: spacing.sm, borderRadius: 16, borderWidth: 1, borderColor: 'transparent', marginBottom: spacing.xs },
  giftGridName: { color: colors.text, fontSize: fontSize.xs, fontWeight: '600', marginTop: 4 },
  giftGridCost: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  giftGridCostText: { color: colors.tertiaryDim, fontSize: fontSize.xs, fontWeight: '600' },
  giftTierBadge: { position: 'absolute', top: 4, right: 4, borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  giftTierBadgeText: { fontSize: 10 },
  sendGiftButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primaryDim, marginHorizontal: spacing.md, paddingVertical: 14, borderRadius: 28, marginTop: spacing.sm },
  sendGiftEmoji: { fontSize: 22 },
  sendGiftText: { color: '#fff', fontSize: fontSize.md, fontWeight: '800' },
  // Epic animation styles
});
