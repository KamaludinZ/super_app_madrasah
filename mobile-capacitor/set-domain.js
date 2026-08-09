#!/usr/bin/env node
/*
 * Ubah domain aplikasi mobile (APK) dengan mudah.
 * Cara pakai:
 *   node set-domain.js https://domain-baru-anda.sch.id
 * Lalu:
 *   npx cap sync android && npm run build:apk
 */
const fs = require('fs');
const path = require('path');

const newUrl = process.argv[2];
if (!newUrl || !/^https?:\/\//.test(newUrl)) {
  console.error('\n❌  Masukkan URL lengkap. Contoh:');
  console.error('    node set-domain.js https://super.mtsn2kotamalang.sch.id\n');
  process.exit(1);
}

const cfgPath = path.join(__dirname, 'capacitor.config.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
cfg.server = cfg.server || {};
const old = cfg.server.url;
cfg.server.url = newUrl.replace(/\/$/, '');
cfg.server.cleartext = newUrl.startsWith('http://');
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');

console.log(`\n✅  Domain diubah:`);
console.log(`    dari : ${old}`);
console.log(`    ke   : ${cfg.server.url}\n`);
console.log('Langkah berikutnya:');
console.log('    npx cap sync android');
console.log('    npm run build:apk\n');
