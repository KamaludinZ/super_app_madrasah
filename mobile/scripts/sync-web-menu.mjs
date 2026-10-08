/**
 * Sinkron menu per peran dari web (frontend/src/components/layout/AppShell.js → navForRole)
 * ke aplikasi (src/menu/webMenu.json), agar menu aplikasi SELALU sama dengan web.
 *
 * Cara kerja: kode navForRole asli dievaluasi apa adanya; komponen ikon lucide diganti
 * nama string (dipetakan ke ikon aplikasi di src/menu/icons.ts).
 * Jalankan setiap kali menu web berubah:  node scripts/sync-web-menu.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const shellPath = path.join(root, 'frontend', 'src', 'components', 'layout', 'AppShell.js');
const apiPath = path.join(root, 'frontend', 'src', 'lib', 'api.js');
const outPath = path.resolve(here, '..', 'src', 'menu', 'webMenu.json');

const readLf = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const shell = readLf(shellPath);
const start = shell.indexOf('const SUBJECT_TEACHER_ROLES');
const navStart = shell.indexOf('function navForRole(');
const navEnd = shell.indexOf('\n  return items;\n}\n', navStart);
if (start < 0 || navStart < 0 || navEnd < 0) throw new Error('Struktur navForRole di AppShell.js tidak dikenali');
// Menu Tata Tertib (lib/aksesTatib.js) & menu lintas peran (lib/menuUmum.js) ikut dievaluasi
// tanpa baris import/export agar navForRole bisa memanggilnya.
const libMenu = ['aksesTatib.js', 'menuUmum.js']
  .map((f) => readLf(path.join(root, 'frontend', 'src', 'lib', f))
    .replace(/^import .*$/gm, '')
    .replace(/^export (const|function) /gm, '$1 '))
  .join('\n');
const code = libMenu + '\n' + shell.slice(start, navEnd + '\n  return items;\n}\n'.length);

// Nama yang didefinisikan di potongan kode tidak boleh dibayangi proxy.
const defined = new Set([...code.matchAll(/(?:const|function)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
const scope = new Proxy({}, {
  has: (_, key) => typeof key === 'string' && !defined.has(key) && !(key in globalThis),
  get: (_, key) => {
    if (key === Symbol.unscopables) return undefined;
    if (key === 'GURU_PENGGANTI_PATH') return '/guru-pengganti';
    return String(key); // komponen ikon → nama ikon
  },
});
// eslint-disable-next-line no-new-func
const { navForRole } = new Function('scope', `with (scope) { ${code}; return { navForRole }; }`)(scope);

// Daftar peran: ROLE_LABELS web + peran yang disebut di navForRole.
const api = readLf(apiPath);
const labelsBlock = api.slice(api.indexOf('export const ROLE_LABELS'), api.indexOf('};', api.indexOf('export const ROLE_LABELS')));
const labels = Object.fromEntries([...labelsBlock.matchAll(/^\s+([a-z_]+):\s*'([^']+)'/gm)].map((m) => [m[1], m[2]]));
const extraRoles = [...code.matchAll(/role === '([a-z_]+)'/g)].map((m) => m[1]);
const roles = [...new Set([...Object.keys(labels), ...extraRoles])];

const normalize = (entries) => {
  const groups = [];
  let loose = null;
  for (const e of entries) {
    if (e.items) {
      loose = null;
      groups.push({ title: e.title ?? null, items: e.items.map(item) });
    } else {
      if (!loose) { loose = { title: null, items: [] }; groups.push(loose); }
      loose.items.push(item(e));
    }
  }
  return groups;
};
const item = (i) => ({ to: i.to, label: i.label, icon: i.icon, ...(i.highlight ? { highlight: true } : {}) });

const out = { generated_at: new Date().toISOString(), source: 'frontend/src/components/layout/AppShell.js#navForRole', labels, roles: {} };
for (const r of roles) out.roles[r] = normalize(navForRole(r, [r]));

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
const icons = new Set(Object.values(out.roles).flatMap((g) => g.flatMap((x) => x.items.map((i) => i.icon))));
console.log(`Menu ${roles.length} peran ditulis ke ${path.relative(process.cwd(), outPath)}; ikon: ${[...icons].sort().join(', ')}`);
