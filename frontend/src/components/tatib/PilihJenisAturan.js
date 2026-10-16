import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { formatPoin } from '@/components/tatib/RingkasanPoin';
import { poinJenis } from '@/lib/inputTatib';

const warna = (poin) => (poin < 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700');

/**
 * Combobox jenis aturan (pelanggaran/kebaikan) dengan pencarian kode/nama, dikelompokkan per kategori.
 * Nilai poin tiap jenis ditampilkan dari master (tidak diketik petugas).
 * `jenisList`: [{ id, kode_aturan, nama, jalur_poin, besar_poin, kategori_id, kategori_nama }].
 */
export default function PilihJenisAturan({ jenisList = [], value, onPilih, disabled, testid = 'pilih-jenis-aturan' }) {
  const [open, setOpen] = useState(false);
  const terpilih = jenisList.find((j) => j.id === value);

  const kelompok = useMemo(() => {
    const per = new Map();
    jenisList.forEach((j) => {
      const nama = j.kategori_nama || 'Lainnya';
      if (!per.has(nama)) per.set(nama, []);
      per.get(nama).push(j);
    });
    return [...per.entries()];
  }, [jenisList]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
              <span className="font-mono text-xs text-slate-500 mr-2">{terpilih.kode_aturan}</span>
              {terpilih.nama}
            </span>
          ) : (
            <span className="truncate text-slate-500">Cari kode atau nama jenis aturan…</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[20rem] p-0" align="start">
        <Command filter={(val, cari) => (val.toLowerCase().includes(cari.toLowerCase().trim()) ? 1 : 0)}>
          <CommandInput placeholder="Ketik kode atau nama jenis…" data-testid={`${testid}-cari`} />
          <CommandList className="max-h-80">
            <CommandEmpty>{jenisList.length === 0 ? 'Belum ada jenis aturan aktif di kategori ini' : 'Jenis aturan tidak ditemukan'}</CommandEmpty>
            {kelompok.map(([kategori, daftar]) => (
              <CommandGroup key={kategori} heading={kategori}>
                {daftar.map((j) => {
                  const poin = poinJenis(j);
                  return (
                    <CommandItem
                      key={j.id}
                      value={`${j.kode_aturan} ${j.nama} ${kategori} ${j.id}`}
                      onSelect={() => { onPilih(j.id); setOpen(false); }}
                    >
                      <Check className={`mr-2 h-4 w-4 shrink-0 ${value === j.id ? 'opacity-100' : 'opacity-0'}`} />
                      <span className="font-mono text-xs text-slate-500 mr-2 shrink-0">{j.kode_aturan}</span>
                      <span className="flex-1 min-w-0 truncate">{j.nama}</span>
                      <span className={`ml-2 shrink-0 rounded px-1.5 text-xs font-semibold tabular-nums ${warna(poin)}`}>{formatPoin(poin)}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
