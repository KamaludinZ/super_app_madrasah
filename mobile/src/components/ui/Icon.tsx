import React from 'react';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useTheme } from '@/theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

type Props = { name: IconName; size?: number; color?: string; style?: any };

/** Ikon Ionicons dengan warna bawaan dari tema. */
export function Icon({ name, size = 22, color, style }: Props) {
  const { colors } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? colors.onSurface} style={style} />;
}
