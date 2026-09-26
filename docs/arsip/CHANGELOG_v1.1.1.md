# Changelog v1.1.1 - Perbaikan dan Peningkatan Fitur

**Release Date:** 2026-08-04
**Status:** In Progress - Perubahan Backend Parsial Selesai

## ✅ Perubahan Yang Sudah Selesai

### 1. Backend Models - Grouped Time Slots Support
- ✅ `ScheduleModel`: Ditambahkan field `slot_indexes: Optional[List[int]]` untuk mendukung jadwal berkelompok
- ✅ `JournalModel`: Ditambahkan field `slot_indexes: Optional[List[int]]` untuk jurnal berkelompok
- ✅ Backward compatible - field lama `slot_index` tetap ada sebagai deprecated
- **File:** `backend/models.py`

### 2. Schedule API - Auto Room Assignment
- ✅ POST `/schedules`: Auto-assign `room_id` dari `class_id` jika room_id tidak diisi
- ✅ Ruang otomatis mengikuti kelas, tidak perlu input manual
- **File:** `backend/routers/schedules.py` line 382-388

### 3. MongoDB Configuration
- ✅ Fixed MongoDB local connection dengan kredensial yang benar
- ✅ Docker Compose MongoDB sudah running
- **File:** `backend/.env`, `docker-compose.yml`

## 🚧 Perubahan Yang Perlu Dilanjutkan

### Phase 1: Jadwal & Jurnal Berkelompok

#### A. Backend API Updates (Prioritas TINGGI)

**1. Schedule CRUD - Support Grouped Slots**
- **File:** `backend/routers/schedules.py`
- **TODO:**
  ```python
  # Di PUT /schedules/{sid} - tambahkan auto-room logic yang sama
  # Di GET /schedules - enrich response dengan slot_indexes info
  # Update conflict detection untuk check overlapping slot_indexes
  ```

**2. Enhanced Conflict Detection**
- **File:** `backend/routers/schedules.py` - function `_find_conflicts()`
- **TODO:**
  ```python
  async def _find_conflicts(...):
      # Current: hanya cek start_time & end_time overlap
      # NEW: Jika schedule punya slot_indexes, cek overlap per-slot
      # Contoh: slot_indexes=[1,2,3] bentrok dengan [2,3,4] di slot 2 & 3

      for s in candidates:
          # Check if either schedule uses slot_indexes
          my_slots = payload.get('slot_indexes') or []
          their_slots = s.get('slot_indexes') or []

          if my_slots and their_slots:
              # Check if any slot index overlaps
              if set(my_slots) & set(their_slots):
                  overlapping.append(s)
          else:
              # Fallback to time-based overlap
              if _times_overlap(...):
                  overlapping.append(s)
  ```

**3. Journal APIs - Grouped Entry Support**
- **File:** `backend/routers/journals.py`
- **TODO:**
  ```python
  # POST /journals/create - saat create journal:
  # 1. Ambil slot_indexes dari schedule
  # 2. Save slot_indexes ke journal
  # 3. Check jangan buat duplicate journal untuk schedule yang sama

  # GET /journals/my-pending - group by schedule_id:
  # 1. Jika schedule punya slot_indexes [2,3,4], hanya tampilkan 1 jurnal
  # 2. Jurnal bisa diisi kapan saja dalam rentang jam tersebut
  ```

**4. Public Monitoring Endpoint - Grouped Display**
- **File:** `backend/routers/public.py` atau buat endpoint baru
- **TODO:**
  ```python
  @router.get("/public/monitoring")
  async def public_monitoring():
      # Get today's schedules
      # Group by (class_id, subject_id, teacher_id, consecutive slot_indexes)
      # Return format:
      # {
      #   "class_name": "8F",
      #   "subject": "Matematika",
      #   "teacher": "Siti M.",
      #   "room": "8F",
      #   "slot_labels": "Jam 2-4",
      #   "slot_indexes": [1,2,3],  # 0-indexed
      #   "start_time": "07:45",
      #   "end_time": "09:15",
      #   "status": "berlangsung",  # belum_mulai|berlangsung|terisi|belum_terisi
      #   "journal_id": "xxx" or null
      # }
  ```

