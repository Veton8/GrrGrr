import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../utils/theme';
import { getAnimatedIcon } from './animated-icons';

const GIFT_DESCRIPTIONS = {
  rose: 'A beautiful rose with drifting pollen and a soft pink glow',
  heart: 'A pulsing heart with sparkle particles that pop off the edges',
  star: 'A shining star that radiates golden light',
  fire: 'A flickering flame with rising embers and wobbling layers',
  diamond: 'A brilliant diamond with sweeping light highlights',
  crown: 'A golden crown adorned with jewels and sparkles',
  rocket: 'A hovering rocket with fiery exhaust and smoke trails',
  castle: 'A majestic castle that materializes with magic effects',
  lion: 'A golden lion with a flowing mane and royal sparkles',
  universe: 'A cosmic galaxy with swirling nebula particles',
  'sports car': 'A sleek sports car trailing blazing speed lines',
  'diamond ring': 'A dazzling ring with prismatic light refractions',
  'treasure chest': 'An overflowing chest radiating golden light',
  'golden lion': 'A golden lion with a flowing mane and royal sparkles',
  'crystal palace': 'A crystalline palace shimmering with magic',
  'private jet': 'A soaring jet leaving trails of stardust',
  'galaxy portal': 'A swirling portal into a cosmic dimension',
  dragon: 'A mythical dragon wreathed in flames and smoke',
};

function getTier(coinCost) {
  if (coinCost >= 1000) return { label: 'Legendary', color: colors.tertiary, glow: true };
  if (coinCost >= 200) return { label: 'Epic', color: colors.secondary, glow: false };
  if (coinCost >= 25) return { label: 'Premium', color: colors.primary, glow: false };
  return { label: 'Common', color: colors.textMuted, glow: false };
}

function getDescription(giftName) {
  if (!giftName) return '';
  return GIFT_DESCRIPTIONS[giftName.toLowerCase()] || 'A special animated gift';
}

export default function GiftIconPreview({ visible, gift, onClose, onSend }) {
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.8)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewScale = useRef(new Animated.Value(1)).current;
  const previewOpacity = useRef(new Animated.Value(0)).current;
  const [internalVisible, setInternalVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      handleClose();
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 0.8,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setInternalVisible(false);
      if (onClose) onClose();
    });
  }, [onClose, backdropAnim, cardScale, cardOpacity]);

  const handlePreview = useCallback(() => {
    if (isPreviewPlaying) return;
    setIsPreviewPlaying(true);
    previewScale.setValue(0.5);
    previewOpacity.setValue(1);

    Animated.sequence([
      Animated.parallel([
        Animated.spring(previewScale, {
          toValue: 1.5,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(previewOpacity, {
          toValue: 0,
          duration: 800,
          delay: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setIsPreviewPlaying(false);
      previewScale.setValue(1);
      previewOpacity.setValue(0);
    });
  }, [isPreviewPlaying, previewScale, previewOpacity]);

  const handleSend = useCallback(() => {
    if (onSend && gift) {
      onSend(gift);
    }
    handleClose();
  }, [onSend, gift, handleClose]);

  if (!internalVisible || !gift) return null;

  const giftName = gift.name || '';
  const coinCost = gift.coin_cost || 0;
  const emoji = gift.emoji || '';
  const tier = getTier(coinCost);
  const description = getDescription(giftName);
  const AnimatedIconComponent = getAnimatedIcon(giftName);

  return (
    <View style={styles.overlay} pointerEvents="auto">
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />
      </TouchableWithoutFeedback>

      {/* Card */}
      <Animated.View
        style={[
          styles.card,
          {
            opacity: cardOpacity,
            transform: [{ scale: cardScale }],
          },
        ]}
      >
        {/* Close button */}
        <TouchableOpacity style={styles.closeButton} onPress={handleClose} hitSlop={12}>
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Animated icon section */}
        <View style={styles.iconContainer}>
          {AnimatedIconComponent ? (
            <AnimatedIconComponent size={180} intensity={3} />
          ) : (
            <Text style={styles.fallbackEmoji}>{emoji}</Text>
          )}

          {/* Preview flash overlay */}
          {isPreviewPlaying && (
            <Animated.View
              style={[
                styles.previewFlash,
                {
                  opacity: previewOpacity,
                  transform: [{ scale: previewScale }],
                },
              ]}
            >
              <Text style={styles.previewEmoji}>{emoji}</Text>
            </Animated.View>
          )}
        </View>

        {/* Gift name */}
        <Text style={styles.giftName}>{giftName}</Text>

        {/* Cost row */}
        <View style={styles.costRow}>
          <Ionicons name="diamond" size={16} color={colors.tertiary} />
          <Text style={styles.costText}>{coinCost.toLocaleString()}</Text>
          <Text style={styles.costLabel}>coins</Text>
        </View>

        {/* Tier label */}
        <View style={styles.tierRow}>
          <Text
            style={[
              styles.tierLabel,
              { color: tier.color },
              tier.glow && styles.tierGlow,
            ]}
          >
            {tier.label}
          </Text>
        </View>

        {/* Description */}
        <Text style={styles.description}>{description}</Text>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.previewButton}
            onPress={handlePreview}
            activeOpacity={0.7}
          >
            <Ionicons name="play-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.previewButtonText}>Preview</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSend}
            activeOpacity={0.7}
          >
            <Ionicons name="gift-outline" size={18} color="#fff" />
            <Text style={styles.sendButtonText}>Send Gift</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  card: {
    width: 300,
    borderRadius: 24,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    // Subtle card shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  iconContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  fallbackEmoji: {
    fontSize: 100,
    textAlign: 'center',
  },
  previewFlash: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(211, 148, 255, 0.15)',
    borderRadius: 100,
  },
  previewEmoji: {
    fontSize: 72,
    textAlign: 'center',
  },
  giftName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  costText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.tertiary,
  },
  costLabel: {
    fontSize: 14,
    color: colors.textMuted,
    marginLeft: 2,
  },
  tierRow: {
    marginBottom: 12,
  },
  tierLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  tierGlow: {
    textShadowColor: 'rgba(255, 231, 146, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  previewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(211, 148, 255, 0.08)',
  },
  previewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  sendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primaryDim,
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
