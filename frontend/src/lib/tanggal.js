// Tanggal hari ini (YYYY-MM-DD) menurut WIB. Jangan memakai new Date().toISOString() untuk "hari ini":
// itu tanggal UTC, sehingga pengisian sebelum pukul 07.00 WIB tercatat sebagai hari kemarin.
export const hariIniWIB = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
