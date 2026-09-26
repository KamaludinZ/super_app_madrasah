# 🔄 Loading Screen Guide
## Super Apps MATSANDATAMA

Dokumentasi untuk penggunaan Loading Screen dengan logo dinamis dari settings.

---

## 📦 Components Available

### 1. **FullPageLoader** (Recommended)

Full-screen loading dengan logo dari settings.

**Location:** `frontend/src/components/ui/page-loader.jsx`

**Features:**
- ✅ Fetch logo dari `/api/app-info`
- ✅ Display school name dari settings
- ✅ Animated spinner ring (emerald color)
- ✅ Animated dots
- ✅ Gradient background
- ✅ Responsive design

**Usage:**
```jsx
import { FullPageLoader } from '@/components/ui/page-loader';

function MyComponent() {
  const [loading, setLoading] = useState(true);

  if (loading) {
    return <FullPageLoader message="Memuat data..." />;
  }

  return <div>Content</div>;
}
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `message` | string | "Memuat..." | Loading message to display |

---

### 2. **LoadingScreen** (Alternative)

Flexible loading screen dengan multiple variants.

**Location:** `frontend/src/components/ui/LoadingScreen.js`

**Features:**
- ✅ Full-screen or inline variant
- ✅ Dynamic logo from settings
- ✅ Customizable spinner
- ✅ Flexible messaging

**Usage:**
```jsx
import LoadingScreen from '@/components/ui/LoadingScreen';

// Full screen
<LoadingScreen
  message="Loading..."
  variant="full"
  showSpinner={true}
/>

// Inline
<LoadingScreen
  message="Processing..."
  variant="inline"
  showSpinner={false}
/>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `message` | string | "Memuat..." | Loading message |
| `showSpinner` | boolean | true | Show spinner animation |
| `variant` | string | "full" | "full" or "inline" |

---

### 3. **InlineLoader**

Compact loader untuk inline use.

**Location:** `frontend/src/components/ui/LoadingScreen.js`

**Usage:**
```jsx
import { InlineLoader } from '@/components/ui/LoadingScreen';

<InlineLoader message="Loading..." showSpinner={true} />
```

---

### 4. **PageLoader**

Simple loader untuk page sections (tanpa logo).

**Location:** `frontend/src/components/ui/page-loader.jsx`

**Usage:**
```jsx
import { PageLoader } from '@/components/ui/page-loader';

<PageLoader message="Memuat data..." />
```

---

## 🎨 Visual Design

### FullPageLoader Design

```
┌─────────────────────────────────────────┐
│                                         │
│         ┌───────────────────┐           │
│         │   Spinner Ring    │           │
│         │   (Animated)      │           │
│         │                   │           │
│         │    [LOGO IMAGE]   │           │
│         │   (From Settings) │           │
│         │                   │           │
│         └───────────────────┘           │
│                                         │
│         School Name (Bold)              │
│         Loading Message (Pulse)         │
│                                         │
│         ●  ●  ●  (Animated Dots)        │
│                                         │
└─────────────────────────────────────────┘
```

**Colors:**
- Background: Gradient from slate-50 to slate-100
- Spinner: Emerald-600 (border-t), Emerald-200 (border)
- Text: Slate-900 (title), Slate-600 (message)
- Dots: Emerald-600

---

## 🔧 Setup Logo in Settings

### Admin Settings Page

1. Navigate to `/admin/settings`
2. Scroll to **Logo Madrasah** section
3. Upload logo image (PNG/JPG recommended)
4. Click **Simpan Logo**

### API Endpoint

Logo is served from:
```
GET /api/app-info
```

**Response:**
```json
{
  "logo": "data:image/png;base64,iVBORw0KG...",
  "school_name": "MTsN 2 Kota Malang",
  "app_name": "Super Apps MATSANDATAMA",
  ...
}
```

---

## 📝 Integration Examples

### Example 1: Route Guard

```jsx
// PublicPageGuard.jsx
import { FullPageLoader } from '@/components/ui/page-loader';

export function PublicPageGuard({ pageName, children }) {
  const { visibility, loading } = usePublicPagesVisibility();

  if (loading) {
    return <FullPageLoader message="Memuat pengaturan..." />;
  }

  return children;
}
```

### Example 2: Data Fetching

```jsx
function StudentListPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/students').then(({ data }) => {
      setStudents(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <FullPageLoader message="Memuat daftar siswa..." />;
  }

  return <StudentTable data={students} />;
}
```

### Example 3: Form Submission

