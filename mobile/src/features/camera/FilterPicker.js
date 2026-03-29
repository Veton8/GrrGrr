import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FILTERS } from './filters';

export default function FilterPicker({ selectedId, onSelect }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {FILTERS.map((filter) => {
        const active = filter.id === selectedId;
        return (
          <TouchableOpacity
            key={filter.id}
            style={[styles.item, active && styles.itemActive]}
            onPress={() => onSelect(filter.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, active && styles.iconCircleActive]}>
              <Ionicons
                name={filter.icon}
                size={20}
                color={active ? '#fff' : 'rgba(255,255,255,0.7)'}
              />
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>
              {filter.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  item: {
    alignItems: 'center',
    width: 64,
    paddingVertical: 6,
  },
  itemActive: {},
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconCircleActive: {
    backgroundColor: 'rgba(170, 48, 250, 0.6)',
    borderColor: '#d394ff',
  },
  label: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 3,
  },
  labelActive: {
    color: '#fff',
  },
});
