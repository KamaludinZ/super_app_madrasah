// Unduh denah sekolah (semua peran): denah kosong (berkas asli) atau denah dengan penanda.
// Versi berpenanda disusun di browser (canvas): titik penanda hanya berlabel KODE ruang, dan
// keterangan "kode — nama ruang" ditempatkan di tepi kanan denah.

const HIJAU = '#006837';

const unduhBlob = (blob, nama) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const tanggalBerkas = () => new Date().toISOString().slice(0, 10);
const EKSTENSI = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

// Urutkan penanda menurut kode ruang (alami: R-2 sebelum R-10); penanda tanpa kode di akhir.
export function urutkanPenanda(markers = []) {
  return [...markers].sort((a, b) => {
    if (!a.kode_ruang !== !b.kode_ruang) return a.kode_ruang ? -1 : 1;
    return (a.kode_ruang || a.nama_ruang || '').localeCompare(b.kode_ruang || b.nama_ruang || '', 'id', { numeric: true });
  });
}

export async function unduhDenahKosong(gambarUrl) {
  const blob = await (await fetch(gambarUrl)).blob();
  unduhBlob(blob, `denah-sekolah-kosong_${tanggalBerkas()}.${EKSTENSI[blob.type] || 'png'}`);
}

const muatGambar = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('Gambar denah gagal dimuat'));
  img.src = src;
});

function kotakBulat(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function potong(ctx, teks, maks) {
  if (ctx.measureText(teks).width <= maks) return teks;
  let t = teks;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maks) t = t.slice(0, -1);
  return `${t}…`;
}

// Susun denah + penanda (label kode) + keterangan di tepi kanan -> Blob PNG.
export async function susunDenahBerpenanda(gambarUrl, markers, { judul = 'Masterplan Sekolah' } = {}) {
  const img = await muatGambar(gambarUrl);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const huruf = Math.max(14, Math.round(Math.max(W, H) / 70));
  const pad = Math.round(huruf * 1.2);
  const barisH = Math.round(huruf * 1.9);
  const daftar = urutkanPenanda(markers);

  // Tata letak keterangan: satu kolom; bila tidak muat setinggi denah, tambah kolom.
  const kolomW = Math.max(huruf * 22, Math.round(W * 0.3));
  const kepalaH = Math.round(huruf * 3.6);
  const muatPerKolom = Math.max(1, Math.floor((H - kepalaH - pad * 2) / barisH));
  const jumlahKolom = Math.max(1, Math.ceil(daftar.length / muatPerKolom));
  const legendaW = jumlahKolom * kolomW + pad * 2;
  const tinggi = Math.max(H, kepalaH + pad * 2 + Math.min(daftar.length, muatPerKolom) * barisH);

  const canvas = document.createElement('canvas');
  canvas.width = W + legendaW;
  canvas.height = tinggi;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, W, H);

  // Penanda: titik + label KODE ruang saja.
  const r = Math.round(huruf * 0.45);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  daftar.forEach((m) => {
    const x = (m.posisi_x / 100) * W;
    const y = (m.posisi_y / 100) * H;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = HIJAU;
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.4);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    const label = m.kode_ruang || '?';
    ctx.font = `bold ${huruf}px sans-serif`;
    const lw = ctx.measureText(label).width + huruf * 0.8;
    const lh = huruf * 1.5;
    const ly = Math.min(y + r + lh * 0.2, H - lh - 2);
    const lx = Math.min(Math.max(x - lw / 2, 2), W - lw - 2);
    kotakBulat(ctx, lx, ly, lw, lh, huruf * 0.3);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = HIJAU;
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.fillText(label, lx + lw / 2, ly + lh / 2);
  });

  // Keterangan di tepi kanan: kode ruang + nama ruang.
  const x0 = W;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(x0, 0, legendaW, tinggi);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(x0, 0, Math.max(2, huruf * 0.12), tinggi);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold ${Math.round(huruf * 1.15)}px sans-serif`;
  ctx.fillText('KETERANGAN RUANG', x0 + pad, pad + huruf);
  ctx.fillStyle = '#64748b';
  ctx.font = `${Math.round(huruf * 0.8)}px sans-serif`;
  ctx.fillText(`${judul} · ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, x0 + pad, pad + huruf * 2.4);

  ctx.textBaseline = 'middle';
  daftar.forEach((m, i) => {
    const kol = Math.floor(i / muatPerKolom);
    const baris = i % muatPerKolom;
    const bx = x0 + pad + kol * kolomW;
    const by = kepalaH + pad + baris * barisH + barisH / 2;
    const kode = m.kode_ruang || '?';
    ctx.font = `bold ${huruf}px sans-serif`;
    const kw = Math.max(ctx.measureText(kode).width + huruf * 0.8, huruf * 3.2);
    kotakBulat(ctx, bx, by - huruf * 0.75, kw, huruf * 1.5, huruf * 0.3);
    ctx.fillStyle = HIJAU;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(kode, bx + kw / 2, by);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = `${huruf}px sans-serif`;
    ctx.fillText(potong(ctx, m.nama_ruang || '-', kolomW - kw - huruf * 1.4), bx + kw + huruf * 0.5, by);
  });

  if (!daftar.length) {
    ctx.fillStyle = '#64748b';
    ctx.font = `${huruf}px sans-serif`;
    ctx.fillText('Belum ada ruang yang ditandai.', x0 + pad, kepalaH + pad + huruf);
  }

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal menyusun gambar'))), 'image/png'));
}

export async function unduhDenahBerpenanda(gambarUrl, markers, opsi) {
  const blob = await susunDenahBerpenanda(gambarUrl, markers, opsi);
  unduhBlob(blob, `denah-sekolah-berpenanda_${tanggalBerkas()}.png`);
}
