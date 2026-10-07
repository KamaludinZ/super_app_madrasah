import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { fonts, fontSize, radius, spacing, useTheme } from '@/theme';
import { T } from './Text';
import { Icon, IconName } from './Icon';

export type InputProps = TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: IconName;
  containerStyle?: ViewStyle;
  right?: React.ReactNode;
};

export function Input({ label, error, hint, icon, containerStyle, right, secureTextEntry, style, multiline, ...rest }: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);
  const borderColor = error ? colors.error : focused ? colors.brandPrimary : colors.borderStrong;
  return (
    <View style={containerStyle}>
      {label ? <T variant="label" tone="secondary" style={styles.label}>{label}</T> : null}
      <View style={[styles.box, { borderColor, backgroundColor: colors.surface }, multiline && styles.multiline]}>
        {icon ? <Icon name={icon} size={20} color={focused ? colors.brandPrimary : colors.muted} /> : null}
        <TextInput
          placeholderTextColor={colors.muted}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          secureTextEntry={hidden}
          multiline={multiline}
          maxFontSizeMultiplier={1.3}
          {...rest}
          style={[styles.input, { color: colors.onSurface }, multiline && styles.inputMultiline, style]}
        />
        {secureTextEntry ? (
          <Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Tampilkan password' : 'Sembunyikan password'} onPress={() => setHidden((h) => !h)} hitSlop={8} style={styles.eye}>
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.muted} />
          </Pressable>
        ) : right}
      </View>
      {error ? <T variant="caption" tone="error" style={styles.help}>{error}</T> : hint ? <T variant="caption" tone="muted" style={styles.help}>{hint}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  box: {
    minHeight: 50,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  multiline: { alignItems: 'flex-start', paddingVertical: spacing.sm },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: fontSize.lg, paddingVertical: 10 },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  eye: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  help: { marginTop: 6 },
});