#### B. Frontend Updates (Prioritas TINGGI)

**1. Schedule Form - Multi-Slot Selection**
- **Files:**
  - `frontend/src/pages/AdminSchedulePage.js` atau sejenisnya
  - `frontend/src/components/schedules/ScheduleForm.js` (jika ada)

- **TODO:**
  ```jsx
  // Ganti single slot select menjadi multi-select
  // Contoh UI: Checkbox list untuk memilih jam 2, 3, 4
  const [selectedSlots, setSelectedSlots] = useState([]);

  // Saat submit:
  const payload = {
      ...formData,
      slot_indexes: selectedSlots,  // [1, 2, 3]
      start_time: slots[selectedSlots[0]].start_time,
      end_time: slots[selectedSlots[selectedSlots.length-1]].end_time,
      // room_id: JANGAN kirim, biar backend auto-assign
  };
  ```

**2. Schedule Grid View - Day-Specific Slot Labels**
- **Files:** `frontend/src/pages/*Schedule*.js` (grid view component)
- **TODO:**
  ```jsx
  // Problem: "Jam ke-2" muncul berkali-kali tapi tidak jelas milik hari apa
  // Solution: Tampilkan "Jam ke-2 (Senin)", "Jam ke-2 (Selasa)", dst

  // Di render slot labels:
  {teachingSlots[day].map((slot, idx) => (
      <div key={idx}>
          {slot.name} ({dayLabel})  {/* e.g., "Jam ke-2 (Senin)" */}
      </div>
  ))}
  ```

**3. Public Monitoring Page - Grouped Schedule Display**
- **File:** `frontend/src/pages/PublicMonitoringPage.js`
- **TODO:**
  ```jsx
  // Tampilkan jadwal berkelompok, bukan per-jam
  // UI Card example:
  <Card>
      <h3>Kelas 8F - Ruang 8F</h3>
      <p>Matematika - Siti Masfiyah, S.Si</p>
      <Badge>Jam 2-4</Badge>  {/* bukan "Jam 2", "Jam 3", "Jam 4" terpisah */}
      <StatusBadge status={getStatus(schedule)}>
          {/* Belum Dimulai | Berlangsung | Terisi | Belum Terisi */}
      </StatusBadge>
  </Card>

  function getStatus(schedule) {
      const now = new Date();
      const start = parseTime(schedule.start_time);
      const end = parseTime(schedule.end_time);

      if (now < start) return 'belum_mulai';
      if (now >= start && now <= end && !schedule.journal_id) return 'berlangsung';
      if (schedule.journal_id) return 'terisi';
      if (now > end && !schedule.journal_id) return 'belum_terisi';
  }
  ```

**4. Journal Entry Form - Grouped Entry**
- **File:** `frontend/src/pages/*Journal*.js`
- **TODO:**
  ```jsx
  // Hanya tampilkan 1 form untuk rentang jam berkelompok
  // Contoh: Jam 2-4 = 1 form, bukan 3 form terpisah

  // Di journal list (pending):
  const groupedJournals = groupBySchedule(pendingJournals);

  {groupedJournals.map(group => (
      <JournalCard>
          <h4>Kelas {group.class_name}</h4>
          <p>{group.subject} - Jam {group.slot_label}</p>
          <Button onClick={() => fillJournal(group.schedule_id)}>
              Isi Jurnal
          </Button>
      </JournalCard>
  ))}
  ```

### Phase 2: RKAM Dual Budget System

#### A. Backend Updates

