# Panduan Implementasi Frontend v1.1.1

**Status:** Backend Complete ✅ | Frontend Pending ⏳

## Backend Yang Sudah Selesai

### 1. Schedule API (Jadwal Berkelompok)
- ✅ POST `/schedules` - accept `slot_indexes: [1,2,3]`
- ✅ PUT `/schedules/{sid}` - accept `slot_indexes`
- ✅ GET `/schedules/conflict-check` - check overlap untuk slot berkelompok
- ✅ Auto-assign `room_id` dari `class_id`

**Request Example:**
```json
{
  "class_id": "class-123",
  "subject_id": "subj-456",
  "teacher_id": "teacher-789",
  "day": "senin",
  "slot_indexes": [1, 2, 3],  // Jam ke-2, 3, 4
  "start_time": "07:45",
  "end_time": "09:15",
  "semester_id": "sem-2024-ganjil"
  // room_id akan auto-assigned dari class
}
```

### 2. RKAM Public API (Dual Budget)
- ✅ GET `/public/rkam/budget-items` - dengan dual budget columns
- ✅ GET `/public/rkam/documents` - list dokumen public

**Response Example:**
```json
{
  "items": [
    {
      "nama": "Renovasi Lab Komputer",
      "kategori": "pembangunan",
      "bidang": "sarana_prasarana",
      "sumber_dana_bos": 50000000,
      "sumber_dana_komite": 25000000,
      "dialokasikan_bos": 50000000,
      "dialokasikan_komite": 25000000,
      "realisasi_bos": 40000000,
      "realisasi_komite": 20000000,
      "sisa_bos": 10000000,
      "sisa_komite": 5000000,
      "triwulan": "Q2",
      "status": "80.0%"
    }
  ],
  "summary": {
    "total_bos": 500000000,
    "total_komite": 250000000,
    "total_allocated": 750000000,
    "total_realized": 600000000,
    "persentase_serapan": "80.0%"
  }
}
```

## Frontend Yang Perlu Diimplementasi

### 1. Public RKAM Page Update

**File:** `frontend/src/pages/PublicRKAMPage.js`

**Changes:**

1. Update fetchData function untuk gunakan endpoint baru:
```javascript
const fetchData = async () => {
  try {
    setLoading(true);

    // Gunakan endpoint baru
    const budgetRes = await axios.get(`${API_BASE}/public/rkam/budget-items`, {
      params: {
        fiscal_year: fiscalYear,
        quarter: filterQuarter || undefined
      }
    });

    // Struktur response berbeda
    const { items, summary } = budgetRes.data;
    setBudgetItems(items);
    setSummary(summary);

    // Dokumen
    const docsRes = await axios.get(`${API_BASE}/public/rkam/documents`, {
      params: { fiscal_year: fiscalYear }
    });
    setDocuments(docsRes.data.documents || []);

  } catch (error) {
    console.error('Error fetching RKAM data:', error);
  } finally {
    setLoading(false);
  }
};
```

2. Update render untuk tabel dengan kolom baru:
```jsx
<table className="w-full">
  <thead>
    <tr>
      <th>Nama</th>
      <th>Kategori</th>
      <th>Bidang</th>
      <th>Anggaran BOS</th>
      <th>Anggaran Komite</th>
      <th>Realisasi BOS</th>
      <th>Realisasi Komite</th>
      <th>Sisa BOS</th>
      <th>Sisa Komite</th>
      <th>Triwulan</th>
      <th>Serapan</th>
    </tr>
  </thead>
  <tbody>
    {budgetItems.map((item, idx) => (
      <tr key={idx}>
        <td>{item.nama}</td>
        <td>{item.kategori}</td>
        <td>{item.bidang}</td>
        <td>Rp {item.dialokasikan_bos.toLocaleString('id-ID')}</td>
        <td>Rp {item.dialokasikan_komite.toLocaleString('id-ID')}</td>
        <td>Rp {item.realisasi_bos.toLocaleString('id-ID')}</td>
        <td>Rp {item.realisasi_komite.toLocaleString('id-ID')}</td>
        <td>Rp {item.sisa_bos.toLocaleString('id-ID')}</td>
        <td>Rp {item.sisa_komite.toLocaleString('id-ID')}</td>
        <td>{item.triwulan}</td>
        <td>
          <Badge>{item.status}</Badge>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

3. Update widget summary (4 cards berjejer):
```jsx
<div className="grid grid-cols-4 gap-4 mb-6">
  <Card>
    <CardHeader>
      <CardTitle className="text-sm">Total BOS</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">
        Rp {summary.total_bos.toLocaleString('id-ID')}
      </div>
    </CardContent>
  </Card>

  <Card>
    <CardHeader>
      <CardTitle className="text-sm">Total Komite</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">
        Rp {summary.total_komite.toLocaleString('id-ID')}
      </div>
    </CardContent>
  </Card>

  <Card>
    <CardHeader>
      <CardTitle className="text-sm">Total Realisasi</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">
        Rp {summary.total_realized.toLocaleString('id-ID')}
      </div>
    </CardContent>
  </Card>

  <Card>
    <CardHeader>
      <CardTitle className="text-sm">Persentase Serapan</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-emerald-600">
        {summary.persentase_serapan}
      </div>
    </CardContent>
  </Card>
