/**
 * AGP 9 menyalakan `android.r8.strictFullModeForKeepRules`: aturan `-keep class X` dari pustaka tidak lagi ikut
 * menjaga konstruktor tanpa argumen. Kelas yang dibuat lewat refleksi (mis. WorkDatabase_Impl milik WorkManager
 * untuk expo-background-task, ComponentRegistrar Firebase untuk notifikasi) lalu dijadikan abstrak oleh R8 dan
 * aplikasi crash saat dibuka. Plugin ini mengembalikan perilaku AGP 8 (R8 & obfuscation tetap aktif).
 */
const { withGradleProperties } = require('expo/config-plugins');

const KEY = 'android.r8.strictFullModeForKeepRules';

module.exports = function withR8KeepRulesCompat(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((p) => !(p.type === 'property' && p.key === KEY));
    cfg.modResults.push({ type: 'property', key: KEY, value: 'false' });
    return cfg;
  });
};