**1. RKAM Model - Dual Budget Fields**
- **File:** `backend/models.py`
- **TODO:**
  ```python
  class RKAMItemModel(BaseModel):
      # ... existing fields ...

      # OLD (single budget):
      # anggaran_dialokasikan: float = 0
      # realisasi: float = 0

      # NEW v1.1.1 (dual budget - BOS & Komite):
      anggaran_dialokasikan_bos: float = 0
      anggaran_dialokasikan_komite: float = 0
      realisasi_bos: float = 0
      realisasi_komite: float = 0
      sisa_bos: float = 0  # calculated
      sisa_komite: float = 0  # calculated

      # Computed fields
      total_anggaran: float = 0  # bos + komite
      total_realisasi: float = 0  # bos + komite
      persentase_serapan: float = 0  # (total_realisasi / total_anggaran) * 100
  ```

**2. RKAM APIs**
- **File:** `backend/routers/rkam.py`
- **TODO:**
  ```python
  # POST/PUT /rkam/items - accept dual budget fields
  # GET /rkam/items - calculate sisa_bos, sisa_komite
  # GET /public/rkam - return public-safe columns only
  ```

**3. Public RKAM Endpoint - Table Display**
- **File:** `backend/routers/public.py`
- **TODO:**
  ```python
  @router.get("/public/rkam")
  async def public_rkam():
      items = await db.rkam_items.find({...}).to_list(1000)

      for item in items:
          item['sisa_bos'] = item['anggaran_dialokasikan_bos'] - item['realisasi_bos']
          item['sisa_komite'] = item['anggaran_dialokasikan_komite'] - item['realisasi_komite']
          item['total_anggaran'] = item['anggaran_dialokasikan_bos'] + item['anggaran_dialokasikan_komite']
          item['total_realisasi'] = item['realisasi_bos'] + item['realisasi_komite']
          item['persentase_serapan'] = (item['total_realisasi'] / item['total_anggaran'] * 100) if item['total_anggaran'] > 0 else 0

      # PUBLIC columns only (no 'kode', no 'aksi'):
      return [{
          'nama': item['nama'],
          'kategori': item['kategori'],
          'bidang': item['bidang'],
          'sumber_dana_bos': item['anggaran_dialokasikan_bos'],
          'sumber_dana_komite': item['anggaran_dialokasikan_komite'],
          'dialokasikan_bos': item['anggaran_dialokasikan_bos'],
          'dialokasikan_komite': item['anggaran_dialokasikan_komite'],
          'realisasi_bos': item['realisasi_bos'],
          'realisasi_komite': item['realisasi_komite'],
          'sisa_bos': item['sisa_bos'],
          'sisa_komite': item['sisa_komite'],
          'triwulan': item.get('triwulan'),
          'status': f"{item['persentase_serapan']:.1f}%"
      } for item in items]
  ```

#### B. Frontend Updates

**1. RKAM Public Page - Table View**
- **File:** `frontend/src/pages/PublicRKAMPage.js`
- **TODO:**
  ```jsx
  // Tampilkan tabel dengan kolom sesuai spesifikasi
  const publicColumns = [
      'Nama', 'Kategori', 'Bidang',
      'Sumber Dana BOS', 'Sumber Dana Komite',
      'Dialokasikan BOS', 'Dialokasikan Komite',
      'Realisasi BOS', 'Realisasi Komite',
      'Sisa BOS', 'Sisa Komite',
      'Triwulan', 'Status (% Serapan)'
  ];

  // Fix widget layout - 3 cards berjejer di sebelah kanan card Dana Komite
  <div className="grid grid-cols-4 gap-4">
      <WidgetCard title="Total BOS" value={...} />
      <WidgetCard title="Total Komite" value={...} />
      <WidgetCard title="Total Realisasi" value={...} />
      <WidgetCard title="Total Serapan" value={...} />
  </div>
  ```

**2. Admin RKAM Page - Full Columns**
- **Files:** `frontend/src/pages/AdminRKAMPage.js`, `BendaharaRKAMPage.js`
- **TODO:**
  ```jsx
  const adminColumns = [
      'Kode', 'Nama', 'Kategori', 'Bidang',
      'Sumber Dana BOS', 'Sumber Dana Komite',
      'Dialokasikan BOS', 'Dialokasikan Komite',
      'Realisasi BOS', 'Realisasi Komite',
      'Sisa BOS', 'Sisa Komite',
      'Triwulan', 'Status (% Serapan)', 'Aksi'
  ];
  ```

