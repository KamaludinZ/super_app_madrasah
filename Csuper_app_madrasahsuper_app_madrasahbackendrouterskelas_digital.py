
# ============================================================
# JURNAL KELAS - View journals for the class
# ============================================================
@router.get("/jurnal")
async def get_jurnal_kelas(user: Dict = Depends(get_current_user)):
    """Get jurnal mengajar untuk kelas ini."""

    if user.get('active_role') != 'kelas':
        raise HTTPException(status_code=403, detail="Hanya akun kelas yang dapat mengakses")

    class_id = user.get('class_id')
    semester_id = user.get('semester_id')

    if not class_id or not semester_id:
        raise HTTPException(status_code=400, detail="Class ID atau Semester ID tidak ditemukan")

    # Get all journals for this class
    journals = await db.journals.find({
        'class_id': class_id,
        'semester_id': semester_id
    }).sort('created_at', -1).limit(50).to_list(50)

    # Enrich with teacher and subject info
    for journal in journals:
        teacher_id = journal.get('teacher_id')
        subject_id = journal.get('subject_id')

        if teacher_id:
            teacher = await db.users.find_one({'id': teacher_id}, {'_id': 0, 'full_name': 1, 'username': 1})
            if teacher:
                journal['teacher_name'] = teacher.get('full_name') or teacher.get('username')

        if subject_id:
            subject = await db.subjects.find_one({'id': subject_id}, {'_id': 0, 'name': 1, 'code': 1})
            if subject:
                journal['subject_name'] = subject.get('name')
                journal['subject_code'] = subject.get('code')

    return {
        'class_id': class_id,
        'semester_id': semester_id,
        'journals': [serialize_doc(j) for j in journals]
    }


# ============================================================
# KEHADIRAN SISWA - View attendance for students in the class
# ============================================================
@router.get("/kehadiran")
async def get_kehadiran_kelas(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020, le=2100),
    user: Dict = Depends(get_current_user)
):
    """Get kehadiran siswa untuk kelas ini berdasarkan bulan dan tahun."""

    if user.get('active_role') != 'kelas':
        raise HTTPException(status_code=403, detail="Hanya akun kelas yang dapat mengakses")

    class_id = user.get('class_id')
    semester_id = user.get('semester_id')

    if not class_id or not semester_id:
        raise HTTPException(status_code=400, detail="Class ID atau Semester ID tidak ditemukan")

    # Get all students in this class
    students = await db.students.find({
        'class_id': class_id,
        'is_active': True
    }).to_list(None)

    # Get all journals for this class in the specified month/year
    from datetime import datetime
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)

    journals = await db.journals.find({
        'class_id': class_id,
        'semester_id': semester_id,
        'created_at': {'$gte': start_date, '$lt': end_date}
    }).to_list(None)

    # Get all attendance records for these journals
    journal_ids = [j.get('id') for j in journals]
    attendance_records = await db.attendance.find({
        'journal_id': {'$in': journal_ids}
    }).to_list(None)

    # Group attendance by student
    student_attendance = {}
    for student in students:
        student_id = student.get('id')
        student_attendance[student_id] = {
            'student_id': student_id,
            'student_name': student.get('full_name'),
            'nis': student.get('nis'),
            'hadir': 0,
            'sakit': 0,
            'izin': 0,
            'alpha': 0,
            'total': len(journals)
        }

    for record in attendance_records:
        student_id = record.get('student_id')
        status = record.get('status', 'alpha')

        if student_id in student_attendance:
            if status == 'hadir':
                student_attendance[student_id]['hadir'] += 1
            elif status == 'sakit':
                student_attendance[student_id]['sakit'] += 1
            elif status == 'izin':
                student_attendance[student_id]['izin'] += 1
            elif status == 'alpha':
                student_attendance[student_id]['alpha'] += 1

    return {
        'class_id': class_id,
        'semester_id': semester_id,
        'month': month,
        'year': year,
        'total_journals': len(journals),
        'students': list(student_attendance.values())
    }
