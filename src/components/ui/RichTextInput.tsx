import React, { useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TextInputProps,
  TextInputScrollEvent,
  View,
} from 'react-native';
import { colors } from '../../theme/tokens';
import { fonts, typography } from '../../theme/typography';
import { parseRichText } from '../../features/notes/formatting';

type Props = TextInputProps & {
  value: string;
  placeholder?: string;
};

/**
 * WYSIWYG marker editor: a transparent multiline TextInput floats above a
 * mirror view that renders the same text through the rich-text parser, so
 * **bold**, *italic*, __underline__ and heading prefixes show styled while
 * typing. The input layer keeps real caret, selection and keyboard behaviour.
 *
 * Both layers must share identical padding and typography or the overlays
 * drift out of alignment.
 */
export function RichTextInput({ value, placeholder, style, ...rest }: Props) {
  const mirrorRef = useRef<ScrollView>(null);
  const syncingRef = useRef(false);

  const syncScroll = (e: TextInputScrollEvent) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    mirrorRef.current?.scrollTo({
      x: e.nativeEvent.contentOffset.x,
      y: e.nativeEvent.contentOffset.y,
      animated: false,
    });
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  };

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        ref={mirrorRef}
        style={styles.layer}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        pointerEvents="none"
      >
        {value.length === 0 && placeholder ? (
          <Text style={[styles.baseText, styles.placeholder]}>{placeholder}</Text>
        ) : (
          <MirrorText value={value} />
        )}
        {/* Trailing newline gives the caret room on the last line. */}
        {'\n'}
      </ScrollView>
      <RNTextInput
        {...rest}
        value={value}
        multiline
        textAlignVertical="top"
        style={[styles.layer, styles.input]}
        onScroll={syncScroll}
        selectionColor={colors.primary}
        underlineColorAndroid="transparent"
      />
    </View>
  );
}

function MirrorText({ value }: { value: string }) {
  const lines = parseRichText(value);
  return (
    <Text style={styles.baseText}>
      {lines.map((line, li) => (
        <React.Fragment key={li}>
          {line.segments.map((seg, si) => {
            const heading = line.level > 0;
            const style = [
              heading ? styles.heading : null,
              seg.bold ? styles.bold : null,
              seg.underline ? styles.underline : null,
              seg.italic ? styles.italic : null,
            ].filter(Boolean);
            return (
              <Text key={si} style={style}>
                {seg.text}
              </Text>
            );
          })}
          {'\n'}
        </React.Fragment>
      ))}
    </Text>
  );
}

const PAD = {
  paddingHorizontal: 16,
  paddingTop: 12,
  paddingBottom: 12,
};

const styles = StyleSheet.create({
  container: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  layer: {
    ...PAD,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  input: {
    fontSize: 16,
    lineHeight: 24,
    color: 'transparent',
  },
  baseText: {
    fontFamily: typography.body.fontFamily,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  placeholder: {
    color: colors.muted,
  },
  heading: {
    fontFamily: fonts.bold,
    fontWeight: '600',
    fontSize: 19,
    lineHeight: 27,
  },
  bold: {
    fontFamily: fonts.bold,
    fontWeight: '700',
  },
  underline: {
    textDecorationLine: 'underline',
  },
  italic: {
    fontStyle: 'italic',
  },
});
