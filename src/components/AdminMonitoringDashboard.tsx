import React, { useEffect, useState, useRef } from 'react';
import {
  Building2,
  Check,
  Edit2,
  ExternalLink,
  FileSignature,
  LogOut,
  Moon,
  PenTool,
  Plus,
  Search,
  ShieldCheck,
  ShieldPlus,
  Sun,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  AdminProfile,
  INDONESIAN_MONTHS,
  MonthReportData,
  UnitKerja,
  UserSession,
  WorkerProfile,
} from '../types/report';
import { compressImageFile, loadMonthData } from '../utils/storage';
import { generateSampleSignatureDataUrl } from '../utils/sampleData';

interface AdminMonitoringDashboardProps {
  session: UserSession;
  admins: AdminProfile[];
  units: UnitKerja[];
  workers: WorkerProfile[];
  selectedYear: number;
  selectedMonth: number;
  darkMode: boolean;
  syncTick: number;
  driveSyncBar?: React.ReactNode;
  onToggleDarkMode: () => void;
  onChangeMonthYear: (year: number, month: number) => void;
  onSaveAdmins: (nextAdmins: AdminProfile[]) => Promise<void>;
  onSaveUnits: (nextUnits: UnitKerja[]) => Promise<void>;
  onSaveWorkers: (nextWorkers: WorkerProfile[]) => Promise<void>;
  onOpenWorkerReport: (workerId: string) => void;
  onLogout: () => void;
}

interface WorkerMonthSummary {
  filledDays: number;
  completedDays: number;
  avgProgress: number;
  lastUpdated: string;
}

export const AdminMonitoringDashboard: React.FC<
  AdminMonitoringDashboardProps