**3. RKAM Form - Dual Budget Input**
- **TODO:**
  ```jsx
  <FormGroup>
      <Label>Anggaran Dialokasikan BOS</Label>
      <Input type="number" name="anggaran_dialokasikan_bos" />
  </FormGroup>
  <FormGroup>
      <Label>Anggaran Dialokasikan Komite</Label>
      <Input type="number" name="anggaran_dialokasikan_komite" />
  </FormGroup>
  <FormGroup>
      <Label>Realisasi BOS</Label>
      <Input type="number" name="realisasi_bos" />
  </FormGroup>
  <FormGroup>
      <Label>Realisasi Komite</Label>
      <Input type="number" name="realisasi_komite" />
  </FormGroup>
  ```

**4. Fix RKAM Document Archives Not Showing**
- **File:** Check `backend/routers/rkam.py` dan `PublicRKAMPage.js`
- **TODO:**
  ```python
  # Backend: pastikan endpoint GET /public/rkam/documents mengembalikan list dokumen
  @router.get("/public/rkam/documents")
  async def get_public_rkam_documents():
      docs = await db.rkam_documents.find({'is_public': True}).to_list(100)
      return [serialize_doc(d) for d in docs]

  # Frontend: fetch dan tampilkan
  useEffect(() => {
      fetch('/api/public/rkam/documents')
          .then(res => res.json())
          .then(setDocuments);
  }, []);
  ```

### Phase 3: Settings & Optimization

#### A. Public Page Visibility Settings

**1. Settings Model Update**
- **File:** `backend/models.py` - `SettingsModel`
- **TODO:**
  ```python
  class PublicPageVisibility(BaseModel):
      rkam: Literal['public', 'hidden', 'dashboard'] = 'public'
      agenda: Literal['public', 'hidden', 'dashboard'] = 'public'
      prestasi: Literal['public', 'hidden', 'dashboard'] = 'public'
      monitoring: Literal['public', 'hidden', 'dashboard'] = 'public'

  class SettingsModel(BaseModel):
      # ... existing fields ...
      public_page_visibility: PublicPageVisibility = Field(default_factory=PublicPageVisibility)
  ```

**2. Admin Settings Page**
- **File:** `frontend/src/pages/AdminSettingsPage.js`
- **TODO:**
  ```jsx
  <FormSection title="Visibilitas Halaman Public">
      {['rkam', 'agenda', 'prestasi', 'monitoring'].map(page => (
          <FormGroup key={page}>
              <Label>{page.toUpperCase()}</Label>
              <Select name={`public_page_visibility.${page}`}>
                  <option value="public">Akses Terbuka (Public)</option>
                  <option value="hidden">Disembunyikan</option>
                  <option value="dashboard">Dashboard User (Login Required)</option>
              </Select>
          </FormGroup>
      ))}
  </FormSection>
  ```

**3. Route Guards Based on Settings**
- **Files:** Frontend routing files
- **TODO:**
  ```jsx
  // Fetch settings dan check visibility
  const settings = useSettings();

  // Di PublicRKAMPage:
  if (settings.public_page_visibility.rkam === 'hidden') {
      return <NotFound />;
  }
  if (settings.public_page_visibility.rkam === 'dashboard' && !user) {
      return <Redirect to="/login" />;
  }
  ```

#### B. Performance Optimization

**1. Add Loading Screens**
- **Files:** Semua halaman yang load data banyak
- **TODO:**
  ```jsx
  import LoadingSpinner from '../components/LoadingSpinner';

  function MyPage() {
      const [loading, setLoading] = useState(true);
      const [data, setData] = useState([]);

      useEffect(() => {
          setLoading(true);
          fetch('/api/data')
              .then(res => res.json())
              .then(data => {
                  setData(data);
                  setLoading(false);
              });
      }, []);

      if (loading) return <LoadingSpinner />;

      return <div>{/* render data */}</div>;
  }
  ```

