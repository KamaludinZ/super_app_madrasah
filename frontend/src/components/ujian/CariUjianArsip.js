import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { JENIS_UJIAN, muatArsipSemester, muatBerandaUjian } from '@/lib/ujian';

/**
 * Pencarian ujian untuk arsip: semester aktif dan semester-semester lalu (yang boleh dibuka pengguna), dicari menurut
 * nama, jenis, atau tahun pelajaran. `onPilih(ujian)`.
 */
export default function CariUjianArsip({ nilai, onPilih }) {
  const { activeRole } = useAuth();
  const [buka, setBuka] = useState(false);
  const [kelompok, setKelompok] = useState([]);

  useEffect(() => {
    let hidup = true;
    Promise.allSettled([muatBerandaUjian(activeRole), muatArsipSemester()]).then(([kini, lalu]) => {
      if (!hidup) return;
      const g = [];
      if (kini.status === 'fulfilled' && kini.value.items.length) {
        g.push({ judul: `Semester ini${kini.value.konteks?.tahun_pelajaran ? ` · TP ${kini.value.konteks.tahun_pelajaran}` : ''}`, items: kini.value.items });
      }
      if (lalu.status === 'fulfilled') {
        lalu.value.semester.forEach((s) => g.push({ judul: `Semester ${s.semester_nama} · TP ${s.tahun_pelajaran}`, items: s.items }));
      }
      setKelompok(g);
    });
    return () => { hidup = false; };
  }, [activeRole]);

  const terpilih = useMemo(() => kelompok.flatMap((g) => g.items).find((u) => u.id === nilai?.id) || nilai, [kelompok, nilai]);

  return (
    <Popover open={buka} onOpenChange={setBuka}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={buka} className="h-10 w-full justify-between font-normal sm:w-[26rem]" data-testid="cari-ujian-arsip">
          <span className="truncate">{terpilih ? `${(JENIS_UJIAN[terpilih.jenis] || {}).label || ''} · ${terpilih.nama}` : 'Cari ujian…'}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[18rem] p-0" align="start">
        <Command filter={(val, cari) => (val.toLowerCase().includes(cari.toLowerCase().trim()) ? 1 : 0)}>
          <CommandInput placeholder="Ketik nama ujian, UTS/UAS, atau tahun pelajaran…" />
          <CommandList className="max-h-80">
            <CommandEmpty>Ujian tidak ditemukan.</CommandEmpty>
            {kelompok.map((g) => (
              <CommandGroup key={g.judul} heading={g.judul}>
                {g.items.map((u) => (
                  <CommandItem key={u.id} value={`${u.nama} ${u.jenis} ${u.tahun_pelajaran || ''} ${u.semester || ''} ${u.id}`}
                    onSelect={() => { onPilih(u); setBuka(false); }}>
                    <Check className={`mr-2 h-4 w-4 ${terpilih?.id === u.id ? 'opacity-100' : 'opacity-0'}`} />
                    <span className="truncate">{(JENIS_UJIAN[u.jenis] || {}).label} · {u.nama}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
