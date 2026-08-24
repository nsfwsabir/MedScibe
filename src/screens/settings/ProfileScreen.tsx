/* eslint-disable */
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { Card } from '../../components/ui/Card';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../features/auth/authStore';
import { useProfileStore } from '../../features/profile/profileStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { profile, setProfile } = useProfileStore();
  const [displayName, setDisplayName] = useState(profile.displayName ?? '');
  const [specialty, setSpecialty] = useState(profile.specialty ?? '');
  const [clinicName, setClinicName] = useState(profile.clinicName ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync form when profile loads from storage
  useEffect(() => {
    setDisplayName(profile.displayName ?? '');
    setSpecialty(profile.specialty ?? '');
    setClinicName(profile.clinicName ?? '');
    setPhone(profile.phone ?? '');
  }, [profile.displayName, profile.specialty, profile.clinicName, profile.phone]);

  const email = user?.email ?? '';
  const derivedName = email.split('@')[0]?.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Doctor';
  const shownName = displayName.trim() || derivedName;
  const initial = shownName[0]?.toUpperCase() ?? 'D';

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await setProfile({ displayName, specialty, clinicName, phone });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={[typography.title, { color: colors.text }]}>←</Text>
        </Pressable>
        <Text style={[typography.title, { color: colors.text }]}>Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.avatarCard}>
          <View style={styles.avatar}>
            <Text style={[typography.heading, { color: colors.text }]}>{initial}</Text>
          </View>
          <Text style={[typography.heading, { color: colors.text }]}>{shownName}</Text>
          <Text style={[typography.body, { color: colors.muted }]}>{email}</Text>
        </Card>

        <Card style={styles.formCard}>
          <Text style={[typography.bodySemibold, { color: colors.text }]}>Basic Information</Text>
          <Text style={[typography.caption, { color: colors.muted }]}>
            This name is used for greetings and note headers. Other details are optional.
          </Text>

          <TextInput label="DISPLAY NAME" placeholder={derivedName} value={displayName} onChangeText={setDisplayName} autoCapitalize="words" />
          <TextInput label="SPECIALTY" placeholder="e.g. General Physician" value={specialty} onChangeText={setSpecialty} autoCapitalize="words" />
          <TextInput label="CLINIC / HOSPITAL" placeholder="e.g. Family Health Clinic" value={clinicName} onChangeText={setClinicName} />
          <TextInput label="PHONE" placeholder="+91 90000 00000" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TextInput label="EMAIL" value={email} editable={false} style={{ opacity: 0.6 }} />

          {saved ? <Text style={[typography.caption, { color: colors.success }]}>Profile saved</Text> : null}
          <Button label={saving ? 'Saving…' : 'Save Changes'} onPress={handleSave} disabled={saving} />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  avatarCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    gap: spacing.md,
  },
});
