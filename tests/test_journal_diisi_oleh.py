"""Label kolom "diisi oleh" riwayat jurnal (tanpa MongoDB)."""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from routers.journals import diisi_oleh_label  # noqa: E402


@pytest.mark.parametrize('journal,expected', [
    ({'fill_mode': 'substitute', 'filled_by_name': 'Budi'}, 'pengganti: Budi'),
    ({'fill_mode': 'piket', 'filled_by_name': 'Ani'}, 'piket: Ani'),
    ({'fill_mode': 'admin', 'filled_by_name': 'Admin TU'}, 'admin: Admin TU'),
    ({'fill_mode': 'self', 'filled_by_name': 'Siti'}, 'Siti'),
    ({'teacher_name': 'Hasan'}, 'Hasan'),
    ({'fill_mode': 'substitute'}, 'pengganti: -'),
])
def test_diisi_oleh_label(journal, expected):
    assert diisi_oleh_label(journal) == expected


def test_group_side_by_side_orders_pairs_original_first():
    from routers.journals import group_side_by_side
    items = [
        {'id': 's', 'fill_mode': 'substitute', 'substitute_assignment_id': 'A'},
        {'id': 'x', 'fill_mode': 'self'},
        {'id': 'o', 'fill_mode': 'self', 'replaced_assignment_id': 'A'},
        {'id': 'y', 'fill_mode': 'substitute', 'substitute_assignment_id': 'B'},
    ]
    out = group_side_by_side(items)
    assert [j['id'] for j in out] == ['o', 's', 'x', 'y']
    assert [j.get('pair_position') for j in out] == ['first', 'second', None, None]
    assert out[3]['pair_key'] == 'B'