> = ({
  session,
  admins,
  units,
  workers,
  selectedYear,
  selectedMonth,
  darkMode,
  syncTick,
  driveSyncBar,
  onToggleDarkMode,
  onChangeMonthYear,
  onSaveAdmins,
  onSaveUnits,
  onSaveWorkers,
  onOpenWorkerReport,
  onLogout,
}) => {
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [workerStats, setWorkerStats] = useState<
    Record<string, WorkerMonthSummary>
  >({});

  // Modal State: Manage / Add / Delete Admins
  const [showAdminManagerModal, setShowAdminManagerModal] =
    useState<boolean>(false);
  const [newAdminNama, setNewAdminNama] = useState<string>('');
  const [newAdminNip, setNewAdminNip] = useState<string>('');
  const [newAdminJabatan, setNewAdminJabatan] = useState<string>(
    'Admin / Pengawas Pelaksana'
  );

  // Modal State: Add / Edit Unit Kerja (includes Mengetahui & Pengawas Signatures)
  const [unitModal, setUnitModal] = useState<{
    mode: 'add' | 'edit' | 'signatures';
    unit: UnitKerja;
  } | null>(null);

  // Modal State: Add / Edit Tenaga Kerja
  const [workerModal, setWorkerModal] = useState<{
    mode: 'add' | 'edit';
    worker: WorkerProfile;
  } | null>(null);

  // Delete Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'unit' | 'worker' | 'admin';
    id: string;
    name: string;
  } | null>(null);

  const mengetahuiSignInputRef = useRef<HTMLInputElement>(null);
  const pengawasSignInputRef = useRef<HTMLInputElement>(null);

  // Load monthly report summary for every worker whenever month, year, workers, or syncTick changes
  useEffect(() => {
    let active = true;
    async function fetchAllWorkerStats() {
      const statsMap: Record<string, WorkerMonthSummary> = {};
      for (const w of workers) {
        const mData: MonthReportData = await loadMonthData(
          selectedYear,
          selectedMonth,
          w.id
        );
        const days = Object.values(mData.days);
        const filled = days.filter(
          (d) =>
            d.tasks.length > 0 ||
            d.photos.length > 0 ||
            d.notes.trim() !== '' ||
            d.completed !== ''
        );
        const completedCount = filled.filter((d) => d.completed === 'Ya').length;
        const totalProg = filled.reduce((acc, d) => {
          if (d.completed === 'Ya') return acc + 100;
          return acc + (d.progress ?? 0);
        }, 0);
        const avgProgress =
          filled.length > 0 ? Math.round(totalProg / filled.length) : 0;

        statsMap[w.id] = {
          filledDays: filled.length,
          completedDays: completedCount,
          avgProgress,
          lastUpdated: mData.updatedAt,
        };
      }
      if (active) {
        setWorkerStats(statsMap);
      }
    }
    fetchAllWorkerStats();
    return () => {
      active = false;
    };
  }, [workers, selectedYear, selectedMonth, syncTick]);

  // Add new Admin handler
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminNama.trim() || !newAdminNip.trim()) return;
    const created: AdminProfile = {
      id: `admin-${Date.now()}`,
      nama: newAdminNama.trim(),
      nip: newAdminNip.trim(),
      jabatan: newAdminJabatan.trim() || 'Admin Monitoring',
    };
    await onSaveAdmins([...admins, created]);
    setNewAdminNama('');
    setNewAdminNip('');
    setNewAdminJabatan('Admin / Pengawas Pelaksana');
  };

  // Open modal to add new Unit Kerja
  const handleOpenAddUnit = () => {
    setUnitModal({
      mode: 'add',
      unit: {
        id: `unit-${Date.now()}`,
        namaUnit: '',
        kodeSingkat: '',
        lokasi: '',
        mengetahuiNama: '(Walesa Miduk Jayanto)',
        mengetahuiJabatan: 'Officer Reliability',
        mengetahuiSignDataUrl: generateSampleSignatureDataUrl('mengetahui'),
        pengawasPerusahaan: 'PT. Energi Duta Utama',
        pengawasNama: session.nama || 'Primazahra Agya Zaenal Mutaqin',
        pengawasJabatan: 'Pengawas Pelaksana Pekerjaan',
        pengawasSignDataUrl: null,
      },
    });
  };

  // Save Unit Kerja (Add or Edit or Signature update)
  const handleSaveUnitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitModal) return;
    const u = unitModal.unit;
    if (!u.namaUnit.trim()) return;

    const finalUnit: UnitKerja = {
      ...u,
      namaUnit: u.namaUnit.trim(),
      kodeSingkat: u.kodeSingkat.trim() || u.namaUnit.trim(),
    };

    const exists = units.some((item) => item.id === finalUnit.id);
    const nextUnits = exists
      ? units.map((item) => (item.id === finalUnit.id ? finalUnit : item))
      : [...units, finalUnit];

    await onSaveUnits(nextUnits);
    setUnitModal(null);
  };

  // Open modal to add new Tenaga Kerja
  const handleOpenAddWorker = (presetUnitId?: string) => {
    setWorkerModal({
      mode: 'add',
      worker: {
        id: `worker-${Date.now()}`,
        nama: '',
        nip: '',
        unitId: presetUnitId || units[0]?.id || '',
        divisi: 'SMT, KM & Risiko',
        jabatan: 'Technical Assistant',
        petugasSignDataUrl: null,
      },
    });
  };

  // Save Tenaga Kerja (Add or Edit)
  const handleSaveWorkerModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerModal) return;
    const w = workerModal.worker;
    if (!w.nama.trim() || !w.nip.trim()) return;

    const finalWorker: WorkerProfile = {
      ...w,
      nama: w.nama.trim(),
      nip: w.nip.trim(),
      divisi: w.divisi.trim() || 'SMT, KM & Risiko',
      jabatan: w.jabatan.trim() || 'Technical Assistant',
    };

    const exists = workers.some((item) => item.id === finalWorker.id);
    const nextWorkers = exists
      ? workers.map((item) => (item.id === finalWorker.id ? finalWorker : item))
      : [...workers, finalWorker];

    await onSaveWorkers(nextWorkers);
    setWorkerModal(null);
  };

  // Execute confirmed deletion of Unit Kerja, Tenaga Kerja, or Admin
  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'unit') {
      const remainingUnits = units.filter((u) => u.id !== deleteConfirm.id);
      await onSaveUnits(remainingUnits);
      if (remainingUnits.length > 0) {
        const fallbackUnitId = remainingUnits[0].id;
        const updatedWorkers = workers.map((w) =>
          w.unitId === deleteConfirm.id ? { ...w, unitId: fallbackUnitId } : w
        );
        await onSaveWorkers(updatedWorkers);
      }
    } else if (deleteConfirm.type === 'worker') {
      const remainingWorkers = workers.filter((w) => w.id !== deleteConfirm.id);
      await onSaveWorkers(remainingWorkers);
    } else if (deleteConfirm.type === 'admin') {
      const remainingAdmins = admins.filter((a) => a.id !== deleteConfirm.id);
      await onSaveAdmins(remainingAdmins);
    }
    setDeleteConfirm(null);
  };

  const handleUploadUnitSignature = async (
    field: 'mengetahuiSignDataUrl' | 'pengawasSignDataUrl',
    file?: File
  ) => {
    if (!file || !unitModal) return;
    try {
      const dataUrl = await compressImageFile(file, 450, 0.9);
      setUnitModal({
        ...unitModal,
        unit: {
          ...unitModal.unit,
          [field]: dataUrl,
        },
      });
    } catch (err) {
      console.error('Gagal mengunggah tanda tangan:', err);
    }
  };

  const filteredUnits = units.filter((u) =>
    unitFilter === 'ALL' ? true : u.id === unitFilter
  );

  // Global KPI totals
  const totalFilledReports = Object.values(workerStats).filter(
    (s) => s.filledDays > 0
  ).length;
  const overallAvgProgress =
    workers.length > 0
      ? Math.round(
          workers.reduce(
            (sum, w) => sum + (workerStats[w.id]?.avgProgress || 0),
            0
          ) / workers.length
        )
      : 0;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Top Bar Contract: 3 Zones */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3.5 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Title */}
        <div className="flex items-center gap-2 shrink-0">
          <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
            ENERGI DUTA UTAMA — ADMIN MONITORING
          </span>
        </div>

        {/* Zone 2: Info / Context */}
        <div className="hidden md:flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
          <span>
            Admin:{' '}
            <strong className="text-slate-900 dark:text-white">
              {session.nama}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">NIP: {session.nip}</span>
          <span aria-hidden="true">·</span>
          <span>
            Periode:{' '}
            <strong className="text-blue-700 dark:text-blue-400">
              {INDONESIAN_MONTHS[selectedMonth - 1]} {selectedYear}
            </strong>
          </span>
        </div>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
            title="Mode Terang / Gelap"
          >
            {darkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            Ganti Akun / Keluar
          </button>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Top Control & Summary Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Monitoring Laporan Pelaksanaan Seluruh Unit Kerja
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Data laporan harian dan tanda tangan Petugas Pelapor
                tersinkronisasi otomatis dari input masing-masing Tenaga Kerja.
              </p>
            </div>

            {/* Primary CRUD Buttons for Admin (Admin, Unit Kerja, Tenaga Kerja) */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowAdminManagerModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                <ShieldPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Kelola Admin ({admins.length})
              </button>

              <button
                type="button"
                onClick={handleOpenAddUnit}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-blue-600/30 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                Tambah Unit Kerja
              </button>

              <button
                type="button"
                onClick={() => handleOpenAddWorker()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors whitespace-nowrap shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                Tambah Tenaga Kerja
              </button>
            </div>
          </div>

          {/* Google Drive Database Sync Strip inside Admin Dashboard */}
          {driveSyncBar && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Seluruh perubahan Unit Kerja, Tenaga Kerja, Admin, Tanda Tangan,
                dan Laporan Harian disinkronkan ke Database Google Drive:
              </span>
              {driveSyncBar}
            </div>
          )}

          {/* 4-Column Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Total Unit Kerja
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
                {units.length} Unit
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Total Tenaga Kerja & Admin
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
                {workers.length} TK · {admins.length} Admin
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Tenaga Kerja Aktif Mengisi ({INDONESIAN_MONTHS[selectedMonth - 1]})
              </div>
              <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
                {totalFilledReports} / {workers.length}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Rata-rata Progress Semua Unit
              </div>
              <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-400 mt-1 tabular-nums">
                {overallAvgProgress}%
              </div>
            </div>
          </div>

          {/* Filter & Period Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            {/* Segmented Unit Filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setUnitFilter('ALL')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  unitFilter === 'ALL'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Semua Unit Kerja ({units.length})
              </button>
              {units.map((u) => {
                const count = workers.filter((w) => w.unitId === u.id).length;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setUnitFilter(u.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      unitFilter === u.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {u.kodeSingkat || u.namaUnit} ({count})
                  </button>
                );
              })}
            </div>

            {/* Right: Search Worker + Month/Year Period Selector */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama atau NIP..."
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <select
                value={selectedMonth}
                onChange={(e) =>
                  onChangeMonthYear(selectedYear, Number(e.target.value))
                }
                aria-label="Pilih Bulan Monitoring"
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {INDONESIAN_MONTHS.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) =>
                  onChangeMonthYear(Number(e.target.value), selectedMonth)
                }
                aria-label="Pilih Tahun Monitoring"
                className="px-2.5 py-1.5 text-xs font-mono font-semibold tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Unit Kerja Sections (Separated per Unit Kerja, Tenaga Kerja Split per Unit Kerja) */}
        <div className="space-y-6">
          {filteredUnits.map((unit) => {
            const unitWorkers = workers.filter((w) => {
              if (w.unitId !== unit.id) return false;
              if (!searchQuery.trim()) return true;
              const q = searchQuery.toLowerCase();
              return (
                w.nama.toLowerCase().includes(q) ||
                w.nip.toLowerCase().includes(q) ||
                w.divisi.toLowerCase().includes(q)
              );
            });

            return (
              <section
                key={unit.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
              >
                {/* Unit Header */}
                <div className="px-5 py-4 bg-slate-50/80 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        {unit.namaUnit}
                      </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{unit.lokasi || 'Unit Pembangkitan PLN IP'}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Mengetahui:{' '}
                        <strong className="text-slate-700 dark:text-slate-200">
                          {unit.mengetahuiNama}
                        </strong>{' '}
                        ({unit.mengetahuiJabatan})
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Pengawas:{' '}
                        <strong className="text-slate-700 dark:text-slate-200">
                          {unit.pengawasNama}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Unit Actions: Input TTD Mengetahui/Pengawas, Add Worker, Edit Unit, Delete Unit */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setUnitModal({ mode: 'signatures', unit: { ...unit } })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-600/30 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0"
                      title="Input atau ubah Tanda Tangan Mengetahui & Pengawas untuk Unit ini"
                    >
                      <FileSignature className="w-3.5 h-3.5" />
                      Input TTD Mengetahui & Pengawas
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenAddWorker(unit.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      + Tenaga Kerja
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setUnitModal({ mode: 'edit', unit: { ...unit } })
                      }
                      className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                      title="Edit Unit Kerja"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDeleteConfirm({
                          type: 'unit',
                          id: unit.id,
                          name: unit.namaUnit,
                        })
                      }
                      className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:text-red-600 hover:border-red-200"
                      title="Hapus Unit Kerja"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Workers Table inside this Unit Kerja */}
                {unitWorkers.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <Users className="w-6 h-6 text-slate-400 mx-auto" />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Belum ada tenaga kerja terdaftar pada unit kerja ini.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleOpenAddWorker(unit.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Tambah Tenaga Kerja Pertama
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/40 dark:bg-slate-900/40">
                          <th className="py-2.5 px-4 w-10 text-center">No.</th>
                          <th className="py-2.5 px-4">Nama Tenaga Kerja</th>
                          <th className="py-2.5 px-4">NIP</th>
                          <th className="py-2.5 px-4">Divisi & Jabatan</th>
                          <th className="py-2.5 px-4 text-center">
                            Hari Terisi ({INDONESIAN_MONTHS[selectedMonth - 1]})
                          </th>
                          <th className="py-2.5 px-4 text-center">
                            Rata-rata Progress
                          </th>
                          <th className="py-2.5 px-4">Status Tanda Tangan</th>
                          <th className="py-2.5 px-4 text-right">
                            Aksi & Laporan Harian
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
                        {unitWorkers.map((worker, idx) => {
                          const stat = workerStats[worker.id] || {
                            filledDays: 0,
                            completedDays: 0,
                            avgProgress: 0,
                            lastUpdated: '',
                          };

                          return (
                            <tr
                              key={worker.id}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-500">
                                {idx + 1}
                              </td>

                              <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                                {worker.nama}
                              </td>

                              <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                                {worker.nip}
                              </td>

                              <td className="py-3 px-4">
                                <div className="font-medium text-slate-800 dark:text-slate-200">
                                  {worker.divisi}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {worker.jabatan}
                                </div>
                              </td>

                              <td className="py-3 px-4 text-center font-mono tabular-nums">
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {stat.filledDays} hari
                                </span>
                                <span className="text-slate-400"> · </span>
                                <span className="text-emerald-700 dark:text-emerald-400">
                                  {stat.completedDays} selesai
                                </span>
                              </td>

                              <td className="py-3 px-4 text-center font-mono tabular-nums">
                                <div className="inline-flex items-center gap-2">
                                  <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-blue-600"
                                      style={{ width: `${stat.avgProgress}%` }}
                                    />
                                  </div>
                                  <span className="font-bold text-slate-800 dark:text-slate-200">
                                    {stat.avgProgress}%
                                  </span>
                                </div>
                              </td>

                              <td className="py-3 px-4 text-[11px] text-slate-600 dark:text-slate-300">
                                <span>
                                  Pelapor:{' '}
                                  <strong
                                    className={
                                      worker.petugasSignDataUrl
                                        ? 'text-emerald-700 dark:text-emerald-400'
                                        : 'text-amber-600'
                                    }
                                  >
                                    {worker.petugasSignDataUrl ? 'Sudah' : 'Belum'}
                                  </strong>
                                </span>
                                <span aria-hidden="true"> · </span>
                                <span>
                                  Mengetahui:{' '}
                                  <strong
                                    className={
                                      unit.mengetahuiSignDataUrl
                                        ? 'text-emerald-700 dark:text-emerald-400'
                                        : 'text-amber-600'
                                    }
                                  >
                                    {unit.mengetahuiSignDataUrl ? 'Sudah' : 'Belum'}
                                  </strong>
                                </span>
                                <span aria-hidden="true"> · </span>
                                <span>
                                  Pengawas:{' '}
                                  <strong
                                    className={
                                      unit.pengawasSignDataUrl
                                        ? 'text-emerald-700 dark:text-emerald-400'
                                        : 'text-amber-600'
                                    }
                                  >
                                    {unit.pengawasSignDataUrl ? 'Sudah' : 'Belum'}
                                  </strong>
                                </span>
                              </td>

                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => onOpenWorkerReport(worker.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors whitespace-nowrap shrink-0"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Buka Laporan & TTD
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setWorkerModal({
                                        mode: 'edit',
                                        worker: { ...worker },
                                      })
                                    }
                                    className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    title="Edit Data Tenaga Kerja"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDeleteConfirm({
                                        type: 'worker',
                                        id: worker.id,
                                        name: worker.nama,
                                      })
                                    }
                                    className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 hover:text-red-600 hover:border-red-200"
                                    title="Hapus Tenaga Kerja"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </main>

      {/* Modal 0: Kelola Admin (Tambah / Hapus Admin) */}
      {showAdminManagerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-xl rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Kelola Daftar Admin ({admins.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminManagerModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[82vh] overflow-y-auto">
              {/* Form Tambah Admin Baru */}
              <form
                onSubmit={handleAddAdmin}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3"
              >
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Tambah Admin Baru
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Nama Lengkap Admin
                    </label>
                    <input
                      type="text"
                      required
                      value={newAdminNama}
                      onChange={(e) => setNewAdminNama(e.target.value)}
                      placeholder="Contoh: Hendra Wijaya"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      NIP Admin
                    </label>
                    <input
                      type="text"
                      required
                      value={newAdminNip}
                      onChange={(e) => setNewAdminNip(e.target.value)}
                      placeholder="Contoh: 199104222019"
                      className="w-full px-3 py-1.5 text-xs font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-semibold mb-1">
                      Jabatan / Peran
                    </label>
                    <input
                      type="text"
                      value={newAdminJabatan}
                      onChange={(e) => setNewAdminJabatan(e.target.value)}
                      placeholder="Contoh: Pengawas Pelaksana Pekerjaan"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Admin
                  </button>
                </div>
              </form>

              {/* Tabel Daftar Admin */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Daftar Admin Terdaftar
                </div>
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500">
                        <th className="py-2 px-3">Nama Admin</th>
                        <th className="py-2 px-3">NIP</th>
                        <th className="py-2 px-3">Jabatan</th>
                        <th className="py-2 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {admins.map((adm) => (
                        <tr key={adm.id}>
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                            {adm.nama}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                            {adm.nip}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                            {adm.jabatan}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              disabled={admins.length <= 1}
                              onClick={() =>
                                setDeleteConfirm({
                                  type: 'admin',
                                  id: adm.id,
                                  name: adm.nama,
                                })
                              }
                              title={
                                admins.length <= 1
                                  ? 'Minimal harus ada 1 Admin aktif'
                                  : 'Hapus Admin'
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded disabled:opacity-35 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAdminManagerModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Add / Edit Unit Kerja & Input TTD Mengetahui / Pengawas */}
      {unitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-xl rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {unitModal.mode === 'add'
                  ? 'Tambah Unit Kerja Baru'
                  : unitModal.mode === 'signatures'
                  ? `Otorisasi Tanda Tangan Mengetahui & Pengawas — ${unitModal.unit.kodeSingkat}`
                  : 'Edit Data Unit Kerja & Pejabat'}
              </h3>
              <button
                type="button"
                onClick={() => setUnitModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveUnitModal}
              className="p-5 space-y-4 max-h-[82vh] overflow-y-auto"
            >
              {unitModal.mode !== 'signatures' && (
                <div className="space-y-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Nama Lengkap Unit Kerja
                    </label>
                    <input
                      type="text"
                      required
                      value={unitModal.unit.namaUnit}
                      onChange={(e) =>
                        setUnitModal({
                          ...unitModal,
                          unit: { ...unitModal.unit, namaUnit: e.target.value },
                        })
                      }
                      placeholder="Contoh: PT PLN Indonesia Power UBP Labuhan Angin"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Nama Singkat Unit (Baris Bawah TTD)
                      </label>
                      <input
                        type="text"
                        value={unitModal.unit.kodeSingkat}
                        onChange={(e) =>
                          setUnitModal({
                            ...unitModal,
                            unit: {
                              ...unitModal.unit,
                              kodeSingkat: e.target.value,
                            },
                          })
                        }
                        placeholder="Contoh: PLN IP UBP Labuhan Angin"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Lokasi Unit
                      </label>
                      <input
                        type="text"
                        value={unitModal.unit.lokasi}
                        onChange={(e) =>
                          setUnitModal({
                            ...unitModal,
                            unit: { ...unitModal.unit, lokasi: e.target.value },
                          })
                        }
                        placeholder="Contoh: Sumatera Utara"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Kolom Mengetahui (PLN Indonesia Power) */}
              <div className="space-y-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="text-xs font-bold text-blue-700 dark:text-blue-400">
                  Kolom Tanda Tangan Mengetahui (PT PLN Indonesia Power)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Nama Pejabat Mengetahui
                    </label>
                    <input
                      type="text"
                      value={unitModal.unit.mengetahuiNama}
                      onChange={(e) =>
                        setUnitModal({
                          ...unitModal,
                          unit: {
                            ...unitModal.unit,
                            mengetahuiNama: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Jabatan Pejabat Mengetahui
                    </label>
                    <input
                      type="text"
                      value={unitModal.unit.mengetahuiJabatan}
                      onChange={(e) =>
                        setUnitModal({
                          ...unitModal,
                          unit: {
                            ...unitModal.unit,
                            mengetahuiJabatan: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>

                {/* Upload TTD Mengetahui */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    {unitModal.unit.mengetahuiSignDataUrl ? (
                      <img
                        src={unitModal.unit.mengetahuiSignDataUrl}
                        alt="Preview TTD Mengetahui"
                        referrerPolicy="no-referrer"
                        className="h-12 w-28 object-contain bg-white border border-slate-200 rounded p-1"
                      />
                    ) : (
                      <div className="h-12 w-28 flex items-center justify-center bg-white border border-dashed border-slate-300 rounded text-[10px] text-slate-400">
                        Belum ada TTD
                      </div>
                    )}
                    <div className="text-xs">
                      <div className="font-semibold">Tanda Tangan Mengetahui</div>
                      <div className="text-[11px] text-slate-500">
                        Otomatis tampil di laporan Tenaga Kerja unit ini
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={mengetahuiSignInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleUploadUnitSignature(
                          'mengetahuiSignDataUrl',
                          e.target.files?.[0]
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() => mengetahuiSignInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setUnitModal({
                          ...unitModal,
                          unit: {
                            ...unitModal.unit,
                            mengetahuiSignDataUrl:
                              generateSampleSignatureDataUrl('mengetahui'),
                          },
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      title="Gunakan tanda tangan digital cepat"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      TTD Cepat
                    </button>
                    {unitModal.unit.mengetahuiSignDataUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setUnitModal({
                            ...unitModal,
                            unit: {
                              ...unitModal.unit,
                              mengetahuiSignDataUrl: null,
                            },
                          })
                        }
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Kolom Pengawas Pelaksana Pekerjaan (PT Energi Duta Utama) */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  Kolom Tanda Tangan Pengawas (PT. Energi Duta Utama)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Nama Pengawas Pelaksana
                    </label>
                    <input
                      type="text"
                      value={unitModal.unit.pengawasNama}
                      onChange={(e) =>
                        setUnitModal({
                          ...unitModal,
                          unit: {
                            ...unitModal.unit,
                            pengawasNama: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Jabatan Pengawas
                    </label>
                    <input
                      type="text"
                      value={unitModal.unit.pengawasJabatan}
                      onChange={(e) =>
                        setUnitModal({
                          ...unitModal,
                          unit: {
                            ...unitModal.unit,
                            pengawasJabatan: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>

                {/* Upload TTD Pengawas */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    {unitModal.unit.pengawasSignDataUrl ? (
                      <img
                        src={unitModal.unit.pengawasSignDataUrl}
                        alt="Preview TTD Pengawas"
                        referrerPolicy="no-referrer"
                        className="h-12 w-28 object-contain bg-white border border-slate-200 rounded p-1"
                      />
                    ) : (
                      <div className="h-12 w-28 flex items-center justify-center bg-white border border-dashed border-slate-300 rounded text-[10px] text-slate-400">
                        Belum ada TTD
                      </div>
                    )}
                    <div className="text-xs">
                      <div className="font-semibold">
                        Tanda Tangan Pengawas Pelaksana
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Otomatis tampil di laporan Tenaga Kerja unit ini
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={pengawasSignInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleUploadUnitSignature(
                          'pengawasSignDataUrl',
                          e.target.files?.[0]
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() => pengawasSignInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setUnitModal({
                          ...unitModal,
                          unit: {
                            ...unitModal.unit,
                            pengawasSignDataUrl:
                              generateSampleSignatureDataUrl('pengawas'),
                          },
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      title="Gunakan tanda tangan digital cepat"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      TTD Cepat
                    </button>
                    {unitModal.unit.pengawasSignDataUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setUnitModal({
                            ...unitModal,
                            unit: {
                              ...unitModal.unit,
                              pengawasSignDataUrl: null,
                            },
                          })
                        }
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setUnitModal(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Check className="w-4 h-4" />
                  Simpan Unit & Tanda Tangan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add / Edit Tenaga Kerja */}
      {workerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold">
                {workerModal.mode === 'add'
                  ? 'Tambah Tenaga Kerja Baru'
                  : 'Edit Data Tenaga Kerja'}
              </h3>
              <button
                type="button"
                onClick={() => setWorkerModal(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWorkerModal} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Nama Lengkap Tenaga Kerja
                </label>
                <input
                  type="text"
                  required
                  value={workerModal.worker.nama}
                  onChange={(e) =>
                    setWorkerModal({
                      ...workerModal,
                      worker: { ...workerModal.worker, nama: e.target.value },
                    })
                  }
                  placeholder="Contoh: Desi Natalia Gultom"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Nomor Induk Pegawai (NIP)
                </label>
                <input
                  type="text"
                  required
                  value={workerModal.worker.nip}
                  onChange={(e) =>
                    setWorkerModal({
                      ...workerModal,
                      worker: { ...workerModal.worker, nip: e.target.value },
                    })
                  }
                  placeholder="Contoh: 40920241363"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Unit Kerja Penempatan
                </label>
                <select
                  value={workerModal.worker.unitId}
                  onChange={(e) =>
                    setWorkerModal({
                      ...workerModal,
                      worker: { ...workerModal.worker, unitId: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.namaUnit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Divisi / Bidang
                  </label>
                  <input
                    type="text"
                    value={workerModal.worker.divisi}
                    onChange={(e) =>
                      setWorkerModal({
                        ...workerModal,
                        worker: {
                          ...workerModal.worker,
                          divisi: e.target.value,
                        },
                      })
                    }
                    placeholder="Contoh: SMT, KM & Risiko"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Jabatan (Di Blok TTD)
                  </label>
                  <input
                    type="text"
                    value={workerModal.worker.jabatan}
                    onChange={(e) =>
                      setWorkerModal({
                        ...workerModal,
                        worker: {
                          ...workerModal.worker,
                          jabatan: e.target.value,
                        },
                      })
                    }
                    placeholder="Contoh: Admin SMT, KM dan Risiko"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setWorkerModal(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Check className="w-4 h-4" />
                  Simpan Tenaga Kerja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <h3 className="text-base font-bold text-red-600">
              Hapus{' '}
              {deleteConfirm.type === 'unit'
                ? 'Unit Kerja'
                : deleteConfirm.type === 'admin'
                ? 'Admin'
                : 'Tenaga Kerja'}
              ?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Apakah Anda yakin ingin menghapus{' '}
              <strong>{deleteConfirm.name}</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
