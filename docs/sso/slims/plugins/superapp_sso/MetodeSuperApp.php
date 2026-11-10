<?php
/**
 * Metode autentikasi SLiMS untuk login lewat Super App.
 *
 * Tidak memeriksa password: identitas sudah dibuktikan Super App lewat tiket yang ditukar di masuk.php. Data sesi
 * dibentuk dengan setAdminData()/setMemberData() bawaan SLiMS (hak akses grup, 2FA, tanda buku, masa berlaku anggota),
 * sehingga hasilnya sama persis dengan login biasa.
 */

namespace SuperAppSso;

use SLiMS\Auth\Exception;
use SLiMS\Auth\Methods\Native;
use SLiMS\DB;

class MetodeSuperApp extends Native
{
    /** ID akun yang sudah dicocokkan masuk.php (diisi sebelum Validator::process). */
    public static ?int $idPustakawan = null;
    public static ?string $idAnggota = null;

    protected function adminAuthenticate()
    {
        $this->type = parent::LIBRARIAN_LOGIN;
        if (self::$idPustakawan === null) throw new Exception('Akun pustakawan tidak ditemukan.', 404);

        $user = DB::query(<<<SQL
        SELECT
            u.user_id as uid, u.username as uname, u.passwd,
            u.realname as realname, u.groups, u.user_image as upict, u.`2fa`, u.admin_template as template
            FROM user AS u
            WHERE u.user_id=?
        SQL, [self::$idPustakawan]);
        if ($user->count() < 1) throw new Exception('Akun pustakawan tidak ditemukan.', 404);

        $this->data = $user->first();
        $this->setAdminData();
        return $this;
    }

    protected function memberAuthenticate()
    {
        $this->type = parent::MEMBER_LOGIN;
        if (self::$idAnggota === null) throw new Exception('Data anggota tidak ditemukan.', 404);

        $member = DB::query(<<<SQL
            SELECT
                m.member_id as mid,
                m.member_name as m_name,
                m.mpasswd,
                m.inst_name as m_institution,
                m.member_email as m_email,
                m.expire_date as m_expire_date,
                m.register_date as m_register_date,
                m.is_pending as m_membership_pending,
                m.member_type_id as m_member_type_id,
                mt.member_type_name as m_member_type,
                mt.enable_reserve as m_can_reserve,
                mt.reserve_limit as m_reserve_limit,
                m.member_image as m_image
            FROM
                member AS m
                LEFT JOIN
                    mst_member_type AS mt ON m.member_type_id=mt.member_type_id
            WHERE m.member_id=?
        SQL, [self::$idAnggota]);
        if ($member->count() < 1) throw new Exception('Data anggota tidak ditemukan.', 404);

        $this->data = $member->first();
        $this->setMemberData();
        return $this;
    }
}
