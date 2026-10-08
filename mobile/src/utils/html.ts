/**
 * Konten kaya dari editor web (HTML) → teks rapi untuk layar native: paragraf, baris baru, butir daftar,
 * entitas HTML, dan daftar tautan (agar bisa diketuk). Tanpa WebView.
 */
const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };

export function htmlToText(html?: string | null): { text: string; links: { label: string; url: string }[] } {
  if (!html) return { text: '', links: [] };
  const links: { label: string; url: string }[] = [];
  let s = html.replace(/\r/g, '');
  s = s.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, url: string, label: string) => {
    const l = label.replace(/<[^>]+>/g, '').trim() || url;
    if (/^https?:\/\//i.test(url)) links.push({ label: l, url });
    return l;
  });
  s = s
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<\/\s*(p|div|h[1-6]|li|tr|blockquote|pre)\s*>/gi, '\n')
    .replace(/<\s*(p|div|h[1-6]|ul|ol|table|blockquote|pre)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#?\w+);/g, (m, e: string) => ENTITIES[e] ?? (e.startsWith('#') ? String.fromCharCode(parseInt(e.slice(1), 10)) : m))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text: s, links };
}

/** Teks biasa dari aplikasi → HTML sederhana untuk konten materi/tugas (paragraf & baris baru, aman di-escape). */
export function textToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return text.trim().split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
}
