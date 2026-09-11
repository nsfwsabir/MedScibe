import React, { useEffect } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useNote, useSoftDeleteNote } from '../../features/notes/notesQueries';
import { RichText, plainText } from '../../features/notes/formatting';
import { logAudit } from '../../features/audit/auditApi';
import { markdownToHtml } from '../../features/notes/htmlConvert';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NotesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<NotesStackParamList, 'NoteDetail'>;

export function NoteDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { id } = route.params;
  const { data: note } = useNote(id);
  const softDelete = useSoftDeleteNote();

  useEffect(() => {
    if (note?.id) void logAudit(note.id, 'view');
  }, [note?.id]);

  if (!note) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={[typography.body, { color: colors.muted }]}>Loading report...</Text>
      </View>
    );
  }

  const shortId = note.id.slice(0, 5).toUpperCase();
  const metaBits = [
    note.patient_age != null ? `${note.patient_age}yo` : null,
    note.patient_sex,
    `Visit: ${new Date(note.visit_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`,
  ].filter(Boolean);

  const handleDelete = () => {
    softDelete.mutate(id, {
      onSuccess: () => {
        void logAudit(id, 'soft_delete');
        navigation.goBack();
      },
    });
  };

  const handleShare = async () => {
    if (!note) return;
    const text = plainText(note.note_text ?? note.raw_transcript ?? '');
    const title = note.patient_name ? `Report — ${note.patient_name}` : 'Clinical report';
    try {
      await Share.share({ message: `${title}\n\n${text}`, title });
      void logAudit(note.id, 'export');
    } catch (e) {
      Alert.alert('Share failed', e instanceof Error ? e.message : 'Could not share');
    }
  };

  const handlePdf = async () => {
    if (!note) return;
    const htmlBody = markdownToHtml(note.note_text ?? note.raw_transcript ?? '');
    const title = note.patient_name ?? 'Clinical report';
    const meta = `${note.patient_age != null ? `${note.patient_age}yo` : ''}${note.patient_sex ? ` · ${note.patient_sex}` : ''} · Visit: ${new Date(note.visit_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,Helvetica,Arial,sans-serif;padding:24px;color:#24211E;line-height:1.5}h1{font-size:20px}h2{font-size:17px}.meta{color:#66615D;font-size:13px;margin-bottom:16px}</style></head><body><h2>${title}</h2><div class="meta">${meta}</div><div>${htmlBody}</div></body></html>`;
    try {
      const Print = await import('expo-print');
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      try {
        const Sharing = await import('expo-sharing');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
        } else {
          await Share.share({ url: uri, title });
        }
      } catch {
        await Share.share({ url: uri, title });
      }
      void logAudit(note.id, 'export');
    } catch (e) {
      // Never share raw HTML — fall back to readable plain text
      console.warn('[detail] PDF export failed, falling back to plain-text share', e);
      try {
        const text = plainText(note.note_text ?? note.raw_transcript ?? '');
        await Share.share({ message: `${title}\n${meta}\n\n${text}`, title });
        void logAudit(note.id, 'export');
      } catch (shareErr) {
        Alert.alert('PDF failed', shareErr instanceof Error ? shareErr.message : 'Could not generate PDF');
      }
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={[typography.title, { color: colors.text }]}>←</Text>
        </Pressable>
        <Text style={[typography.title, { color: colors.text }]}>Report</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Badge label={note.status.toUpperCase()} variant={note.status === 'draft' ? 'draft' : 'finalized'} />
          <Text style={[typography.caption, { color: colors.muted }]}>ID: #{shortId}</Text>
        </View>
        <Text style={[typography.heading, { color: colors.text }]}>
          {note.patient_name ?? 'Untitled report'}
        </Text>
        <Text style={[typography.body, { color: colors.muted }]}>{metaBits.join(' · ') || 'No patient details'}</Text>

        <Card style={styles.sectionCard}>
          <RichText
            value={(note.note_text ?? note.raw_transcript ?? '—').replace(/\s+$/, '')}
            baseStyle={{ color: colors.text }}
          />
        </Card>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button label="Edit" variant="primary" onPress={() => navigation.navigate('NoteEdit', { id })} style={styles.actionButton} />
        <Button label="PDF" variant="tinted" onPress={handlePdf} style={styles.actionButton} />
        <Button label="Share" variant="tinted" onPress={handleShare} style={styles.actionButton} />
        <Button label="Delete" variant="danger" onPress={handleDelete} disabled={softDelete.isPending} style={styles.actionButton} />
      </View>
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionCard: {
    padding: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flex: 1,
    paddingHorizontal: 8,
  },
});
