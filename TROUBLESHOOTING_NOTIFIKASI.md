# Troubleshooting: Pengumuman & Notifikasi PWA

## Problem 1: Pengumuman Tidak Muncul

### Cek Database
```bash
cd backend
python -c "
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient('mongodb://admin:SuperStrongPassword2024!SecureMongo@localhost:27017/super_app_madrasah?authSource=admin')
    db = client.super_app_madrasah

    anns = await db.announcements.find({}).sort('created_at', -1).to_list(10)
    print(f'Total announcements: {len(anns)}')
    for ann in anns:
        print(f'- {ann.get(\"title\")} (is_active: {ann.get(\"is_active\")}, target_roles: {ann.get(\"target_roles\")})')
    client.close()

asyncio.run(check())
"
```

### Clear Browser Cache
1. Buka DevTools (F12)
2. Application tab → Clear storage
3. Pilih: Cookies, Cache storage, IndexedDB
4. Klik "Clear site data"
5. Hard refresh: Ctrl+Shift+R

### Unregister Service Worker
1. Buka DevTools (F12)
2. Application tab → Service Workers
3. Klik "Unregister"
4. Reload page

## Problem 2: Notifikasi Push Tidak Berfungsi

### Cek Permission
1. Buka browser settings
2. Site settings → Notifications
3. Pastikan site diizinkan untuk notifikasi

### Cek Service Worker Status
```javascript
// Di browser console:
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Service Workers:', regs);
});
```

### Cek Push Subscription
```javascript
// Di browser console:
navigator.serviceWorker.ready.then(reg => {
  reg.pushManager.getSubscription().then(sub => {
    console.log('Push subscription:', sub);
    if (!sub) {
      console.error('NOT SUBSCRIBED to push!');
    }
  });
});
```

### Test Audio Files
```javascript
// Di browser console:
const audio = new Audio('/sounds/notification-bell.mp3');
audio.play().then(() => console.log('Audio OK!')).catch(e => console.error('Audio error:', e));
```

### Cek Backend Push Subscriptions
```bash
cd backend
python -c "
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient('mongodb://admin:SuperStrongPassword2024!SecureMongo@localhost:27017/super_app_madrasah?authSource=admin')
    db = client.super_app_madrasah

    subs = await db.push_subscriptions.find({}).to_list(100)
    print(f'Total push subscriptions: {len(subs)}')
    for sub in subs:
        print(f'- User: {sub.get(\"user_id\")} (endpoint: {sub.get(\"endpoint\")[:50]}...)')
    client.close()

asyncio.run(check())
"
```

## Solusi Umum

### 1. Force Refresh Everything
```bash
# Clear browser completely
Ctrl+Shift+Delete → Clear all time

# Restart browser

# Login ulang
```

### 2. Re-register Push Notifications
1. Login sebagai guru
2. Buka browser console (F12)
3. Jalankan:
```javascript
// Request notification permission
Notification.requestPermission().then(permission => {
  console.log('Permission:', permission);
});

// Subscribe to push
navigator.serviceWorker.ready.then(async registration => {
  const response = await fetch('/api/push/vapid-public-key');
  const vapidPublicKey = await response.text();

  const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedVapidKey
  });

  console.log('Subscribed:', subscription);

  // Send to backend
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription)
  });
});

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
```

### 3. Test Pengumuman Baru
1. Login sebagai admin
2. Buat pengumuman baru dengan:
   - Target: "Semua pengguna"
   - is_active: true
   - Severity: critical (untuk testing)
3. Login sebagai guru
4. Refresh dashboard
5. Pengumuman harus muncul

### 4. Check Teaching Reminder
```bash
# Cek apakah scheduler berjalan
cd backend
grep "Teaching reminder scheduler" logs/*.log

# Atau lihat di console backend
# Harus ada: "🔔 Teaching reminder scheduler started"
```

## Expected Behavior

### Pengumuman
- Muncul di dashboard (non-admin)
- Sorted: pinned first, then newest
- Max 3 di card, sisanya di /pengumuman

### Notifikasi Push
- **10 menit sebelum mengajar**: "Waktunya Mengajar!" + bell sound
- **Saat jam mulai**: "Jam mengajar dimulai!" + chime sound
- **Pengumuman baru**: Notifikasi + badge "BARU"

### Audio
- **App terbuka**: Custom audio (bell/chime) harus berbunyi
- **App tertutup**: Nada sistem browser/HP
- **iOS Safari**: Selalu nada sistem (limitation)
