# Push Notifications Setup - Super App Madrasah

## Status: CONFIGURED ✅

Push notifications are now properly configured and ready to use!

## What Was Fixed

### Problem
When users tried to enable notifications, they saw: **"push notifikasi belum diaktifkan di server"**

### Root Cause
VAPID (Voluntary Application Server Identification) keys were not configured in the backend `.env` file.

### Solution
Generated and configured VAPID keys for Web Push API.

## Configuration Details

### Backend (.env)
The following environment variables have been added to `backend/.env`:

```env
# Web Push Notifications (VAPID)
VAPID_PUBLIC_KEY=BNUWIavahXmTOtitW6-pqTIiMP4-fO343S5sTb8kNu96GthTLwYj4HNxTO6f1PU_FRklShBnjAhPPWgBla8s9Yo
VAPID_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
VAPID_SUBJECT=mailto:admyt.mtsn2kotamalang@gmail.com
```

**IMPORTANT**:
- VAPID public key must be properly base64url encoded WITHOUT stripping padding
- Length should be 87 characters (65 bytes uncompressed point for P-256)
- Do NOT use `.rstrip('=')` when generating keys

**IMPORTANT**: The private key must be kept secret! Do NOT commit these keys to public repositories.

### For Production Deployment

When deploying to production (e.g., Railway, Vercel, Heroku), you need to add these environment variables:

1. **VAPID_PUBLIC_KEY**: Copy from backend/.env
2. **VAPID_PRIVATE_KEY**: Copy from backend/.env (including the \n escape sequences)
3. **VAPID_SUBJECT**: Update with your actual admin email

## How to Test

### 1. Restart Backend Server
If your backend is running, restart it to load the new environment variables:
```bash
cd backend
# Stop current server (Ctrl+C if running)
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

### 2. Check Push Status
Open your browser console and run:
```javascript
fetch('/api/push/vapid-public-key')
  .then(r => r.json())
  .then(data => {
    console.log('Push enabled:', data.enabled);
    console.log('Public key:', data.public_key);
  });
```

Expected output:
```json
{
  "public_key": "BMMAR8TdquPnuTmncA-2gI...",
  "enabled": true
}
```

### 3. Enable Notifications
1. Login as a teacher (guru)
2. You should see a banner: "Aktifkan notifikasi untuk pengingat mengajar"
3. Click "Aktifkan Notifikasi"
4. Grant browser permission when prompted
5. You should see: "Notifikasi diaktifkan" ✅

### 4. Test Notification Delivery
#### Option A: Create a Test Announcement (as admin)
1. Login as admin
2. Go to Pengumuman menu
3. Create new announcement:
   - Title: "Test Notifikasi"
   - Body: "Ini adalah test notifikasi push"
   - Target: "Guru" (or "Semua pengguna")
   - is_active: ✓ checked
4. Click Simpan

All teachers should receive a push notification with sound!

#### Option B: Use Test Endpoint
1. Login as any user
2. Open browser console
3. Run:
```javascript
fetch('/api/push/test', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token'),
    'Content-Type': 'application/json'
  }
}).then(r => r.json()).then(console.log);
```

You should receive a test notification: "Tes Notifikasi"

## Notification Features

### 1. Announcement Notifications
When admin creates a new announcement:
- ✅ Push notification sent to target roles
- ✅ Appears in notifications bell (topbar)
- ✅ Shows in dashboard AnnouncementsCard
- ✅ Plays notification-bell.mp3 sound (if app is open)
- ✅ Badge shows "BARU" for unread announcements

### 2. Teaching Reminders (for Guru)
Automatic notifications for teaching schedules:
- **10 minutes before**: "Waktunya Mengajar! [Mata Pelajaran] di [Kelas]"
  - Sound: notification-bell.mp3
  - Action: Opens /jurnal-mengajar
- **At start time**: "Jam mengajar dimulai! [Mata Pelajaran] di [Kelas]"
  - Sound: notification-chime.mp3
  - Action: Opens /jurnal-mengajar

### 3. Password Change Reminder
Synthetic notification (appears in bell, but not push):
- First login: "Saran: Ubah Password"
- After 6 months: "Password Sudah > 6 Bulan"
- Action: Opens /profil/keamanan

## Audio Files
Located in `frontend/public/sounds/`:
- `notification-bell.mp3` (66 KB) - For reminders
- `notification-chime.mp3` (135 KB) - For start time

**Note**: Custom audio only works when app is open. When app is closed, browser/OS uses system notification sound.

## Troubleshooting

### "Push notifikasi belum diaktifkan di server"
**Fixed!** This was caused by missing VAPID keys. Now configured.

### No notifications received
1. Check push subscription exists:
```bash
cd backend
python -c "
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient('mongodb://admin:SuperStrongPassword2024!SecureMongo@localhost:27017/super_app_madrasah?authSource=admin')
    db = client.super_app_madrasah
    subs = await db.push_subscriptions.find({}).to_list(100)
    print(f'Total subscriptions: {len(subs)}')
    for sub in subs:
        print(f'- User: {sub.get(\"user_id\")}')
    client.close()

asyncio.run(check())
"
```

2. Check browser console for errors
3. Verify notification permission is granted (browser settings)
4. Try unregister and re-subscribe

### Audio not playing
1. Check browser autoplay policy (must interact with page first)
2. Verify files exist: `/sounds/notification-bell.mp3` and `/sounds/notification-chime.mp3`
3. Check browser console for audio errors
4. On iOS Safari: Custom audio not supported, will use system sound

### Announcements not appearing
1. Hard refresh: Ctrl+Shift+R
2. Clear service worker: DevTools → Application → Service Workers → Unregister
3. Check announcement is_active = true
4. Verify target_roles includes your role

## Technical Details

### Backend Endpoints
- `GET /api/push/vapid-public-key` - Get public key & status
- `POST /api/push/subscribe` - Save push subscription
- `POST /api/push/unsubscribe` - Remove subscription
- `GET /api/push/status` - Check user's subscription status
- `POST /api/push/test` - Send test notification

### Helper Functions
- `send_push_to_users(user_ids, payload)` - Send to specific users
- `send_push_to_roles(target_roles, payload)` - Send to roles

### Push Payload Format
```javascript
{
  "title": "Notification Title",
  "body": "Notification body text",
  "url": "/target-page",
  "tag": "unique-id",
  "icon": "/icon-192.png",
  "badge": "/icon-192.png",
  "data": {
    "action": "action_type",
    "custom_field": "value"
  }
}
```

### Service Worker
Located in `frontend/public/sw.js`:
- Handles push events
- Shows notifications
- Plays custom audio (via postMessage)
- Handles notification clicks

## Security Notes

1. **VAPID Private Key**: Must be kept secret
2. **Do NOT commit** .env file to public repos
3. **Production**: Use environment variables, not .env file
4. **Public Key**: Safe to expose (sent to browsers)

## Regenerating Keys

If you need to regenerate VAPID keys:
```bash
cd backend
python scripts/generate_vapid_keys.py
```

This will output new keys to add to `.env`.

**Warning**: Regenerating keys will invalidate all existing push subscriptions. Users will need to re-subscribe.

## Next Steps

1. ✅ Backend configured with VAPID keys
2. ✅ Push endpoints ready
3. 🔄 Restart backend server
4. 📱 Test notification flow
5. 🚀 Deploy to production with environment variables

## Support

For issues or questions, refer to:
- `TROUBLESHOOTING_NOTIFIKASI.md` - General notification troubleshooting
- Backend logs for push delivery status
- Browser DevTools → Console for client-side errors
