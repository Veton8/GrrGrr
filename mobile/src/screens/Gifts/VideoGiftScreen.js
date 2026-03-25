import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../../utils/theme';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';

const GIFT_ICON_MAP = {
  rose: '\u{1F339}', heart: '\u{2764}\u{FE0F}', star: '\u{2B50}',
  fire: '\u{1F525}', diamond: '\u{1F48E}', crown: '\u{1F451}',
  rocket: '\u{1F680}', castle: '\u{1F3F0}', lion: '\u{1F981}', universe: '\u{1F30C}',
};

const GIFT_TIERS = {
  1: { bg: 'rgba(170, 48, 250, 0.15)', borderColor: 'rgba(170, 48, 250, 0.3)', labelColor: '#b388ff', label: 'Gift' },
  2: { bg: 'rgba(211, 148, 255, 0.2)', borderColor: 'rgba(211, 148, 255, 0.5)', labelColor: '#d394ff', label: 'Super Gift' },
  3: { bg: 'rgba(0, 238, 252, 0.15)', borderColor: 'rgba(0, 238, 252, 0.4)', labelColor: '#00eefc', label: 'Ultra Gift' },
  4: { bg: 'rgba(255, 215, 9, 0.2)', borderColor: '#ffe792', labelColor: '#ffe792', label: 'LEGENDARY' },
};

function getGiftTier(cost) {
  if (cost >= 1000) return 4;
  if (cost >= 200) return 3;
  if (cost >= 25) return 2;
  return 1;
}

