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
  // per-bar variance so bars are not uniform
  const variance = 0.62 + 0.38 * Math.sin(index * 0.95 + 1.2);
  const duration = 110 + (index % 4) * 35;

  useEffect(() => {
    const target = Math.max(0.1, Math.min(1, level * variance + (Math.random() * 0.06 - 0.03)));
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
  const [jitter, setJitter] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setJitter(Math.random() * 0.12), 130);
    return () => clearInterval(id);
  }, [active]);

  const base = active ? normalizeMetering(metering) : 0.13;
  // add jitter so even silence has small movement; clamp to 0..1
  const level = active ? Math.max(0.14, Math.min(1, base + jitter)) : 0.13;

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