**2. Optimize Data Fetching**
- **TODO:**
  - Implement pagination untuk list yang besar (schedules, journals, RKAM)
  - Add caching untuk data yang jarang berubah (settings, users list)
  - Use React.memo untuk component yang sering re-render
  - Lazy load components: `const AdminPage = lazy(() => import('./pages/AdminPage'))`

**3. Backend Query Optimization**
- **TODO:**
  ```python
  # Limit results, add pagination
  @router.get("/schedules")
  async def list_schedules(skip: int = 0, limit: int = 100):
      items = await db.schedules.find({}).skip(skip).limit(limit).to_list(limit)
      total = await db.schedules.count_documents({})
      return {'items': items, 'total': total, 'skip': skip, 'limit': limit}

  # Project only needed fields
  schedules = await db.schedules.find(
      {},
      {'_id': 0, 'id': 1, 'class_id': 1, 'teacher_id': 1}  # only these fields
  ).to_list(100)
  ```

## 📝 Migration Notes

### Database Migration (Optional but Recommended)

```python
# backend/migrate_to_v1_1_1.py
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def migrate():
    client = AsyncIOMotorClient("mongodb://admin:SuperStrongPassword2024!SecureMongo@localhost:27017")
    db = client.super_app_madrasah

    # Migrate schedules: convert slot_index to slot_indexes
    async for schedule in db.schedules.find({'slot_index': {'$exists': True, '$ne': None}}):
        if not schedule.get('slot_indexes'):
            await db.schedules.update_one(
                {'id': schedule['id']},
                {'$set': {'slot_indexes': [schedule['slot_index']]}}
            )

    # Migrate RKAM items: split budget into BOS and Komite
    async for item in db.rkam_items.find({}):
        if 'anggaran_dialokasikan_bos' not in item:
            total = item.get('anggaran_dialokasikan', 0)
            await db.rkam_items.update_one(
                {'id': item['id']},
                {'$set': {
                    'anggaran_dialokasikan_bos': total,
                    'anggaran_dialokasikan_komite': 0,
                    'realisasi_bos': item.get('realisasi', 0),
                    'realisasi_komite': 0
                }}
            )

    print("Migration completed!")

if __name__ == '__main__':
    asyncio.run(migrate())
```

## 🧪 Testing Checklist

### Schedule & Journal
- [ ] Create schedule dengan multiple slots (jam 2-4)
- [ ] Verify auto-room assignment dari class
- [ ] Test conflict detection dengan grouped slots
- [ ] Create journal untuk grouped schedule
- [ ] Verify journal hanya tampil 1x untuk grouped schedule
- [ ] Check public monitoring menampilkan grouped schedule

### RKAM
- [ ] Create RKAM item dengan dual budget (BOS + Komite)
- [ ] Verify perhitungan sisa dan persentase serapan
- [ ] Check public RKAM page tampilan tabel dengan kolom yang benar
- [ ] Upload dokumen RKAM dan verify muncul di public page
- [ ] Test admin/bendahara page dengan kolom lengkap

### Settings & Performance
- [ ] Set visibility public page (public/hidden/dashboard)
- [ ] Verify access control berdasarkan visibility setting
- [ ] Test loading screens muncul saat load data
- [ ] Check page load time < 2 detik
- [ ] Test dengan browser/device spesifikasi rendah

## 📦 Deployment Notes

1. **Backup database** sebelum deploy
2. Run migration script (optional)
3. Update frontend build
4. Restart backend service
5. Clear browser cache untuk user
6. Test semua fitur di production

## 🔄 Rollback Plan

Jika ada masalah:
1. Restore database dari backup
2. Checkout ke commit sebelumnya: `git checkout 713af05`
3. Rebuild dan redeploy