</div>
```

### 2. Admin RKAM Form Update

**File:** Cari file admin RKAM (likely `AdminRKAMPage.js` atau `BendaharaPage.js`)

**Changes:**

Tambahkan input fields untuk dual budget:

```jsx
<FormGroup>
  <Label>Anggaran Dialokasikan BOS</Label>
  <Input
    type="number"
    name="allocated_bos"
    value={formData.allocated_bos || 0}
    onChange={handleChange}
  />
</FormGroup>

<FormGroup>
  <Label>Anggaran Dialokasikan Komite</Label>
  <Input
    type="number"
    name="allocated_komite"
    value={formData.allocated_komite || 0}
    onChange={handleChange}
  />
</FormGroup>

<FormGroup>
  <Label>Realisasi BOS</Label>
  <Input
    type="number"
    name="realized_bos"
    value={formData.realized_bos || 0}
    onChange={handleChange}
  />
</FormGroup>

<FormGroup>
  <Label>Realisasi Komite</Label>
  <Input
    type="number"
    name="realized_komite"
    value={formData.realized_komite || 0}
    onChange={handleChange}
  />
</FormGroup>

{/* Auto-calculate totals */}
<div className="bg-slate-50 p-4 rounded">
  <div className="text-sm">
    <p>Total Dialokasikan: Rp {(
      (formData.allocated_bos || 0) +
      (formData.allocated_komite || 0)
    ).toLocaleString('id-ID')}</p>
    <p>Total Realisasi: Rp {(
      (formData.realized_bos || 0) +
      (formData.realized_komite || 0)
    ).toLocaleString('id-ID')}</p>
    <p>Sisa BOS: Rp {(
      (formData.allocated_bos || 0) - (formData.realized_bos || 0)
    ).toLocaleString('id-ID')}</p>
    <p>Sisa Komite: Rp {(
      (formData.allocated_komite || 0) - (formData.realized_komite || 0)
    ).toLocaleString('id-ID')}</p>
  </div>
