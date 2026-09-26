import DOMPurify from 'dompurify';

/**
 * Bersihkan HTML dari editor (materi/tugas) sebelum ditampilkan dengan
 * dangerouslySetInnerHTML. Tanpa ini, <script>, onerror=, javascript: dll.
 * yang disisipkan di konten bisa mencuri token login pengguna lain (XSS).
 */
export function sanitizeHtml(html) {
  if (!html) return '';
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
