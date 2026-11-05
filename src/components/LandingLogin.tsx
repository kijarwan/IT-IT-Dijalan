import React, { useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileCheck2,
  Moon,
  ShieldCheck,
  Sun,
  UserCheck,
} from 'lucide-react';
import {
  AdminProfile,
  UnitKerja,
  UserRole,
  UserSession,
  WorkerProfile,
} from '../types/report';

interface LandingLoginProps {
  admins: AdminProfile[];
  units: UnitKerja[];
  workers: WorkerProfile[];
  darkMode: boolean;
  driveSyncBar?: React.ReactNode;
  onToggleDarkMode: () => void;
  onLogin: (
    session: UserSession,
    newWorkerIfCreated?: WorkerProfile,
    newAdminIfCreated?: AdminProfile
  ) => void;
}

export const LandingLogin: React.FC<LandingLoginProps> = ({
  admins,
  units,
  workers,
  darkMode,
  driveSyncBar,
  onToggleDarkMode,
  onLogin,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('worker');
  const [nama, setNama] = useState<string>('Desi Natalia Gultom');
  const [nip, setNip] = useState<string>('40920241363');
  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    units[0]?.id || 'unit-labuhan-angin'
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRoleSwitch = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMsg(null);
    if (role === 'admin') {
      const firstAdmin = admins[0];
      if (firstAdmin) {
        setNama(firstAdmin.nama);
        setNip(firstAdmin.nip);
      } else {
        setNama('Primazahra Agya Zaenal Mutaqin');
        setNip('199008152018');
      }
    } else {
      const firstWorker = workers[0];
      if (firstWorker) {
        setNama(firstWorker.nama);
        setNip(firstWorker.nip);
        setSelectedUnitId(firstWorker.unitId);
      } else {
        setNama('Desi Natalia Gultom');
        setNip('40920241363');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNama = nama.trim();
    const cleanNip = nip.trim();

    if (!cleanNama || !cleanNip) {
      setErrorMsg('Harap isi Nama Lengkap dan NIP terlebih dahulu.');
      return;
    }

    if (selectedRole === 'admin') {
      const matchedAdmin = admins.find(
        (a) =>
          a.nama.trim().toLowerCase() === cleanNama.toLowerCase() &&
          a.nip.trim().toLowerCase() === cleanNip.toLowerCase()
      );
      if (!matchedAdmin) {
        setErrorMsg(
          'Login ditolak: Nama Lengkap atau NIP Admin salah / tidak terdaftar.'
        );
        return;
      }
      onLogin({
        role: 'admin',
        nama: matchedAdmin.nama,
        nip: matchedAdmin.nip,
        loginAt: new Date().toISOString(),
      });
      return;
    }

    // Role === 'worker': Both Nama Lengkap AND NIP must match a registered WorkerProfile
    const matchedWorker = workers.find(
      (w) =>
        w.nama.trim().toLowerCase() === cleanNama.toLowerCase() &&
        w.nip.trim().toLowerCase() === cleanNip.toLowerCase()
    );

    if (!matchedWorker) {
      setErrorMsg(
        'Login ditolak: Nama Lengkap atau NIP Tenaga Kerja salah / belum terdaftar.'
      );
      return;
    }

    onLogin({
      role: 'worker',
      nama: matchedWorker.nama,
      nip: matchedWorker.nip,
      workerId: matchedWorker.id,
      loginAt: new Date().toISOString(),
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors">
      {/* Top Bar Contract: 3 Zones (Brand, Nav Links, Primary Action) */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          ENERGI DUTA UTAMA
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <a
            href="#peran"
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Hak Akses Peran
          </a>
          <a
            href="#unit-kerja"
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Unit Kerja PLN IP
          </a>
          <a
            href="#sinkronisasi"
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Sinkronisasi Data
          </a>
        </nav>

        {/* Zone 3: 1 primary action (Theme toggle) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            {darkMode ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                Mode Terang
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-600" />
                Mode Gelap
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Split Section: Left Editorial Info + Right Login Card */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-6 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        {/* Left Column (7 cols): Portal Overview & 2 Point of View Explanation */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-8">
          <div className="space-y-5">
            <h1
              className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]"
              style={{ textWrap: 'balance' }}
            >
              Portal Laporan Pelaksanaan Harian Technical Assistant
            </h1>

            <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              Sistem pencatatan harian dan rekapitulasi laporan bulanan
              terintegrasi antara Tenaga Kerja pelaksana dan Admin pengawas di
              seluruh Unit Bisnis Pembangkitan (UBP) PT PLN Indonesia Power.
            </p>
          </div>

          {/* 2 Point of View Breakdown */}
          <div
            id="peran"
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2"
          >
            {/* POV 1: Admin */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                  01. Point of View Admin
                </span>
                <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Monitoring Seluruh Unit Kerja
              </h2>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Menambahkan, mengedit, dan menghapus{' '}
                    <strong>Unit Kerja</strong>, <strong>Tenaga Kerja</strong>,
                    serta <strong>Admin</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Monitoring progress laporan harian yang dipisahkan per Unit
                    Kerja
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Otorisasi tanda tangan pada kolom{' '}
                    <strong>Mengetahui</strong> dan{' '}
                    <strong>Pengawas Pelaksana Pekerjaan</strong>
                  </span>
                </li>
              </ul>
            </div>

            {/* POV 2: Tenaga Kerja */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  02. Point of View Tenaga Kerja
                </span>
                <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Input Laporan Harian Langsung
              </h2>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Langsung diarahkan ke lembar kerja A4 laporan harian milik
                    tenaga kerja
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Input uraian tugas, unggah foto dokumentasi, dan update
                    progress harian
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Khusus mengisi tanda tangan{' '}
                    <strong>Petugas Pelapor</strong> (sinkron otomatis ke Admin)
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Active Units & Google Drive Database Strip */}
          <div
            id="unit-kerja"
            className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3 text-xs text-slate-600 dark:text-slate-400"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-500" />
                <span>
                  Terdaftar:{' '}
                  <strong className="text-slate-900 dark:text-white tabular-nums">
                    {units.length} Unit Kerja
                  </strong>{' '}
                  ·{' '}
                  <strong className="text-slate-900 dark:text-white tabular-nums">
                    {workers.length} Tenaga Kerja
                  </strong>{' '}
                  ·{' '}
                  <strong className="text-slate-900 dark:text-white tabular-nums">
                    {admins.length} Admin
                  </strong>
                </span>
              </div>
              <div id="sinkronisasi" className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                <span>
                  Database Terpusat di Google Drive (Otomatis Sinkron)
                </span>
              </div>
            </div>

            {driveSyncBar && (
              <div className="pt-1">{driveSyncBar}</div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Login Form Card */}
        <div className="lg:col-span-5 flex flex-col justify-center">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg p-6 sm:p-7 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Masuk ke Sistem Laporan
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Pilih sudut pandang (Point of View) serta masukkan Nama dan NIP
                Anda.
              </p>
            </div>

            {/* Segmented Role Selector: 1. Tenaga Kerja | 2. Admin */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Pilih Peran / Point of View
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => handleRoleSwitch('worker')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    selectedRole === 'worker'
                      ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  Tenaga Kerja
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleSwitch('admin')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    selectedRole === 'admin'
                      ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Admin Monitoring
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Field 1: Nama */}
              <div>
                <label
                  htmlFor="login-nama"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  1. Nama Lengkap
                </label>
                <input
                  id="login-nama"
                  type="text"
                  required
                  value={nama}
                  onChange={(e) => {
                    setNama(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder={
                    selectedRole === 'admin'
                      ? 'Masukkan Nama Admin...'
                      : 'Masukkan Nama Tenaga Kerja...'
                  }
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Field 2: NIP */}
              <div>
                <label
                  htmlFor="login-nip"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  2. Nomor Induk Pegawai (NIP)
                </label>
                <input
                  id="login-nip"
                  type="text"
                  required
                  value={nip}
                  onChange={(e) => {
                    setNip(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder={
                    selectedRole === 'admin'
                      ? 'Masukkan NIP Admin...'
                      : 'Masukkan NIP Tenaga Kerja...'
                  }
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-xs font-medium text-red-700 dark:text-red-300"
                >
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
              >
                <span>
                  {selectedRole === 'admin'
                    ? 'Masuk ke Monitoring Semua Unit Kerja'
                    : 'Masuk ke Laporan Harian Tenaga Kerja'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <span>
          PT Energi Duta Utama — Sistem Laporan Pelaksanaan Harian Technical
          Assistant
        </span>
        <span>Terintegrasi di Seluruh Unit Kerja PT PLN Indonesia Power</span>
      </footer>
    </div>
  );
};