</div>
```

### 3. Schedule Form - Multi-Slot Selector

**Konsep UI:**

```jsx
function ScheduleForm({ teachingSlots, selectedDay }) {
  const [selectedSlots, setSelectedSlots] = useState([]);

  const handleSlotToggle = (index) => {
    if (selectedSlots.includes(index)) {
      setSelectedSlots(selectedSlots.filter(i => i !== index));
    } else {
      setSelectedSlots([...selectedSlots, index].sort((a, b) => a - b));
    }
  };

  const handleSubmit = async () => {
    // Calculate start and end time dari selected slots
    const startTime = teachingSlots[selectedDay][selectedSlots[0]].start_time;
    const endTime = teachingSlots[selectedDay][selectedSlots[selectedSlots.length - 1]].end_time;

    const payload = {
      class_id: formData.class_id,
      subject_id: formData.subject_id,
      teacher_id: formData.teacher_id,
      day: selectedDay,
      slot_indexes: selectedSlots,
      start_time: startTime,
      end_time: endTime,
      semester_id: formData.semester_id,
      // JANGAN kirim room_id, biar auto-assign
    };

    await api.post('/schedules', payload);
  };

  return (
    <div>
      <Label>Pilih Jam Pelajaran (bisa lebih dari 1)</Label>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {teachingSlots[selectedDay]?.map((slot, index) => (
          <button
            key={index}
            type="button"
            className={`p-3 rounded border ${
              selectedSlots.includes(index)
                ? 'bg-blue-500 text-white border-blue-600'
                : 'bg-white border-slate-300'
            } ${slot.is_break ? 'opacity-50' : ''}`}
            onClick={() => !slot.is_break && handleSlotToggle(index)}
            disabled={slot.is_break}
          >
            <div className="font-semibold">{slot.name}</div>
            <div className="text-xs mt-1">
              {slot.start_time} - {slot.end_time}
            </div>
          </button>
        ))}
      </div>
      {selectedSlots.length > 0 && (
        <div className="mt-2 text-sm text-slate-600">
          Terpilih: Jam ke-{selectedSlots.map(i => i + 1).join(', ')}
          ({teachingSlots[selectedDay][selectedSlots[0]].start_time} - {teachingSlots[selectedDay][selectedSlots[selectedSlots.length - 1]].end_time})
        </div>
      )}
    </div>
  );
}
```

### 4. Public Monitoring - Grouped Display

**Konsep:**

Backend `/public/monitoring` masih return per-jam. Frontend perlu group by schedule yang consecutive:

```javascript
// Group consecutive schedules
function groupSchedules(schedules) {
  const groups = [];
  const sorted = [...schedules].sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  );

  let currentGroup = null;

  for (const schedule of sorted) {
    // Check if this schedule can be grouped with current
    if (currentGroup &&
        currentGroup.class_name === schedule.class_name &&
        currentGroup.subject_name === schedule.subject_name &&
        currentGroup.teacher_name === schedule.teacher_name &&
        currentGroup.end_time === schedule.start_time) {
      // Extend current group
      currentGroup.end_time = schedule.end_time;
      currentGroup.schedule_ids.push(schedule.schedule_id);
    } else {
      // Start new group
      if (currentGroup) groups.push(currentGroup);
      currentGroup = {
        ...schedule,
        schedule_ids: [schedule.schedule_id]
      };
    }
  }

  if (currentGroup) groups.push(currentGroup);
  return groups;
}

// Di component:
const groupedSchedules = groupSchedules(data?.classes || []);

// Render:
{groupedSchedules.map(group => (
  <Card key={group.schedule_ids.join('-')}>
    <h3>{group.class_name} - {group.room_name}</h3>
    <p>{group.subject_name} - {group.teacher_name}</p>
    <Badge>{group.start_time} - {group.end_time}</Badge>
    <StatusBadge status={group.jurnal_status} />
  </Card>
))}
```

## Testing Checklist

Setelah implementasi frontend:

- [ ] Test create schedule dengan multiple slots
- [ ] Verify room auto-assigned dari class
- [ ] Test conflict detection dengan slot berkelompok
- [ ] Test RKAM public page menampilkan dual budget
- [ ] Test RKAM dokumen muncul di public page
- [ ] Test admin RKAM form input dual budget
- [ ] Test public monitoring grouped display
- [ ] Test performance dan loading screens

## Deployment Notes

1. Build frontend: `npm run build`
2. Test di production environment
3. Monitor for errors di browser console
4. Check database seeding jika perlu migrate old data

## Migration Script (Optional)

Jika ada data lama yang perlu dimigrasikan:

```python
# backend/migrate_to_v1_1_1.py
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def migrate():
    client = AsyncIOMotorClient("mongodb://...")
    db = client.super_app_madrasah

    # 1. Migrate schedules: convert single slot_index to slot_indexes
    count = 0
    async for schedule in db.schedules.find({'slot_index': {'$exists': True, '$ne': None}}):
        if not schedule.get('slot_indexes'):
            await db.schedules.update_one(
                {'id': schedule['id']},
                {'$set': {'slot_indexes': [schedule['slot_index']]}}
            )
            count += 1
    print(f"Migrated {count} schedules")

    # 2. Migrate RKAM: split single budget to dual (BOS only)
    count = 0
    async for item in db.rkam_budget_items.find({}):
        if 'allocated_bos' not in item:
            await db.rkam_budget_items.update_one(
                {'id': item['id']},
                {'$set': {
                    'allocated_bos': item.get('allocated_amount', 0),
                    'allocated_komite': 0,
                    'realized_bos': item.get('realized_amount', 0),
                    'realized_komite': 0
                }}
            )
            count += 1
    print(f"Migrated {count} RKAM items")

if __name__ == '__main__':
    asyncio.run(migrate())
```

## Support & Issues

Jika ada masalah:
1. Check CHANGELOG_v1.1.1.md untuk detail teknis
2. Review backend logs untuk error
3. Check browser console untuk frontend errors
4. Pastikan API endpoints accessible (test dengan curl/Postman)
