<?php
/**
 * Plugin Name: Login lewat Super App
 * Plugin URI: https://github.com/KamaludinZ/super_app_madrasah/tree/main/docs/sso
 * Description: Pustakawan & anggota masuk SLiMS dari dashboard Super App tanpa login ulang (SSO tiket). Halaman penerima: index.php?p=superapp_sso
 * Version: 1.0.0
 * Author: Super App Madrasah
 */

// Halaman OPAC index.php?p=superapp_sso (nama halaman = label menu; tidak tampil di navigasi OPAC).
\SLiMS\Plugins::getInstance()->registerMenu('opac', 'superapp_sso', __DIR__ . '/masuk.php');
