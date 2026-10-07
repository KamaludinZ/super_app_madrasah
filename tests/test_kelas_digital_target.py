"""Sasaran materi/tugas per siswa (target_siswa) — format form guru & format lama."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from routers.kelas_digital import _siswa_target_query, _targets_student  # noqa: E402


def test_targets_student_all_in_class_and_listed_ids():
    doc = {'target_siswa': [{'class_id': 'c1', 'student_ids': 'all'}, {'class_id': 'c2', 'student_ids': ['s9']}]}
    assert _targets_student(doc, 's1', 'c1')            # semua siswa kelas c1
    assert not _targets_student(doc, 's1', 'c3')        # kelas lain
    assert _targets_student(doc, 's9', 'c2')            # disebut namanya
    assert not _targets_student(doc, 's8', 'c2')


def test_targets_student_legacy_flat_ids():
    assert _targets_student({'target_siswa': ['s1', 's2']}, 's2', None)
    assert not _targets_student({'target_siswa': []}, 's2', 'c1')
    assert not _targets_student({}, 's2', 'c1')


def test_siswa_target_query_shapes():
    q = _siswa_target_query('s1', 'c1')['$or']
    assert {'target_siswa': 's1'} in q
    assert {'target_siswa': {'$elemMatch': {'student_ids': 's1'}}} in q
    assert {'target_siswa': {'$elemMatch': {'class_id': 'c1', 'student_ids': 'all'}}} in q
    assert len(_siswa_target_query('s1', None)['$or']) == 2
