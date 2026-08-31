import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../../theme/tokens';

const BAR_COUNT = 17;

function normalizeMetering(metering: number | undefined): number {
  if (metering == null) return 0.15;
  let normalized: number;
  if (metering < 0) {
    // expo-audio metering is dB in range -160 .. 0
    normalized = (metering + 160) / 160;
  } else {
    // already 0 .. 1 (fallback or web)
    normalized = metering;
    if (normalized > 1) normalized = 1;
  }
  normalized = Math.max(0, Math.min(1, normalized));
  // perceptual curve — more sensitive at low volumes
  normalized = Math.pow(normalized, 0.65);
  return 0.14 + normalized * 0.86;
}

function WaveBar({ index, level }: { index: number; level: number }) {
  const [anim] = useState(() => new Animated.Value(0.14));
  const baseHeight = 12 + ((index * 7) % 26);
  // per-bar variance — deterministic so movement is driven purely by `level` (sound), not random
  const variance = 0.58 + 0.42 * Math.sin(index * 0.95 + 1.2);
  // slight stagger so bars don't all snap identically — feels more natural but still sound-driven
  const duration = 90 + (index % 3) * 25;

  useEffect(() => {
    const target = Math.max(0.08, Math.min(1, level * variance));
    Animated.timing(anim, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [level, anim, variance, duration]);

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          height: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [baseHeight * 0.32, baseHeight * 1.75],
          }),
          opacity: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.55, 1],
          }),
        },
      ]}
    />
  );
}

export function Waveform({ metering, active }: { metering?: number; active: boolean }) {
  const level = active ? normalizeMetering(metering) : 0.13;

  return (
    <View style={styles.container}>
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <WaveBar key={i} index={i} level={level} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 90,
  },
  bar: {
    width: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    opacity: 0.85,
  },
});