import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, X } from 'lucide-react';

/**
 * Combobox siswa dengan pencarian nama, NIS, NISN, atau kelas.
 * `siswaList`: [{ id, nis, nisn, full_name, class_name }]; `value`: id siswa terpilih ('' bila kosong).
 */
export default function PilihSiswaTatib({ siswaList = [], value, onPilih, disabled, testid = 'pilih-siswa-tatib' }) {
  const [open, setOpen] = useState(false);
  const terpilih = siswaList.find((s) => s.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex gap-2">
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full min-w-0 justify-between font-normal"
            data-testid={testid}
          >
            {terpilih ? (
              <span className="truncate text-slate-900">
                {terpilih.full_name}
                <span className="ml-2 text-xs text-slate-500">{[terpilih.class_name, terpilih.nis].filter(Boolean).join(' · ')}</span>
              </span>
            ) : (
              <span className="truncate text-slate-500">Cari nama, NIS, NISN, atau kelas…</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        {terpilih && !disabled && (
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => onPilih('')} aria-label="Kosongkan siswa">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[18rem] p-0" align="start">
        <Command filter={(val, cari) => (val.toLowerCase().includes(cari.toLowerCase().trim()) ? 1 : 0)}>
          <CommandInput placeholder="Ketik nama, NIS, NISN, atau kelas…" data-testid={`${testid}-cari`} />
          <CommandList className="max-h-72">
            <CommandEmpty>{siswaList.length === 0 ? 'Belum ada data siswa' : 'Siswa tidak ditemukan'}</CommandEmpty>
            <CommandGroup>
              {siswaList.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`${s.full_name} ${s.nis || ''} ${s.nisn || ''} ${s.class_name || ''} ${s.id}`}
                  onSelect={() => { onPilih(s.id); setOpen(false); }}
                >
                  <Check className={`mr-2 h-4 w-4 shrink-0 ${value === s.id ? 'opacity-100' : 'opacity-0'}`} />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{s.full_name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {[s.class_name, s.nis && `NIS ${s.nis}`, s.nisn && `NISN ${s.nisn}`].filter(Boolean).join(' · ')}
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
