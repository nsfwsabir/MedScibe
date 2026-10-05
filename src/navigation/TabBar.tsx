import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation } from '../theme/tokens';
import { typography } from '../theme/typography';
import { ReportsIcon, SettingsIcon } from '../components/ui/icons';

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {state.routes.map((route) => {
          const realIndex = state.routes.indexOf(route);
          const focused = state.index === realIndex;
          const isNotes = route.name === 'NotesTab';
          const label = isNotes ? 'Reports' : 'Settings';
          const active = focused ? colors.primary : colors.muted;
          const Icon = isNotes ? ReportsIcon : SettingsIcon;
          return (
            <Pressable
              key={route.key}
              style={styles.tab}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
            >
              <Icon size={20} color={active} />
              <Text style={[typography.bodySemibold, { color: active }]}>{label}</Text>
              {focused ? <View style={[styles.tabDot, styles.tabDotActive]} /> : null}
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New Report"
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          onPress={() => navigation.navigate('NotesTab', { screen: 'Recording' } as never)}
        >
          <Text style={styles.fabIcon}>+</Text>
        </Pressable>
      </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    paddingHorizontal: 24,
  },
  tab: {
    alignItems: 'center',
    gap: 4,
    width: 90,
  },
  tabDot: {
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  tabDotActive: {
    backgroundColor: colors.primary,
  },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    top: -22,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.md,
  },
  fabPressed: {
    backgroundColor: colors.primaryHover,
  },
  fabIcon: {
    color: colors.white,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '600',
  },
});
