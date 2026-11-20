import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/api';

const nipTampil = (nip) => (nip && nip !== '-' ? `NIP ${nip}` : null);

/**
 * Combobox akun GTK dengan pencarian nama atau NIP. `gtk`: [{ user_id, nama, nip, peran }]; `value`: user_id
 * terpilih ('' bila kosong). `dipakai`: { user_id: label jabatan lain } ditampilkan sebagai keterangan.
 */
export default function PilihGtk({ id, gtk = [], value, onPilih, dipakai = {}, disabled, invalid, testid }) {
  const [open, setOpen] = useState(false);
  const terpilih = gtk.find((g) => g.user_id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex gap-2">
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            className={`w-full min-w-0 justify-between font-normal ${invalid ? 'border-red-500' : ''}`}
            data-testid={testid}
          >
            {terpilih ? (
              <span className="truncate text-slate-900">
                {terpilih.nama}
                {nipTampil(terpilih.nip) && <span className="ml-2 text-xs text-slate-500">{nipTampil(terpilih.nip)}</span>}
              </span>
            ) : <span className="truncate text-slate-500">Pilih dari akun GTK…</span>}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        {terpilih && !disabled && (
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => onPilih('')} aria-label="Kosongkan pilihan">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[18rem] p-0" align="start">
        <Command filter={(val, cari) => (val.toLowerCase().includes(cari.toLowerCase().trim()) ? 1 : 0)}>
          <CommandInput placeholder="Ketik nama atau NIP…" data-testid={testid && `${testid}-cari`} />
          <CommandList className="max-h-72">
            <CommandEmpty>{gtk.length === 0 ? 'Belum ada akun GTK' : 'GTK tidak ditemukan'}</CommandEmpty>
            <CommandGroup>
              {gtk.map((g) => (
                <CommandItem key={g.user_id} value={`${g.nama} ${g.nip || ''} ${g.user_id}`} onSelect={() => { onPilih(g.user_id); setOpen(false); }}>
                  <Check className={`mr-2 h-4 w-4 shrink-0 ${value === g.user_id ? 'opacity-100' : 'opacity-0'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{g.nama}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {[nipTampil(g.nip), ROLE_LABELS[g.peran] || g.peran, dipakai[g.user_id] && `sudah ${dipakai[g.user_id]}`].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
