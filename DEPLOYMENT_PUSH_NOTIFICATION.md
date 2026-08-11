# Deployment Guide: Web Push Notification Fix

## 📋 Overview

Perbaikan major untuk Web Push Notification yang sebelumnya tidak berfungsi karena incompatibility library `pywebpush` dengan `cryptography >= 47.0.0`.

## 🔧 Changes Summary

### Backend
1. **New Implementation**: `web_push_robust.py`
   - Custom Web Push implementation using `httpx`, `PyJWT`, `http_ece`
   - Bypass broken `pywebpush` library
   - Properly handles VAPID signing and payload encryption

2. **Updated**: `routers/push.py`
   - Uses new robust implementation
   - Removed dependency on broken `pywebpush`

3. **Utilities**:
   - `clear_old_subscriptions.py`: Clear old subscriptions after VAPID key change
   - `check_subscriptions.py`: Check current subscription status

### Frontend
1. **Service Worker**: Enable system notification sound (`silent: false`)
2. **Audio Player**: Add Web Audio API beep fallback when MP3 unavailable
3. **Login Page**: Unlock audio on successful login (iOS/Safari compatibility)

## 🚀 Deployment Steps

### Step 1: Update VAPID Keys in Production

**IMPORTANT**: VAPID keys telah di-regenerate. Update environment variables di production:

```bash
# Backend .env (or production environment variables)
VAPID_PUBLIC_KEY=BPA-D3RAAuzVbRyRPYjd6m3cyK0ZJX-qII7k4pHE2qvC3LfPc9coJLmKr5ptym_Yu9fS-ZxDtU3UmxIVIiStutw=
VAPID_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgK173v1CQFa9uhWX+\noi61TDwikgLYq6pRACsafVIAOWehRANCAATwPg90QALs1W0ckT2I3ept3MitGSV/\nqiCO5OKRxNqrwty3z3PXKCS5iq+abcpv2LvX0vmcQ7VN1JsSFSIkrbrc\n-----END PRIVATE KEY-----\n
VAPID_SUBJECT=mailto:admyt.mtsn2kotamalang@gmail.com
```

### Step 2: Deploy Code

```bash
# Pull latest code
git pull origin main

# Backend - no rebuild needed (Python)
cd backend
# Restart server (systemd, pm2, or manual)
# Example with systemd:
sudo systemctl restart super-app-backend

# Frontend - rebuild if serving static from backend
cd ../frontend
npm run build

# Copy build to backend static directory
cp -r dist/* ../backend/static/
```

### Step 3: Clear Old Subscriptions

Old subscriptions with old VAPID keys are invalid. Clear them:

```bash
cd backend
python clear_old_subscriptions.py
```

Expected output:
```
Subscriptions before: X
Deleted: X
All old subscriptions cleared!
```

### Step 4: Verify Deployment

1. **Check VAPID keys loaded**:
   ```bash
   curl http://localhost:8000/api/push/vapid-public-key
   # Should return: {"public_key": "BPA-D3R...", "enabled": true}
   ```

2. **Test subscription**:
   - Open app in browser
   - Login as any user
   - Click "Aktifkan Notifikasi" banner
   - Grant permission
   - Should show success message

3. **Test push notification**:
   - As admin, create new announcement
   - Should receive push notification
   - Notification should appear and sound should play

### Step 5: Monitor

Check backend logs for push notification sending:

```bash
# Example with journalctl (systemd)
journalctl -u super-app-backend -f | grep -i push

# Look for:
# "Sent push notification to..." (success)
# "[push] send failed: ..." (errors)
```

## 🔊 Audio Behavior

### When App is OPEN (Foreground):
- ✅ Push notification appears
- ✅ System notification sound plays
- ✅ Custom beep sound plays (800Hz tone via Web Audio API)

### When App is CLOSED (Background):
- ✅ Push notification appears
- ✅ System notification sound plays
- ❌ Custom sound not available (OS limitation)

### Audio Fallback:
If MP3 files not found or can't load → automatically plays beep tone using Web Audio API

## 🐛 Troubleshooting

### No notifications received:

1. **Check VAPID keys configured**:
   ```bash
   grep VAPID backend/.env
   ```

2. **Check subscription exists**:
   ```bash
   cd backend
   python check_subscriptions.py
   ```

3. **Check browser permission granted**:
   - Open DevTools → Application → Notifications
   - Should show "Granted"

4. **Check service worker registered**:
   - Open DevTools → Application → Service Workers
   - Should show "activated and running"

### Audio not playing:

1. **Browser autoplay policy**: User must interact with page first (e.g., login, click)
2. **Volume muted**: Check system volume and browser tab sound
3. **iOS/Safari**: Custom sounds not supported, will use system sound

### Old subscriptions not working:

```bash
cd backend
python clear_old_subscriptions.py
```

Users need to re-subscribe after VAPID key change.

## 📝 Notes

- **VAPID keys are SECRET**: Never commit `.env` to git
- **Production deployment**: Use environment variables, not `.env` file
- **Subscription validity**: Each VAPID key pair is tied to subscriptions. Changing keys invalidates old subscriptions.
- **Browser compatibility**: Web Push supported on Chrome, Firefox, Edge, Safari 16+

## 🎯 Testing Checklist

- [ ] VAPID keys updated in production
- [ ] Backend restarted
- [ ] Frontend rebuilt and deployed
- [ ] Old subscriptions cleared
- [ ] New subscription works
- [ ] Push notification received
- [ ] Sound plays (system or beep)
- [ ] Teaching reminder works (for teachers)
- [ ] Announcement notification works

## 📚 Related Files

- `backend/web_push_robust.py` - Core implementation
- `backend/routers/push.py` - API endpoints
- `frontend/public/service-worker.js` - Push event handler
- `frontend/src/lib/audioPlayer.js` - Audio playback
- `frontend/src/hooks/useForegroundNotification.js` - Foreground handler

## ✅ Success Criteria

✅ Push notifications appear on subscribed devices
✅ Notification sound plays (system or beep)
✅ Teaching reminders sent at correct times (10-min before + start time)
✅ Announcement notifications sent when new announcement created
✅ Works on desktop and mobile browsers
✅ Works when app is open or closed

---

**Generated**: 2026-08-11
**Author**: Claude Code
**Status**: Ready for Production Deployment
