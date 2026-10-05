import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';

/**
 * Combobox satu tingkat wilayah dengan pencarian (daftar kabupaten/kota, kecamatan, atau
 * desa/kelurahan bisa panjang). `items`: [{ kode, nama, kode_pos? }].
 */
export default function PilihWilayah({ items, value, onPilih, placeholder, disabled, memuat, tampilKodePos, testid, kosong }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
          data-testid={testid}
        >
          <span className={`truncate ${value ? 'text-slate-900' : 'text-slate-500'}`}>
            {value ? `${value.nama}${tampilKodePos && value.kode_pos ? ` (${value.kode_pos})` : ''}` : placeholder}
          </span>
          {memuat ? <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-60" /> : <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0" align="start">
        <Command filter={(val, cari) => (val.toLowerCase().includes(cari.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Ketik untuk mencari..." />
          <CommandList className="max-h-64">
            <CommandEmpty>{items.length === 0 && kosong ? kosong : 'Tidak ditemukan'}</CommandEmpty>
            <CommandGroup>
              {items.map((o) => (
                <CommandItem
                  key={o.kode}
                  value={`${o.nama} ${o.kode} ${o.kode_pos || ''}`}
                  onSelect={() => { onPilih(o.kode); setOpen(false); }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value?.kode === o.kode ? 'opacity-100' : 'opacity-0'}`} />
                  <span className="flex-1 truncate">{o.nama}</span>
                  {tampilKodePos && o.kode_pos && <span className="ml-2 font-mono text-xs text-slate-500">{o.kode_pos}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
