/**
 * Isian jam JJ:MM (24 jam) dengan papan angka: titik dua disisipkan otomatis, nilai di luar 00:00–23:59
 * ditandai. Nilai dikirim apa adanya ("07:30"), sama dengan input type="time" di web.
 */
import React from 'react';
import { Input } from './Input';

export const isValidTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

export function TimeField({ label, value, onChange, placeholder = '07:30', style }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: object;
}) {
  const format = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
  };
  const invalid = value.length === 5 && !isValidTime(value);
  return (
    <Input label={label} value={value} onChangeText={(t) => onChange(format(t))} placeholder={placeholder}
      keyboardType="number-pad" maxLength={5} icon="time-outline" containerStyle={style}
      error={invalid ? 'Jam tidak valid' : null} />
  );
}
