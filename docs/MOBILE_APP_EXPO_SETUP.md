# Mobile App (Expo) - Setup Guide

Mobile app native (Android/iOS) untuk Super Apps MATSANDATAMA dibuat sebagai project Expo terpisah yang me-reuse backend API yang sudah ada. **Backend tidak perlu perubahan apapun** - aplikasi mobile cukup mengonsumsi REST API yang sudah dibuat.

## Prerequisite
- Node.js 18+ & yarn
- Expo CLI: `npm install -g expo-cli`
- Expo Go app di HP untuk testing (Play Store / App Store)
- Backend Super Apps MATSANDATAMA sudah deploy & accessible publik (HTTPS wajib untuk camera & GPS)

## Inisialisasi Project
```bash
npx create-expo-app@latest matsandatama-mobile --template blank
cd matsandatama-mobile
npx expo install expo-camera expo-barcode-scanner expo-location expo-secure-store \
  expo-image-picker @react-navigation/native @react-navigation/native-stack \
  react-native-screens react-native-safe-area-context axios @tanstack/react-query \
  nativewind react-native-svg react-native-reanimated
yarn add tailwindcss --dev
npx tailwindcss init
```

## File Konfigurasi

**.env**
```
EXPO_PUBLIC_BACKEND_URL=https://app.mtsn2-malang.sch.id
```

**app.json** — penting untuk permission:
```json
{
  "expo": {
    "name": "Super Apps MATSANDATAMA",
    "slug": "matsandatama-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": { "image": "./assets/splash.png", "backgroundColor": "#006837" },
    "plugins": [
      ["expo-camera", { "cameraPermission": "Aplikasi memerlukan akses kamera untuk scan QR Code kelas." }],
      ["expo-location", { "locationAlwaysAndWhenInUsePermission": "Aplikasi memerlukan akses GPS untuk validasi lokasi pengisian jurnal." }]
    ],
    "ios": {
      "bundleIdentifier": "id.sch.mtsn2.matsandatama",
      "infoPlist": {
        "NSCameraUsageDescription": "Untuk scan QR Code kelas.",
        "NSLocationWhenInUseUsageDescription": "Untuk validasi lokasi jurnal."
      }
    },
    "android": {
      "package": "id.sch.mtsn2.matsandatama",
      "permissions": ["CAMERA", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "INTERNET"]
    }
  }
}
```

## API Client (`api.js`)
```js
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

export const api = axios.create({ baseURL: BASE });
api.interceptors.request.use(async (cfg) => {
  const token = await SecureStore.getItemAsync('matsa_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
```

## QR Scan Flow (`JurnalScanScreen.js`)
```jsx
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { api } from './api';

export default function JurnalScanScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleScan = async ({ data: qrToken }) => {
    if (scanned) return;
    setScanned(true);
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const { data: validation } = await api.post('/jurnal/validate', {
      qr_token: qrToken,
      user_lat: loc.coords.latitude, user_lon: loc.coords.longitude,
    });
    if (validation.overall_valid) {
      navigation.navigate('JurnalForm', { qrToken, lat: loc.coords.latitude, lon: loc.coords.longitude });
    } else {
      Alert.alert('Validasi Gagal', JSON.stringify(validation));
      setTimeout(() => setScanned(false), 2000);
    }
  };

  if (!permission?.granted) return <Button title="Izinkan Kamera" onPress={requestPermission} />;
  return <CameraView style={{ flex: 1 }} onBarcodeScanned={handleScan} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} />;
}
```

## Build APK / IPA
```bash
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview  # APK preview
npx eas-cli build --platform android --profile production  # AAB for Play Store
npx eas-cli build --platform ios --profile production  # IPA for App Store
```

## Strategi Reuse Backend
- ✅ Auth (login + math captcha) - bisa pakai SVG/text captcha
- ✅ JWT diset 12 jam + idle timeout (gunakan AppState dari React Native)
- ✅ Smart Journal QR Scan + GPS validation
- ✅ Jadwal, Riwayat, Public Monitoring
- ✅ Push notifications via Expo Notifications + backend webhook trigger (TODO Phase 5)

## Catatan Penting
- Backend WAJIB HTTPS untuk camera & GPS permission di iOS
- Test deep linking untuk reset password email link
- Tutorial lengkap: https://docs.expo.dev/tutorial/introduction/

**Status**: Setup guide siap. Implementasi aplikasi mobile native bisa dilakukan kapan saja sebagai project terpisah.