export default function VideoGiftScreen({ route, navigation }) {
  const { videoId, creatorId, creatorName } = route.params;
  const { user, updateUser } = useAuthStore();
  const [gifts, setGifts] = useState([]);
  const [selectedGift, setSelectedGift] = useState(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fetchGifts = async () => {
      try {
        const { data } = await api.get('/gifts');
        setGifts(data);
      } catch {
        setGifts([
          { id: 1, name: 'Rose', coin_cost: 1 }, { id: 2, name: 'Heart', coin_cost: 5 },
          { id: 3, name: 'Star', coin_cost: 10 }, { id: 4, name: 'Fire', coin_cost: 25 },
          { id: 5, name: 'Diamond', coin_cost: 50 }, { id: 6, name: 'Crown', coin_cost: 100 },
          { id: 7, name: 'Rocket', coin_cost: 200 }, { id: 8, name: 'Castle', coin_cost: 500 },
          { id: 9, name: 'Lion', coin_cost: 1000 }, { id: 10, name: 'Universe', coin_cost: 5000 },
        ]);
      }
    };
    fetchGifts();
  }, []);

  const handleSend = async () => {
    if (!selectedGift || sending) return;
    setSending(true);

    try {
      const { data } = await api.post('/gifts/send', {
        giftId: selectedGift.id,
        receiverId: creatorId || 1,
        livestreamId: null,
        quantity: 1,
      });
      updateUser({ coinBalance: data.remainingBalance });
    } catch {
      // Continue with visual even if API fails
    }

    // Post as a gifted comment on the video
    const emoji = GIFT_ICON_MAP[selectedGift.name.toLowerCase()] || '\u{1F381}';
    const commentText = message.trim() || `sent a ${selectedGift.name} ${emoji}`;
    try {
      await api.post(`/feed/${videoId}/comments`, { content: commentText });
    } catch {
      // Silently handle
    }

    setSending(false);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gift to @{creatorName}</Text>
        <View style={styles.coinPill}>
          <Ionicons name="diamond" size={14} color={colors.tertiaryDim} />
          <Text style={styles.coinText}>{user?.coinBalance || 0}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.messageRow}>
        <TextInput
          style={styles.messageInput}
          placeholder="Add a message with your gift..."
          placeholderTextColor={colors.textMuted}
          value={message}
          onChangeText={setMessage}
        />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.giftGrid}>
          {gifts.map((gift) => {
            const emoji = GIFT_ICON_MAP[gift.name.toLowerCase()] || '\u{1F381}';
            const tier = getGiftTier(gift.coin_cost);
            const tierStyle = GIFT_TIERS[tier];
            const isSelected = selectedGift?.id === gift.id;
            const canAfford = (user?.coinBalance || 0) >= gift.coin_cost;

            return (
              <TouchableOpacity
                key={gift.id}
                style={[
                  styles.giftItem,
                  isSelected && { borderColor: tierStyle.borderColor, borderWidth: 2, backgroundColor: tierStyle.bg },
                  !canAfford && { opacity: 0.5 },
                ]}
                onPress={() => setSelectedGift(gift)}
              >
                <Text style={{ fontSize: 28 }}>{emoji}</Text>
                <Text style={styles.giftName}>{gift.name}</Text>
                <View style={styles.giftCost}>
                  <Ionicons name="diamond" size={10} color={colors.tertiaryDim} />
                  <Text style={styles.giftCostText}>{gift.coin_cost}</Text>
                </View>
                {tier >= 3 && (
                  <View style={[styles.tierBadge, { backgroundColor: tierStyle.borderColor }]}>
                    <Text style={{ fontSize: 10 }}>{tier === 4 ? '\u{1F525}' : '\u{2728}'}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Preview of how the gifted comment will look */}
        {selectedGift && (
          <View style={styles.previewSection}>
            <Text style={styles.previewLabel}>Preview</Text>
            <View style={[styles.previewComment, {
              backgroundColor: GIFT_TIERS[getGiftTier(selectedGift.coin_cost)].bg,
              borderColor: GIFT_TIERS[getGiftTier(selectedGift.coin_cost)].borderColor,
              borderWidth: 1.5,
            }]}>
              <View style={styles.previewHeader}>
                <Text style={{ fontSize: 14 }}>{GIFT_ICON_MAP[selectedGift.name.toLowerCase()] || '\u{1F381}'}</Text>
                <Text style={[styles.previewTierLabel, { color: GIFT_TIERS[getGiftTier(selectedGift.coin_cost)].labelColor }]}>
                  {GIFT_TIERS[getGiftTier(selectedGift.coin_cost)].label}
                </Text>
                <View style={styles.previewCostBadge}>
                  <Ionicons name="diamond" size={8} color={colors.tertiaryDim} />
                  <Text style={styles.previewCostText}>{selectedGift.coin_cost}</Text>
                </View>
              </View>
              <Text style={styles.previewText}>
                <Text style={[styles.previewUsername, { color: GIFT_TIERS[getGiftTier(selectedGift.coin_cost)].labelColor }]}>
                  {user?.username || 'You'}
                </Text>
                {'  '}
                {message.trim() || `sent a ${selectedGift.name} ${GIFT_ICON_MAP[selectedGift.name.toLowerCase()] || ''}`}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {selectedGift && (
        <TouchableOpacity
          style={[styles.sendButton, sending && { opacity: 0.6 }]}
          onPress={handleSend}
          disabled={sending}
        >
          <Text style={{ fontSize: 22 }}>{GIFT_ICON_MAP[selectedGift.name.toLowerCase()] || '\u{1F381}'}</Text>
          <Text style={styles.sendButtonText}>
            Send {selectedGift.name} for {selectedGift.coin_cost} coins
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800', flex: 1 },
  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.glass, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: colors.glassBorder },
  coinText: { color: colors.tertiaryDim, fontSize: fontSize.sm, fontWeight: '700' },
  messageRow: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  messageInput: { backgroundColor: colors.glass, borderRadius: 16, borderWidth: 1, borderColor: colors.glassBorder, paddingHorizontal: 16, paddingVertical: 10, color: colors.text, fontSize: fontSize.md },
  scrollView: { flex: 1 },
  giftGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.sm },
  giftItem: { width: '25%', alignItems: 'center', padding: spacing.sm, borderRadius: 16, borderWidth: 1, borderColor: 'transparent', marginBottom: spacing.xs },
  giftName: { color: colors.text, fontSize: fontSize.xs, fontWeight: '600', marginTop: 4 },
  giftCost: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  giftCostText: { color: colors.tertiaryDim, fontSize: fontSize.xs, fontWeight: '600' },
  tierBadge: { position: 'absolute', top: 4, right: 4, borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  previewSection: { paddingHorizontal: spacing.md, marginTop: spacing.md },
  previewLabel: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  previewComment: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  previewTierLabel: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  previewCostBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 'auto' },
  previewCostText: { color: colors.tertiaryDim, fontSize: 9, fontWeight: '700' },
  previewText: { color: colors.text, fontSize: fontSize.sm },
  previewUsername: { fontWeight: '700' },
  sendButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primaryDim, marginHorizontal: spacing.md, marginBottom: Platform.OS === 'ios' ? 0 : spacing.md, paddingVertical: 14, borderRadius: 28 },
  sendButtonText: { color: '#fff', fontSize: fontSize.md, fontWeight: '800' },
});
