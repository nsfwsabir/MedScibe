import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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

function WaveBars({ levelRef, activeRef }: { levelRef: React.MutableRefObject<number>; activeRef: React.MutableRefObject<boolean> }) {
  const [, setFrame] = useState(0);
  const timeRef = useRef(Math.random() * 10);
  const smoothRef = useRef(0.15);

  useEffect(() => {
    const interval = setInterval(() => {
      const active = activeRef.current;
      // advance phase — faster when recording, slow drift when idle so it's never frozen
      timeRef.current += active ? 0.24 : 0.09;
      const target = levelRef.current;
      const prev = smoothRef.current;
      smoothRef.current = prev + (target - prev) * (active ? 0.35 : 0.08);
      setFrame((f) => f + 1);
    }, 50);
    return () => clearInterval(interval);
  }, [levelRef, activeRef]);

  const t = timeRef.current;
  const smooth = smoothRef.current;
  const active = activeRef.current;

  return (
    <>
      {Array.from({ length: BAR_COUNT }, (_, i) => {
        const baseHeight = 12 + ((i * 7) % 26);
        // two detuned sines per bar → organic, never perfectly in sync
        const w1 = Math.sin(t * 2.1 + i * 0.65);
        const w2 = Math.sin(t * 3.9 + i * 1.27 + 1.0) * 0.5;
        const motion = 0.72 + 0.28 * (w1 * 0.7 + w2 * 0.3);
        const energy = 0.35 + smooth * 1.6;
        const height = Math.max(4, Math.min(64, baseHeight * energy * motion));
        const opacity = active ? 0.6 + smooth * 0.4 : 0.45;
        return <View key={i} style={[styles.bar, { height, opacity }]} />;
      })}
    </>
  );
}

export function Waveform({ metering, active }: { metering?: number; active: boolean }) {
  const level = active ? normalizeMetering(metering) : 0.13;
  const levelRef = useRef(level);
  const activeRef = useRef(active);
  levelRef.current = level;
  activeRef.current = active;

  return (
    <View style={styles.container}>
      <WaveBars levelRef={levelRef} activeRef={activeRef} />
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