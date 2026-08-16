import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../../theme/tokens';

const BAR_COUNT = 17;

function normalizeMetering(metering: number | undefined): number {
  if (metering == null) return 0;
  const clamped = Math.max(0, Math.min(1, metering));
  return 0.12 + clamped * 0.88;
}

function WaveBar({ index, level }: { index: number; level: number }) {
  const [anim] = useState(() => new Animated.Value(0.12));
  const baseHeight = 10 + ((index * 7) % 24);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: level,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [level, anim]);

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          height: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [baseHeight * 0.3, baseHeight * 1.6],
          }),
        },
      ]}
    />
  );
}

export function Waveform({ metering, active }: { metering?: number; active: boolean }) {
  const level = active ? normalizeMetering(metering) : 0.12;

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