```jsx
function CreateStudentForm() {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (data) => {
    setSubmitting(true);
    try {
      await api.post('/students', data);
      toast.success('Siswa berhasil ditambahkan');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return <FullPageLoader message="Menyimpan data siswa..." />;
  }

  return <Form onSubmit={handleSubmit} />;
}
```

---

## ⚡ Performance

### Logo Caching

Logo di-fetch sekali per component mount dan di-cache di state.

**Optimization:**
- Consider implementing global state untuk logo (Redux/Context)
- Cache logo di localStorage untuk faster loading
- Lazy load logo untuk better initial render

### Current Implementation

```jsx
const [logo, setLogo] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchLogo = async () => {
    try {
      const { data } = await api.get('/app-info');
      setLogo(data.logo);
    } catch (error) {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  fetchLogo();
}, []);
```

---

## 🎯 Best Practices

### DO ✅

- Use `FullPageLoader` for full-page loading states
- Provide descriptive messages ("Memuat data siswa...")
- Use `InlineLoader` for section-level loading
- Handle error states when logo fetch fails
- Keep loading messages short and clear

### DON'T ❌

- Don't use multiple full-page loaders simultaneously
- Don't fetch logo on every render (use memoization)
- Don't use generic "Loading..." for everything
- Don't block user interaction unnecessarily
- Don't forget to handle loading state cleanup

---

## 🐛 Troubleshooting

### Logo Not Showing

**Problem:** Logo tidak muncul di loading screen

**Solutions:**
1. Check `/api/app-info` returns logo data
2. Verify logo uploaded di admin settings
3. Check browser console for errors
4. Clear browser cache

**Debug:**
```jsx
useEffect(() => {
  api.get('/app-info').then(({ data }) => {
    console.log('Logo data:', data.logo ? 'Present' : 'Missing');
  });
}, []);
```

### Infinite Loading

**Problem:** Loading screen tidak hilang

**Solutions:**
1. Ensure `setLoading(false)` dipanggil
2. Add timeout fallback
3. Check API request completion
4. Verify error handling

**Fix:**
```jsx
useEffect(() => {
  const timeout = setTimeout(() => {
    setLoading(false); // Fallback after 10s
  }, 10000);

  fetchData().finally(() => {
    clearTimeout(timeout);
    setLoading(false);
  });

  return () => clearTimeout(timeout);
}, []);
```

### Slow Logo Loading

**Problem:** Logo load lambat

**Solutions:**
1. Optimize logo file size (compress image)
2. Use WebP format untuk better compression
3. Implement logo caching
4. Consider CDN untuk logo storage

---

## 📊 Component Comparison

| Feature | FullPageLoader | LoadingScreen | InlineLoader | PageLoader |
|---------|---------------|---------------|--------------|------------|
| Dynamic Logo | ✅ | ✅ | ✅ | ❌ |
| Full Screen | ✅ | ✅ (variant) | ❌ | ❌ |
| School Name | ✅ | ✅ | ✅ | ❌ |
| Animated Spinner | ✅ | ✅ | ✅ | ✅ |
| Animated Dots | ✅ | ✅ | ✅ | ❌ |
| Gradient BG | ✅ | ✅ | ❌ | ❌ |
| Inline Use | ❌ | ✅ (variant) | ✅ | ✅ |

**Recommendation:**
- **Full Page:** Use `FullPageLoader`
- **Inline:** Use `InlineLoader`
- **Simple:** Use `PageLoader`

---

## 🔄 Future Enhancements

Potential improvements:

1. **Global Logo State**
   - Redux/Context untuk share logo across components
   - Reduce API calls

2. **Logo Cache in localStorage**
   - Cache logo base64 locally
   - Update when logo changes

3. **Progressive Loading**
   - Show skeleton first
   - Load logo progressively

4. **Customizable Colors**
   - Allow theme-based spinner colors
   - Match school branding

5. **Loading Progress**
   - Progress bar for long operations
   - Percentage display

---

## 📚 Related Files

- `frontend/src/components/ui/page-loader.jsx` - Main FullPageLoader
- `frontend/src/components/ui/LoadingScreen.js` - Alternative LoadingScreen
- `frontend/src/components/PublicPageGuard.jsx` - Usage example
- `frontend/src/pages/admin/AdminSettingsPage.js` - Logo upload
- `backend/routers/app_info.py` - Logo API endpoint

---

**Last Updated:** 2026-08-10
**Version:** 1.0
**Author:** Development Team
