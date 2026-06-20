import asyncio
from typing import Dict, List, Tuple
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re

GTK_ROLES = {
    'guru',
    'wali_kelas',
    'tenaga_kependidikan',
    'guru_piket',
    'guru_bk',
    'guru_tata_tertib',
    'guru_ekstrakurikuler',
}

SIMILARITY_FIELDS = [
    'full_name', 'nip_nuptk', 'email', 'phone', 'gender', 'birth_place', 'birth_date', 'address'
]

def norm_name(name: str) -> str:
    if not name:
        return ''
    s = str(name).lower().strip()
    s = re.sub(r'\b(drs?|h\.?|s\.?pd|m\.?pd|ir|ust\.?)\b', '', s)
    s = re.sub(r'[^a-z0-9\s]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def has_login(u: Dict) -> bool:
    return bool((u.get('username') or '').strip()) and bool((u.get('password_hash') or '').strip())

def completeness_score(u: Dict) -> int:
    score = sum(1 for f in SIMILARITY_FIELDS if u.get(f))
    if has_login(u):
        score += 5
    if (u.get('nip_nuptk') or '').strip():
        score += 3
    return score

def pick_primary(items: List[Dict]) -> Dict:
    # Prioritas: punya login -> punya NIP -> data paling lengkap
    return sorted(
        items,
        key=lambda x: (
            1 if has_login(x) else 0,
            1 if (x.get('nip_nuptk') or '').strip() else 0,
            completeness_score(x),
        ),
        reverse=True
    )[0]

def can_merge(a: Dict, b: Dict) -> bool:
    # Rule merge aman:
    # 1) NIP sama (jika keduanya ada), atau
    # 2) Nama normal sama + minimal satu field pendukung cocok / salah satu tanpa NIP
    nip_a = (a.get('nip_nuptk') or '').strip()
    nip_b = (b.get('nip_nuptk') or '').strip()
    name_a = norm_name(a.get('full_name') or '')
    name_b = norm_name(b.get('full_name') or '')

    if nip_a and nip_b and nip_a == nip_b:
        return True

    if not name_a or not name_b:
        return False

    if name_a == name_b:
        # jika salah satu kosong NIP, anggap kandidat kuat merge by name
        if not nip_a or not nip_b:
            return True

        # jika NIP beda tapi nama sama, perlu bukti pendukung
        support = 0
        for f in ['email', 'phone', 'birth_place', 'birth_date']:
            va = (a.get(f) or '').strip().lower()
            vb = (b.get(f) or '').strip().lower()
            if va and vb and va == vb:
                support += 1
        return support >= 1

    return False

def merge_docs(primary: Dict, dup: Dict) -> Dict:
    out = dict(primary)

    # gabung roles
    roles = set(out.get('roles') or [])
    roles.update(dup.get('roles') or [])
    out['roles'] = list(roles)

    # isi data kosong dari duplikat
    for f in SIMILARITY_FIELDS:
        if not out.get(f) and dup.get(f):
            out[f] = dup.get(f)

    # jika primary belum punya login, adopsi login dari duplikat
    if not has_login(out) and has_login(dup):
        out['username'] = dup.get('username')
        out['password_hash'] = dup.get('password_hash')
        out['is_active'] = dup.get('is_active', True)

    out['normalized_full_name'] = norm_name(out.get('full_name') or '')
    out['account_source'] = out.get('account_source') or dup.get('account_source') or 'master_gtk'
    return out

async def find_duplicate_groups(users: List[Dict]) -> List[List[Dict]]:
    # Graph clustering by can_merge
    n = len(users)
    visited = [False] * n
    groups = []

    for i in range(n):
        if visited[i]:
            continue
        stack = [i]
        comp_idx = []
        visited[i] = True
        while stack:
            cur = stack.pop()
            comp_idx.append(cur)
            for j in range(n):
                if visited[j]:
                    continue
                if can_merge(users[cur], users[j]):
                    visited[j] = True
                    stack.append(j)

        if len(comp_idx) > 1:
            groups.append([users[k] for k in comp_idx])

    return groups

async def main():
    mongo_url = os.getenv("MONGO_URL", "mongodb://admin:change-this-password@localhost:27017/super_app_madrasah?authSource=admin")
    db_name = os.getenv("DB_NAME", "super_app_madrasah")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    users = await db.users.find(
        {'roles': {'$in': list(GTK_ROLES)}},
        {'_id': 0}
    ).to_list(200000)

    groups = await find_duplicate_groups(users)

    total_groups = 0
    total_merged = 0
    total_removed = 0
    merge_logs: List[Tuple[str, str, int]] = []

    for items in groups:
        total_groups += 1
        primary = pick_primary(items)
        duplicates = [x for x in items if x.get('id') != primary.get('id')]
        merged = dict(primary)

        for d in duplicates:
            merged = merge_docs(merged, d)

        await db.users.update_one({'id': primary['id']}, {'$set': merged})
        total_merged += 1

        dup_ids = [d['id'] for d in duplicates if d.get('id')]
        if dup_ids:
            await db.users.delete_many({'id': {'$in': dup_ids}})
            total_removed += len(dup_ids)

        merge_logs.append((primary.get('full_name') or '', primary.get('id') or '', len(dup_ids)))

    # Quick post-check
    remaining_users = await db.users.find(
        {'roles': {'$in': list(GTK_ROLES)}},
        {'_id': 0}
    ).to_list(200000)
    rem_groups = await find_duplicate_groups(remaining_users)

    print({
        'duplicate_groups_before': total_groups,
        'merged_primary_records': total_merged,
        'removed_duplicate_records': total_removed,
        'duplicate_groups_after': len(rem_groups),
        'sample_merges': merge_logs[:20],
    })

    client.close()

if __name__ == "__main__":
    asyncio.run(main())
