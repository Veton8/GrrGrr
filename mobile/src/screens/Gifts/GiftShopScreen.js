import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { getLiveSocket } from '../../services/socket';
import useAuthStore from '../../store/authStore';
import { colors, spacing, fontSize } from '../../utils/theme';

const GIFT_ICONS = {
  rose: 'rose-outline',
  heart: 'heart',
  star: 'star',
  diamond: 'diamond',
  rocket: 'rocket',
  crown: 'trophy',
};

export default function GiftShopScreen({ route, navigation }) {
  const { streamId, receiverId } = route.params || {};
  const [gifts, setGifts] = useState([]);
  const [selectedGift, setSelectedGift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { user, updateUser } = useAuthStore();

  useEffect(() => {
    fetchGifts();
  }, []);

  const fetchGifts = async () => {
    try {
      const { data } = await api.get('/gifts');
      setGifts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const sendGift = async (gift) => {
    if (!streamId || !receiverId) {
      Alert.alert('Info', 'Open the gift shop from a livestream to send gifts!');
      return;
    }
    if ((user?.coinBalance || 0) < gift.coin_cost) {
      Alert.alert('Insufficient Coins', 'You need more coins to send this gift.');
      return;
    }

    setSending(true);
    try {
      const { data } = await api.post('/gifts/send', {
        giftId: gift.id,
        receiverId,
        livestreamId: streamId,
        quantity: 1,
      });

      updateUser({ coinBalance: data.remainingBalance });

      // Emit gift event via socket
      const socket = getLiveSocket();
      if (socket) {
        socket.emit('gift-sent', {
          streamId,
          giftId: gift.id,
          giftName: gift.name,
          giftIcon: gift.icon_url,
          animationUrl: gift.animation_url,
          quantity: 1,
        });
      }

      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not send gift');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gift Shop</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.balanceBar}>
        <Ionicons name="diamond" size={18} color={colors.tertiary} />
        <Text style={styles.balanceText}>{user?.coinBalance || 0} coins</Text>
        <TouchableOpacity style={styles.rechargeButton}>
          <Text style={styles.rechargeText}>Recharge</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={gifts}
          numColumns={4}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.giftGrid}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.giftItem, selectedGift?.id === item.id && styles.giftItemSelected]}
              onPress={() => setSelectedGift(item)}
              onLongPress={() => sendGift(item)}
            >
              <View style={styles.giftIcon}>
                <Ionicons
                  name={GIFT_ICONS[item.name?.toLowerCase()] || 'gift'}
                  size={32}
                  color={selectedGift?.id === item.id ? colors.tertiary : colors.text}
                />
              </View>
              <Text style={styles.giftName}>{item.name}</Text>
              <View style={styles.giftCost}>
                <Ionicons name="diamond" size={10} color={colors.tertiary} />
                <Text style={styles.giftCostText}>{item.coin_cost}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No gifts available</Text>
          }
        />
      )}

      {selectedGift && (
        <View style={styles.sendBar}>
          <Text style={styles.sendInfo}>
            {selectedGift.name} - {selectedGift.coin_cost} coins
          </Text>
          <TouchableOpacity
            style={styles.sendButton}
            onPress={() => sendGift(selectedGift)}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700' },
  balanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 16,
    gap: spacing.sm,
  },
  balanceText: { color: colors.tertiary, fontSize: fontSize.lg, fontWeight: '700', flex: 1 },
  rechargeButton: {
    backgroundColor: colors.primaryDim,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  rechargeText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '700' },
  giftGrid: { padding: spacing.sm },
  giftItem: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    margin: spacing.xs,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerHigh,
  },
  giftItemSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  giftIcon: { marginBottom: spacing.xs },
  giftName: { color: colors.text, fontSize: fontSize.xs, fontWeight: '600' },
  giftCost: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  giftCostText: { color: colors.tertiary, fontSize: fontSize.xs },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl },
  sendBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.glass,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  sendInfo: { color: colors.text, fontSize: fontSize.md },
  sendButton: {
    backgroundColor: colors.primaryDim,
    borderRadius: 20,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  sendButtonText: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },
});
