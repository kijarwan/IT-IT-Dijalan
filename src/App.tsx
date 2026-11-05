import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertCircle,
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  FileDown,
  FileSpreadsheet,
  FileText,
  FolderUp,
  Loader2,
  LogOut,
  Moon,
  Printer,
  ShieldCheck,
  Sun,
  Trash2,
  UserCheck,
} from 'lucide-react';
import {
  AdminProfile,
  DayEntry,
  FullDatabaseBackup,
  INDONESIAN_MONTHS,
  MonthReportData,
  ReportMetadata,
  UnitKerja,
  UserSession,
  WorkerProfile,
} from './types/report';
import {
  clearSampleDataAndReset,
  exportFullBackup,
  importFullBackup,
  loadAdmins,
  loadMetadata,
  loadMonthData,
  loadUnits,
  loadWorkers,
  saveAdmins,
  saveMetadata,
  saveMonthData,
  saveUnits,
  saveWorkers,
  subscribeDataSync,
} from './utils/storage';
import {
  buildWorkerReportMetadata,
  getDefaultAdmins,
  getDefaultMetadata,
  getDefaultUnits,
  getDefaultWorkers,
} from './utils/sampleData';
import {
  exportMonthToCSV,
  exportMonthToExcel,
  exportMonthToPDF,
} from './utils/exportReport';
import {
  DRIVE_BACKUP_FILENAME,
  DriveBackupFileMeta,
  downloadBackupFromGoogleDrive,
  findDriveBackupFile,
  googleSignIn,
  initAuth,
  logout,
  syncBackupToGoogleDrive,
} from './services/googleDriveSync';
import { EnergiLogo } from './components/EnergiLogo';
import { SignatureBlock } from './components/SignatureBlock';
import { DailyReportModal } from './components/DailyReportModal';
import {
  ConfirmActionModal,
  ConfirmDialogState,
} from './components/ConfirmActionModal';
import { LandingLogin } from './components/LandingLogin';
import { AdminMonitoringDashboard } from './components/AdminMonitoringDashboard';
import { GoogleDriveDatabaseBar } from './components/GoogleDriveDatabaseBar';

const SESSION_STORAGE_KEY = 'laporan_ta_active_session_v1';

export default function App() {
  // Active login session (null = show LandingLogin)
  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as UserSession) : null;
    } catch {
      return null;
    }
  });

  // For Admin: 'dashboard' (monitoring all units) or 'worker-report' (inspecting/signing a worker's A4 report)
  const [adminViewMode, setAdminViewMode] = useState<
    'dashboard' | 'worker-report'
  >('dashboard');

  // Master data: Admins, Units & Workers
  const [admins, setAdmins] = useState<AdminProfile[]>(() =>
    getDefaultAdmins()
  );
  const [units, setUnits] = useState<UnitKerja[]>(() => getDefaultUnits());
  const [workers, setWorkers] = useState<WorkerProfile[]>(() =>
    getDefaultWorkers()
  );
  const [globalMeta, setGlobalMeta] = useState<ReportMetadata>(() =>
    getDefaultMetadata()
  );

  // Active worker whose A4 report is currently open
  const [activeWorkerId, setActiveWorkerId] = useState<string>('worker-1');

  // Default to April 2026 as specified in the user request ("Bulan dan tahun : April 2026")
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(4); // 4 = April
  const [monthData, setMonthData] = useState<MonthReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [syncTick, setSyncTick] = useState<number>(0);

  // Dark mode for UI outside the A4 paper
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Active row modal editing
  const [editingDayNumber, setEditingDayNumber] = useState<number | null>(null);
  // Highlighted "today" day number on screen
  const [highlightedDay, setHighlightedDay] = useState<number>(() => {
    const now = new Date();
    return now.getDate();
  });

  // Autosave indicator state
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');

  // Export busy state
  const [exportingType, setExportingType] = useState<
    'pdf' | 'excel' | 'csv' | null
  >(null);

  // Google Drive Auth & Sync states
  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [driveSyncStatus, setDriveSyncStatus] = useState<
    'idle' | 'syncing' | 'synced' | 'error'
  >('idle');
  const [driveSyncMessage, setDriveSyncMessage] = useState<string>('');
  const [driveFileMeta, setDriveFileMeta] =
    useState<DriveBackupFileMeta | null>(null);
  const [autoSyncDriveApproved, setAutoSyncDriveApproved] =
    useState<boolean>(false);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] =
    useState<ConfirmDialogState | null>(null);

  // Toast / status alert banner
  const [toastBanner, setToastBanner] = useState<{
    type: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);

  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const jsonRestoreInputRef = useRef<HTMLInputElement>(null);

  const showToast = (
    type: 'info' | 'success' | 'error',
    text: string,
    durationMs = 4500
  ) => {
    setToastBanner({ type, text });
    if (durationMs > 0) {
      setTimeout(() => {
        setToastBanner((prev) => (prev?.text === text ? null : prev));
      }, durationMs);
    }
  };

  // Sync dark mode class on <html>
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Initialize Firebase Auth listener for Google Drive Sync
  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser) => {
        setUser(authedUser);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
        setAutoSyncDriveApproved(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Load Admins, Units, Workers, and Global Metadata from IndexedDB
  const reloadMasterData = async () => {
    const [loadedAdmins, loadedUnits, loadedWorkers, loadedMeta] =
      await Promise.all([
        loadAdmins(),
        loadUnits(),
        loadWorkers(),
        loadMetadata(),
      ]);
    setAdmins(loadedAdmins);
    setUnits(loadedUnits);
    setWorkers(loadedWorkers);
    setGlobalMeta(loadedMeta);
  };

  useEffect(() => {
    reloadMasterData();
    // Subscribe to real-time cross-tab BroadcastChannel updates
    const unsubscribeSync = subscribeDataSync(() => {
      reloadMasterData();
      setSyncTick((t) => t + 1);
    });
    return () => unsubscribeSync();
  }, []);

  // Load active worker's monthly report data whenever selectedYear, selectedMonth, activeWorkerId, or syncTick changes
  const loadedMonthKeyRef = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    const requestKey = `${activeWorkerId}-${selectedYear}-${selectedMonth}`;
    // Only show the loading state when switching month/worker, not on background sync refreshes
    if (loadedMonthKeyRef.current !== requestKey) setIsLoading(true);
    loadMonthData(selectedYear, selectedMonth, activeWorkerId)
      .then((loadedMonth) => {
        if (!active) return;
        loadedMonthKeyRef.current = requestKey;
        setMonthData(loadedMonth);
        setLastSavedTime(
          new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          })
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedYear, selectedMonth, activeWorkerId, syncTick]);

  // Automatically scroll to and highlight today's date row when opening the A4 report view
  useEffect(() => {
    const isShowingReport =
      session?.role === 'worker' ||
      (session?.role === 'admin' && adminViewMode === 'worker-report');
    if (!isLoading && monthData && isShowingReport) {
      const daysInMonth = Object.keys(monthData.days).length;
      const targetDay = Math.min(highlightedDay, daysInMonth);
      const timer = setTimeout(() => {
        const el = rowRefs.current[targetDay];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [
    isLoading,
    monthData?.monthKey,
    session?.role,
    adminViewMode,
    activeWorkerId,
  ]);

  // Compute current active worker and unit objects
  const currentWorker = useMemo(() => {
    return (
      workers.find((w) => w.id === activeWorkerId) ||
      workers[0] || {
        id: 'worker-1',
        nama: 'Desi Natalia Gultom',
        nip: '40920241363',
        unitId: 'unit-labuhan-angin',
        divisi: 'SMT, KM & Risiko',
        jabatan: 'Admin SMT, KM dan Risiko',
        petugasSignDataUrl: globalMeta.petugasSignDataUrl,
      }
    );
  }, [workers, activeWorkerId, globalMeta.petugasSignDataUrl]);

  const currentUnit = useMemo(() => {
    return units.find((u) => u.id === currentWorker.unitId) || units[0];
  }, [units, currentWorker.unitId]);

  // Merged ReportMetadata for the currently viewed worker's A4 document
  const currentReportMetadata = useMemo(() => {
    return buildWorkerReportMetadata(
      currentWorker,
      currentUnit,
      globalMeta.logoDataUrl,
      globalMeta.judulLaporan
    );
  }, [
    currentWorker,
    currentUnit,
    globalMeta.logoDataUrl,
    globalMeta.judulLaporan,
  ]);

  // Handle Login from Landing Page
  const handleLogin = async (
    newSession: UserSession,
    newWorkerIfCreated?: WorkerProfile,
    newAdminIfCreated?: AdminProfile
  ) => {
    if (newWorkerIfCreated) {
      const nextWorkers = [...workers, newWorkerIfCreated];
      setWorkers(nextWorkers);
      await saveWorkers(nextWorkers);
    }
    if (newAdminIfCreated) {
      const nextAdmins = [...admins, newAdminIfCreated];
      setAdmins(nextAdmins);
      await saveAdmins(nextAdmins);
    }

    setSession(newSession);
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
    } catch {
      // Ignore
    }

    if (newSession.role === 'admin') {
      setAdminViewMode('dashboard');
    } else if (newSession.workerId) {
      setActiveWorkerId(newSession.workerId);
    }
  };

  // Handle Logout back to Landing Page
  const handleLogoutSession = () => {
    setSession(null);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  // Trigger automatic Google Drive sync when approved & data changes
  const performDriveSync = async (isManual = false) => {
    if (needsAuth) {
      if (isManual) {
        await handleGoogleLogin();
      }
      return;
    }
    setDriveSyncStatus('syncing');
    setDriveSyncMessage('Sedang menyinkronkan ke Google Drive...');
    try {
      const backup = await exportFullBackup();
      const updatedFile = await syncBackupToGoogleDrive(
        backup,
        driveFileMeta?.id
      );
      setDriveFileMeta(updatedFile);
      setDriveSyncStatus('synced');
      const timeStr = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setDriveSyncMessage(`Tersinkronisasi ke Drive (${timeStr})`);
      if (isManual) {
        showToast(
          'success',
          `Data seluruh unit & laporan berhasil disinkronkan ke Google Drive (${DRIVE_BACKUP_FILENAME}).`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal sinkronisasi';
      if (msg === 'UNAUTHENTICATED') {
        setNeedsAuth(true);
        setAutoSyncDriveApproved(false);
      }
      setDriveSyncStatus('error');
      setDriveSyncMessage('Sinkronisasi gagal — tersimpan lokal');
      showToast(
        'error',
        'Sinkronisasi ke Google Drive gagal. Data tetap aman tersimpan di browser lokal.'
      );
    }
  };

  // Save updated Admins list (from Admin Dashboard)
  const handleSaveAdminsList = async (nextAdmins: AdminProfile[]) => {
    setAdmins(nextAdmins);
    setSaveStatus('saving');
    await saveAdmins(nextAdmins);
    setSaveStatus('saved');
    setSyncTick((t) => t + 1);
    if (autoSyncDriveApproved && !needsAuth) {
      performDriveSync(false);
    }
  };

  // Save updated Units list (from Admin Dashboard)
  const handleSaveUnitsList = async (nextUnits: UnitKerja[]) => {
    setUnits(nextUnits);
    setSaveStatus('saving');
    await saveUnits(nextUnits);
    setSaveStatus('saved');
    setSyncTick((t) => t + 1);
    if (autoSyncDriveApproved && !needsAuth) {
      performDriveSync(false);
    }
  };

  // Save updated Workers list (from Admin Dashboard)
  const handleSaveWorkersList = async (nextWorkers: WorkerProfile[]) => {
    setWorkers(nextWorkers);
    setSaveStatus('saving');
    await saveWorkers(nextWorkers);
    setSaveStatus('saved');
    setSyncTick((t) => t + 1);
    if (autoSyncDriveApproved && !needsAuth) {
      performDriveSync(false);
    }
  };

  // Update metadata/signatures from the A4 paper view and sync back to WorkerProfile & UnitKerja
  const handleUpdateA4Metadata = async (partial: Partial<ReportMetadata>) => {
    setSaveStatus('saving');

    // 1. Update global logo or report title if changed
    if ('logoDataUrl' in partial || 'judulLaporan' in partial) {
      const nextGlobal: ReportMetadata = {
        ...globalMeta,
        ...(partial.logoDataUrl !== undefined
          ? { logoDataUrl: partial.logoDataUrl }
          : {}),
        ...(partial.judulLaporan !== undefined
          ? { judulLaporan: partial.judulLaporan }
          : {}),
      };
      setGlobalMeta(nextGlobal);
      await saveMetadata(nextGlobal);
    }

    // 2. Update WorkerProfile fields (nama, divisi, petugasJabatan, petugasSignDataUrl)
    const workerUpdatedFields: Partial<WorkerProfile> = {};
    if (partial.nama !== undefined) workerUpdatedFields.nama = partial.nama;
    if (partial.divisi !== undefined)
      workerUpdatedFields.divisi = partial.divisi;
    if (partial.petugasJabatan !== undefined)
      workerUpdatedFields.jabatan = partial.petugasJabatan;
    if ('petugasSignDataUrl' in partial)
      workerUpdatedFields.petugasSignDataUrl =
        partial.petugasSignDataUrl ?? null;
    if (partial.petugasNama !== undefined) {
      const stripped = partial.petugasNama.replace(/^\(|\)$/g, '').trim();
      if (stripped) workerUpdatedFields.nama = stripped;
    }

    if (Object.keys(workerUpdatedFields).length > 0) {
      const nextWorkers = workers.map((w) =>
        w.id === currentWorker.id ? { ...w, ...workerUpdatedFields } : w
      );
      setWorkers(nextWorkers);
      await saveWorkers(nextWorkers);
    }

    // 3. Update UnitKerja fields (Admin only: mengetahui & pengawas signatures/names)
    if (session?.role === 'admin' && currentUnit) {
      const unitUpdatedFields: Partial<UnitKerja> = {};
      if (partial.unit !== undefined)
        unitUpdatedFields.namaUnit = partial.unit;
      if (partial.mengetahuiUnitAtas !== undefined)
        unitUpdatedFields.namaUnit = partial.mengetahuiUnitAtas;
      if (partial.mengetahuiNama !== undefined)
        unitUpdatedFields.mengetahuiNama = partial.mengetahuiNama;
      if (partial.mengetahuiJabatan !== undefined)
        unitUpdatedFields.mengetahuiJabatan = partial.mengetahuiJabatan;
      if (partial.mengetahuiUnitBawah !== undefined)
        unitUpdatedFields.kodeSingkat = partial.mengetahuiUnitBawah;
      if ('mengetahuiSignDataUrl' in partial)
        unitUpdatedFields.mengetahuiSignDataUrl =
          partial.mengetahuiSignDataUrl ?? null;
      if (partial.pengawasPerusahaan !== undefined)
        unitUpdatedFields.pengawasPerusahaan = partial.pengawasPerusahaan;
      if (partial.pengawasNama !== undefined)
        unitUpdatedFields.pengawasNama = partial.pengawasNama;
      if (partial.pengawasJabatan !== undefined)
        unitUpdatedFields.pengawasJabatan = partial.pengawasJabatan;
      if ('pengawasSignDataUrl' in partial)
        unitUpdatedFields.pengawasSignDataUrl =
          partial.pengawasSignDataUrl ?? null;

      if (Object.keys(unitUpdatedFields).length > 0) {
        const nextUnits = units.map((u) =>
          u.id === currentUnit.id ? { ...u, ...unitUpdatedFields } : u
        );
        setUnits(nextUnits);
        await saveUnits(nextUnits);
      }
    }

    setSaveStatus('saved');
    setLastSavedTime(
      new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      })
    );
    setSyncTick((t) => t + 1);
    if (autoSyncDriveApproved && !needsAuth) {
      performDriveSync(false);
    }
  };

  // Update a single day entry with autosave
  const handleSaveDayEntry = async (updatedEntry: DayEntry) => {
    if (!monthData) return;
    const nextMonthData: MonthReportData = {
      ...monthData,
      workerId: activeWorkerId,
      days: {
        ...monthData.days,
        [updatedEntry.dayNumber]: updatedEntry,
      },
      updatedAt: new Date().toISOString(),
    };
    setMonthData(nextMonthData);
    setEditingDayNumber(null);
    setSaveStatus('saving');
    await saveMonthData(nextMonthData);
    setSaveStatus('saved');
    setLastSavedTime(
      new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      })
    );
    setSyncTick((t) => t + 1);
    if (autoSyncDriveApproved && !needsAuth) {
      performDriveSync(false);
    }
  };

  // Inline quick toggle for Selesai (Ya/Tidak) directly inside the table
  const handleQuickToggleCompleted = (
    e: React.MouseEvent,
    entry: DayEntry
  ) => {
    e.stopPropagation();
    const nextCompleted: 'Ya' | 'Tidak' =
      entry.completed === 'Ya' ? 'Tidak' : 'Ya';
    const nextProgress =
      nextCompleted === 'Ya'
        ? 100
        : entry.progress === 100 || entry.progress === null
        ? 50
        : entry.progress;

    handleSaveDayEntry({
      ...entry,
      completed: nextCompleted,
      progress: nextProgress,
    });
  };

  // Navigate to previous or next month
  const handleStepMonth = (delta: number) => {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setSelectedYear(y);
    setSelectedMonth(m);
  };

  // Scroll to and highlight "Hari Ini"
  const handleGoToToday = () => {
    const now = new Date();
    const todayDate = now.getDate();
    setHighlightedDay(todayDate);
    if (!monthData) return;
    const daysCount = Object.keys(monthData.days).length;
    const targetDay = Math.min(todayDate, daysCount);
    const rowEl = rowRefs.current[targetDay];
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    showToast(
      'info',
      `Menyorot baris tanggal ${String(targetDay).padStart(2, '0')} ${
        INDONESIAN_MONTHS[selectedMonth - 1]
      } ${selectedYear}. Klik baris untuk mengisi laporan.`
    );
  };

  // Google Sign-In handler: automatically checks Google Drive Database, pulls latest data if found, or prompts to initialize
  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setNeedsAuth(false);
        setDriveSyncStatus('syncing');
        setDriveSyncMessage('Memeriksa Database di Google Drive...');

        const existing = await findDriveBackupFile();
        setDriveFileMeta(existing);

        if (existing) {
          // Automatically load and synchronize data from the existing Google Drive Database
          try {
            const cloudBackup = await downloadBackupFromGoogleDrive(
              existing.id
            );
            await importFullBackup(cloudBackup);
            await reloadMasterData();
            const loadedMonth = await loadMonthData(
              selectedYear,
              selectedMonth,
              activeWorkerId
            );
            setMonthData(loadedMonth);
            setSyncTick((t) => t + 1);
            setDriveSyncStatus('synced');
            setDriveSyncMessage('Database Google Drive Terhubung ✓');
            showToast(
              'success',
              `Terhubung ke Database Google Drive (${existing.name}). Data Unit Kerja, Tenaga Kerja, dan Laporan telah disinkronkan.`
            );
          } catch {
            setDriveSyncStatus('idle');
            setDriveSyncMessage('Terhubung ke Google Drive');
          }
        } else {
          setDriveSyncStatus('idle');
          setDriveSyncMessage('Database belum dibuat di Drive');
          // Prompt user to initialize the master database in Google Drive
          setConfirmDialog({
            isOpen: true,
            title: 'Buat Database Baru di Google Drive?',
            description:
              'Belum ditemukan file database laporan di Google Drive Anda. Buat database sekarang agar seluruh data (Laporan Harian, Unit Kerja, Tenaga Kerja, Admin, dan Tanda Tangan) tersimpan dan tersinkronisasi otomatis di Google Drive?',
            details: [
              `Nama File Database: ${DRIVE_BACKUP_FILENAME}`,
              `Akun Google: ${res.user.email}`,
              `Data Tersinkron: ${units.length} Unit Kerja · ${workers.length} Tenaga Kerja · ${admins.length} Admin · Seluruh Laporan Bulanan`,
            ],
            confirmLabel: 'Buat & Sinkronkan Database Drive',
            variant: 'primary',
            onConfirm: async () => {
              setConfirmDialog(null);
              setAutoSyncDriveApproved(true);
              await performDriveSync(true);
            },
          });
        }
      }
    } catch (err) {
      console.error('Login gagal:', err);
      setDriveSyncStatus('error');
      setDriveSyncMessage('Gagal terhubung ke Drive');
      showToast(
        'error',
        'Gagal masuk dengan akun Google. Pastikan jendela pop-up diizinkan.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Request user confirmation before writing/updating file on Google Drive
  const handleRequestDriveSync = async () => {
    if (needsAuth) {
      await handleGoogleLogin();
      return;
    }

    let existing: DriveBackupFileMeta | null = driveFileMeta;
    try {
      existing = await findDriveBackupFile();
      setDriveFileMeta(existing);
    } catch {
      // Ignore lookup error
    }

    setConfirmDialog({
      isOpen: true,
      title: existing
        ? 'Perbarui Database di Google Drive?'
        : 'Simpan & Aktifkan Sinkronisasi Google Drive?',
      description: existing
        ? `Tindakan ini akan memperbarui (menimpa) file database laporan seluruh unit kerja & tenaga kerja di Google Drive Anda serta mengaktifkan sinkronisasi otomatis.`
        : `Tindakan ini akan membuat file database baru di Google Drive Anda dan mengaktifkan sinkronisasi otomatis setiap ada perubahan laporan.`,
      details: [
        `Nama File: ${DRIVE_BACKUP_FILENAME}`,
        `Akun Google: ${user?.email || 'Terautentikasi'}`,
        `Cakupan: ${units.length} Unit Kerja · ${workers.length} Tenaga Kerja`,
      ],
      confirmLabel: 'Konfirmasi & Sinkronkan',
      variant: 'primary',
      onConfirm: async () => {
        setConfirmDialog(null);
        setAutoSyncDriveApproved(true);
        await performDriveSync(true);
      },
    });
  };

  // Request user confirmation before restoring data from Google Drive
  const handleRequestDriveRestore = async () => {
    if (needsAuth) {
      await handleGoogleLogin();
      return;
    }

    setDriveSyncStatus('syncing');
    setDriveSyncMessage('Memeriksa cadangan di Google Drive...');
    try {
      const existing = await findDriveBackupFile();
      setDriveFileMeta(existing);
      setDriveSyncStatus('idle');
      setDriveSyncMessage('');

      if (!existing) {
        showToast(
          'info',
          `Belum ditemukan file cadangan "${DRIVE_BACKUP_FILENAME}" di Google Drive Anda.`
        );
        return;
      }

      const modDate = existing.modifiedTime
        ? new Date(existing.modifiedTime).toLocaleString('id-ID')
        : 'Baru saja';

      setConfirmDialog({
        isOpen: true,
        title: 'Muat Data dari Google Drive?',
        description:
          'Data unit kerja, tenaga kerja, dan laporan lokal akan diperbarui dengan data dari file cadangan Google Drive Anda.',
        details: [
          `File Drive: ${existing.name}`,
          `Terakhir Diubah: ${modDate}`,
        ],
        confirmLabel: 'Muat dari Google Drive',
        variant: 'primary',
        onConfirm: async () => {
          setConfirmDialog(null);
          setDriveSyncStatus('syncing');
          setDriveSyncMessage('Mengunduh data dari Google Drive...');
          try {
            const backup = await downloadBackupFromGoogleDrive(existing.id);
            await importFullBackup(backup);
            await reloadMasterData();
            const loadedMonth = await loadMonthData(
              selectedYear,
              selectedMonth,
              activeWorkerId
            );
            setMonthData(loadedMonth);
            setSyncTick((t) => t + 1);
            setDriveSyncStatus('synced');
            setDriveSyncMessage('Data dimuat dari Google Drive ✓');
            showToast(
              'success',
              'Data laporan berhasil dipulihkan dari Google Drive!'
            );
          } catch {
            setDriveSyncStatus('error');
            setDriveSyncMessage('Gagal mengunduh dari Drive');
            showToast('error', 'Gagal mengunduh data dari Google Drive.');
          }
        },
      });
    } catch {
      setDriveSyncStatus('error');
      setDriveSyncMessage('Gagal memeriksa Google Drive');
      showToast('error', 'Gagal memeriksa file di Google Drive.');
    }
  };

  // Clear preloaded sample data with explicit confirmation
  const handleRequestClearSampleData = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Data Contoh & Kosongkan Bulan Ini?',
      description:
        'Semua baris contoh pada laporan bulan terpilih akan dikosongkan agar dapat mulai diisi dari awal.',
      details: [
        `Tenaga Kerja: ${currentWorker.nama}`,
        `Bulan: ${INDONESIAN_MONTHS[selectedMonth - 1]} ${selectedYear}`,
      ],
      confirmLabel: 'Ya, Kosongkan Data Contoh',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        const emptied = await clearSampleDataAndReset(
          selectedYear,
          selectedMonth,
          activeWorkerId
        );
        setMonthData(emptied);
        setSyncTick((t) => t + 1);
        showToast(
          'success',
          'Data contoh telah dihapus. Tabel siap diisi dari kosong.'
        );
        if (autoSyncDriveApproved && !needsAuth) {
          performDriveSync(false);
        }
      },
    });
  };

  // JSON Backup Export
  const handleExportJSON = async () => {
    try {
      const backup = await exportFullBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Backup_Laporan_TA_${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('success', 'File Backup JSON berhasil diunduh.');
    } catch {
      showToast('error', 'Gagal mengekspor Backup JSON.');
    }
  };

  // JSON Backup Restore
  const handleImportJSONFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(
          ev.target?.result as string
        ) as FullDatabaseBackup;
        await importFullBackup(parsed);
        await reloadMasterData();
        const loadedMonth = await loadMonthData(
          selectedYear,
          selectedMonth,
          activeWorkerId
        );
        setMonthData(loadedMonth);
        setSyncTick((t) => t + 1);
        showToast('success', 'Data laporan berhasil dipulihkan dari file JSON!');
      } catch {
        showToast(
          'error',
          'File JSON tidak valid atau rusak. Pastikan menggunakan file hasil Backup aplikasi ini.'
        );
      } finally {
        if (jsonRestoreInputRef.current) {
          jsonRestoreInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  // Export handlers (PDF, Excel, CSV)
  const handleDownloadPDF = async () => {
    if (!monthData) return;
    setExportingType('pdf');
    try {
      await exportMonthToPDF(monthData, currentReportMetadata);
      showToast(
        'success',
        `PDF bulan ${INDONESIAN_MONTHS[selectedMonth - 1]} ${selectedYear} (${
          currentWorker.nama
        }) berhasil diunduh.`
      );
    } catch (err) {
      console.error('Gagal membuat PDF:', err);
      showToast('error', 'Gagal mengunduh PDF. Silakan gunakan tombol Cetak A4.');
    } finally {
      setExportingType(null);
    }
  };

  const handleDownloadExcel = async () => {
    if (!monthData) return;
    setExportingType('excel');
    try {
      await exportMonthToExcel(monthData, currentReportMetadata);
      showToast(
        'success',
        `File Excel (.xlsx) bulan ${INDONESIAN_MONTHS[selectedMonth - 1]} ${selectedYear} berhasil diunduh.`
      );
    } catch (err) {
      console.error('Gagal membuat Excel:', err);
      showToast('error', 'Gagal mengunduh file Excel.');
    } finally {
      setExportingType(null);
    }
  };

  const handleDownloadCSV = () => {
    if (!monthData) return;
    setExportingType('csv');
    try {
      exportMonthToCSV(monthData, currentReportMetadata);
      showToast(
        'success',
        `File CSV bulan ${INDONESIAN_MONTHS[selectedMonth - 1]} ${selectedYear} berhasil diunduh.`
      );
    } finally {
      setExportingType(null);
    }
  };

  // Compute monthly statistics for the toolbar summary
  const summaryStats = useMemo(() => {
    if (!monthData) {
      return { filledDays: 0, completedDays: 0, avgProgress: 0 };
    }
    const entries = Object.values(monthData.days);
    const filled = entries.filter(
      (d) =>
        d.tasks.length > 0 ||
        d.photos.length > 0 ||
        d.notes.trim() !== '' ||
        d.completed !== ''
    );
    const completedCount = filled.filter((d) => d.completed === 'Ya').length;
    const totalProgress = filled.reduce((acc, d) => {
      if (d.completed === 'Ya') return acc + 100;
      return acc + (d.progress ?? 0);
    }, 0);
    const avgProgress =
      filled.length > 0 ? Math.round(totalProgress / filled.length) : 0;

    return {
      filledDays: filled.length,
      completedDays: completedCount,
      avgProgress,
    };
  }, [monthData]);

  // Find nearest preceding filled day for "Salin dari Hari Sebelumnya"
  const previousFilledEntryForModal = useMemo(() => {
    if (!monthData || editingDayNumber === null) return null;
    for (let d = editingDayNumber - 1; d >= 1; d--) {
      const candidate = monthData.days[d];
      if (candidate && candidate.tasks.length > 0) {
        return candidate;
      }
    }
    return null;
  }, [monthData, editingDayNumber]);

  const sortedDays = useMemo(() => {
    if (!monthData) return [];
    const count = new Date(monthData.year, monthData.month, 0).getDate();
    const list: DayEntry[] = [];
    for (let d = 1; d <= count; d++) {
      if (monthData.days[d]) {
        list.push(monthData.days[d]);
      }
    }
    return list;
  }, [monthData]);

  const handleGoogleLogout = async () => {
    await logout();
    setUser(null);
    setNeedsAuth(true);
    setAutoSyncDriveApproved(false);
    setDriveSyncStatus('idle');
    setDriveSyncMessage('');
  };

  const sharedDriveDatabaseBar = (
    <GoogleDriveDatabaseBar
      needsAuth={needsAuth}
      isLoggingIn={isLoggingIn}
      user={user}
      driveSyncStatus={driveSyncStatus}
      driveSyncMessage={driveSyncMessage}
      driveFileMeta={driveFileMeta}
      autoSyncDriveApproved={autoSyncDriveApproved}
      onGoogleLogin={handleGoogleLogin}
      onRequestDriveSync={handleRequestDriveSync}
      onRequestDriveRestore={handleRequestDriveRestore}
      onGoogleLogout={handleGoogleLogout}
    />
  );

  // VIEW 1: LANDING LOGIN (If not logged in)
  if (!session) {
    return (
      <>
        <LandingLogin
          admins={admins}
          units={units}
          workers={workers}
          darkMode={darkMode}
          driveSyncBar={sharedDriveDatabaseBar}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          onLogin={handleLogin}
        />
        <ConfirmActionModal
          dialog={confirmDialog}
          onCancel={() => setConfirmDialog(null)}
        />
      </>
    );
  }

  // VIEW 2: ADMIN MONITORING DASHBOARD (All Units & Workers Split per Unit)
  if (session.role === 'admin' && adminViewMode === 'dashboard') {
    return (
      <>
        <AdminMonitoringDashboard
          session={session}
          admins={admins}
          units={units}
          workers={workers}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          darkMode={darkMode}
          syncTick={syncTick}
          driveSyncBar={sharedDriveDatabaseBar}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          onChangeMonthYear={(yr, mo) => {
            setSelectedYear(yr);
            setSelectedMonth(mo);
          }}
          onSaveAdmins={handleSaveAdminsList}
          onSaveUnits={handleSaveUnitsList}
          onSaveWorkers={handleSaveWorkersList}
          onOpenWorkerReport={(workerId) => {
            setActiveWorkerId(workerId);
            setAdminViewMode('worker-report');
          }}
          onLogout={handleLogoutSession}
        />
        <ConfirmActionModal
          dialog={confirmDialog}
          onCancel={() => setConfirmDialog(null)}
        />
      </>
    );
  }

  // VIEW 3: A4 DAILY REPORT SHEET (Direct for Tenaga Kerja, or Admin inspecting/signing a worker's report)
  const isAdminInspecting = session.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-200/85 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Top Toolbar (Outside Paper, Hidden on Print/PDF) */}
      <header className="no-print sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-300 dark:border-slate-800 shadow-xs">
        <div className="max-w-[1440px] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Role Badge / Back to Admin Monitoring + Month-Year Navigation */}
          <div className="flex flex-wrap items-center gap-2.5">
            {isAdminInspecting ? (
              <button
                type="button"
                onClick={() => setAdminViewMode('dashboard')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Kembali ke Monitoring Unit
              </button>
            ) : (
              <div className="flex items-center gap-2 pr-2 border-r border-slate-200 dark:border-slate-800">
                <FileText className="w-5 h-5 text-blue-700 dark:text-blue-400 shrink-0" />
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
                  Laporan Harian TA
                </span>
              </div>
            )}

            {/* Admin Quick Worker Switcher when inspecting A4 sheet */}
            {isAdminInspecting && (
              <select
                value={activeWorkerId}
                onChange={(e) => setActiveWorkerId(e.target.value)}
                aria-label="Pilih Tenaga Kerja"
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200"
              >
                {workers.map((w) => {
                  const u = units.find((unit) => unit.id === w.unitId);
                  return (
                    <option key={w.id} value={w.id}>
                      {w.nama} ({u?.kodeSingkat || 'PLN IP'})
                    </option>
                  );
                })}
              </select>
            )}

            {/* Month & Year Controls */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => handleStepMonth(-1)}
                className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                aria-label="Pilih Bulan"
                className="px-2 py-1 text-xs font-semibold bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                {INDONESIAN_MONTHS.map((mName, idx) => (
                  <option key={mName} value={idx + 1}>
                    {mName}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                aria-label="Pilih Tahun"
                className="px-2 py-1 text-xs font-mono font-semibold tabular-nums bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => handleStepMonth(1)}
                className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                title="Bulan Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* "Ke Hari Ini" Button */}
            <button
              type="button"
              onClick={handleGoToToday}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <CalendarCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Ke Hari Ini
            </button>

            {/* Autosave Status Text */}
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              {saveStatus === 'saving' ? (
                <span>Menyimpan...</span>
              ) : (
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                  Tersimpan & Sinkron ✓ {lastSavedTime && `(${lastSavedTime})`}
                </span>
              )}
            </div>
          </div>

          {/* Right: Export PDF / Excel / CSV + Dark Mode + Logout */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Primary CTA: Unduh PDF */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={exportingType !== null}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              {exportingType === 'pdf' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              Unduh PDF
            </button>

            {/* Unduh Excel (.xlsx) */}
            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={exportingType !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              {exportingType === 'excel' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              )}
              Excel (.xlsx)
            </button>

            {/* Unduh CSV */}
            <button
              type="button"
              onClick={handleDownloadCSV}
              disabled={exportingType !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>

            {/* Native Print A4 Fallback */}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
              title="Cetak Kertas A4"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak
            </button>

            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              title="Mode Terang / Gelap"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {/* Switch Role / Logout Button */}
            <button
              type="button"
              onClick={handleLogoutSession}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors whitespace-nowrap shrink-0"
              title="Keluar / Ganti Sudut Pandang (Admin / Tenaga Kerja)"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar
            </button>
          </div>
        </div>

        {/* Sub-Toolbar: Active User POV Info, Summary Metrics, Google Drive Sync & JSON Backup */}
        <div className="max-w-[1440px] mx-auto px-4 py-2 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/90 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left: Active Role POV + Summary Metrics */}
          <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-300 tabular-nums">
            <span className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-white">
              {session.role === 'admin' ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  POV Admin (Bisa Input TTD Mengetahui & Pengawas)
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  POV Tenaga Kerja: {currentWorker.nama} (NIP:{' '}
                  {currentWorker.nip})
                </>
              )}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Terisi:{' '}
              <strong className="text-slate-900 dark:text-white font-semibold">
                {summaryStats.filledDays} hari
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Selesai:{' '}
              <strong className="text-emerald-700 dark:text-emerald-400 font-semibold">
                {summaryStats.completedDays} hari
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Progress:{' '}
              <strong className="text-blue-700 dark:text-blue-400 font-semibold">
                {summaryStats.avgProgress}%
              </strong>
            </span>
          </div>

          {/* Right: Google Drive Cloud Sync & Local JSON Backup/Restore */}
          <div className="flex flex-wrap items-center gap-2">
            {sharedDriveDatabaseBar}

            <span className="text-slate-300 dark:text-slate-700">|</span>

            <button
              type="button"
              onClick={handleExportJSON}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3 h-3" />
              Backup JSON
            </button>

            <input
              ref={jsonRestoreInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportJSONFile}
            />
            <button
              type="button"
              onClick={() => jsonRestoreInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <FolderUp className="w-3 h-3" />
              Restore JSON
            </button>

            <button
              type="button"
              onClick={handleRequestClearSampleData}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3 h-3" />
              Hapus Data Contoh
            </button>
          </div>
        </div>

        {/* Real-time Notification Banner */}
        {toastBanner && (
          <div
            className={`px-4 py-2 text-xs font-medium flex items-center justify-between border-t ${
              toastBanner.type === 'error'
                ? 'bg-red-50 dark:bg-red-950/80 text-red-800 dark:text-red-200 border-red-200 dark:border-red-900'
                : toastBanner.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900'
                : 'bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-900'
            }`}
          >
            <div className="max-w-[1440px] mx-auto w-full flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {toastBanner.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                <span>{toastBanner.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastBanner(null)}
                className="text-[11px] underline opacity-75 hover:opacity-100"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Workspace Container: Scrollable A4 Portrait Paper */}
      <main className="a4-scroll-wrapper flex-1 overflow-x-auto py-6 px-3 sm:px-6 flex justify-center">
        <div className="a4-paper shadow-xl border border-slate-300 dark:border-slate-700 rounded-xs relative">
          {/* 1. KOP SURAT (Top Left Logo) */}
          <div className="mb-1">
            <EnergiLogo
              logoDataUrl={currentReportMetadata.logoDataUrl}
              onUpdateLogo={(url) =>
                handleUpdateA4Metadata({ logoDataUrl: url })
              }
            />
          </div>

          {/* 2. JUDUL TENGAH (Times New Roman, ±11pt, Bold, Inline Editable) */}
          <div className="my-2">
            <input
              type="text"
              value={
                currentReportMetadata.judulLaporan ??
                'LAPORAN PELAKSANAAN TECHNICAL ASSISTANT'
              }
              onChange={(e) =>
                handleUpdateA4Metadata({ judulLaporan: e.target.value })
              }
              aria-label="Judul Laporan"
              title="Klik untuk mengedit judul laporan"
              className="w-full font-doc-serif font-bold text-[11pt] text-center tracking-normal text-black bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-none py-0.5"
            />
          </div>

          {/* 3. BLOK IDENTITAS (Bold Labels + Colon + Inline Editable Values) */}
          <div className="font-doc-serif font-bold text-[9.5pt] text-black mb-2.5 space-y-0.5 max-w-[540px]">
            <div className="grid grid-cols-[125px_12px_1fr] items-center">
              <span>Nama</span>
              <span>:</span>
              <input
                type="text"
                value={currentReportMetadata.nama}
                onChange={(e) =>
                  handleUpdateA4Metadata({ nama: e.target.value })
                }
                className="font-bold text-black bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-none py-0 px-0.5"
                aria-label="Nama Pelapor"
              />
            </div>

            <div className="grid grid-cols-[125px_12px_1fr] items-center">
              <span>Divisi</span>
              <span>:</span>
              <input
                type="text"
                value={currentReportMetadata.divisi}
                onChange={(e) =>
                  handleUpdateA4Metadata({ divisi: e.target.value })
                }
                className="font-bold text-black bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-none py-0 px-0.5"
                aria-label="Divisi"
              />
            </div>

            <div className="grid grid-cols-[125px_12px_1fr] items-center">
              <span>Unit</span>
              <span>:</span>
              <input
                type="text"
                readOnly={session.role !== 'admin'}
                value={currentReportMetadata.unit}
                onChange={(e) =>
                  handleUpdateA4Metadata({ unit: e.target.value })
                }
                className="font-bold text-black bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-none py-0 px-0.5"
                aria-label="Unit Kerja"
              />
            </div>

            <div className="grid grid-cols-[125px_12px_1fr] items-center">
              <span>Bulan dan tahun</span>
              <span>:</span>
              <div className="flex items-center gap-1 px-0.5">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  aria-label="Bulan Laporan"
                  className="no-print font-bold text-black bg-transparent border-b border-transparent hover:border-slate-400 focus:border-blue-600 focus:outline-none cursor-pointer"
                >
                  {INDONESIAN_MONTHS.map((mName, idx) => (
                    <option key={mName} value={idx + 1}>
                      {mName}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  aria-label="Tahun Laporan"
                  className="no-print font-bold text-black bg-transparent border-b border-transparent hover:border-slate-400 focus:border-blue-600 focus:outline-none cursor-pointer"
                >
                  {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>

                <span className="hidden print:inline font-bold">
                  {INDONESIAN_MONTHS[selectedMonth - 1]} {selectedYear}
                </span>
              </div>
            </div>
          </div>

          {/* 4. TABEL LAPORAN BULANAN RESMI */}
          {isLoading ? (
            <div className="py-16 text-center text-xs text-slate-500">
              Memuat tabel laporan bulan {INDONESIAN_MONTHS[selectedMonth - 1]}{' '}
              {selectedYear}...
            </div>
          ) : (
            <table className="report-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="w-[28px]">
                    No.
                  </th>
                  <th rowSpan={2} className="w-[50px]">
                    Hari
                  </th>
                  <th rowSpan={2} className="w-[86px]">
                    Tanggal
                  </th>
                  <th rowSpan={2} className="w-[235px]">
                    Uraian Tugas
                  </th>
                  <th rowSpan={2} className="w-[105px]">
                    Dokumentasi Hasil
                    <br />
                    Pekerjaan / Pendukung
                  </th>
                  <th colSpan={2}>Progress Tugas</th>
                  <th rowSpan={2} className="w-[125px]">
                    Keterangan
                  </th>
                </tr>
                <tr>
                  <th className="w-[54px]">
                    Selesai
                    <br />
                    (ya/tidak)
                  </th>
                  <th className="w-[62px]">
                    Masih dalam
                    <br />
                    progress (%)
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedDays.map((entry) => {
                  const isTodayHighlighted = entry.dayNumber === highlightedDay;
                  const hasContent =
                    entry.tasks.length > 0 ||
                    entry.photos.length > 0 ||
                    entry.notes.trim() !== '' ||
                    entry.completed !== '';

                  const displayCompleted =
                    entry.completed || (entry.tasks.length > 0 ? 'Tidak' : '');
                  const displayProgress =
                    entry.progress !== null &&
                    entry.progress !== undefined &&
                    displayCompleted
                      ? `${entry.progress}%`
                      : displayCompleted === 'Ya'
                      ? '100%'
                      : '';

                  return (
                    <tr
                      key={entry.dayNumber}
                      ref={(el) => {
                        rowRefs.current[entry.dayNumber] = el;
                      }}
                      onClick={() => setEditingDayNumber(entry.dayNumber)}
                      title="Klik baris untuk mengisi atau mengedit laporan harian"
                      className={`group cursor-pointer transition-colors ${
                        entry.isWeekend
                          ? 'weekend-row bg-slate-100/75'
                          : 'bg-white'
                      } ${
                        isTodayHighlighted
                          ? 'today-row bg-amber-50/90 outline-1 outline-amber-500/70'
                          : 'hover:bg-blue-50/50'
                      }`}
                    >
                      <td className="text-center tabular-nums">
                        {entry.dayNumber}
                      </td>
                      <td className="text-left">{entry.dayName}</td>
                      <td className="text-center whitespace-nowrap tabular-nums">
                        {entry.formattedDate}
                      </td>
                      <td className="text-left align-middle relative">
                        {entry.tasks.length > 0 ? (
                          <div className="space-y-0.5">
                            {entry.tasks.map((t, idx) => (
                              <div
                                key={idx}
                                className="leading-snug break-words"
                              >
                                {idx + 1}. {t}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="no-print text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1">
                            <Edit3 className="w-3 h-3" />
                            Klik untuk isi tugas...
                          </span>
                        )}
                      </td>
                      <td className="text-center align-middle">
                        {entry.photos.length > 0 ? (
                          <div className="flex flex-col items-center justify-center gap-1 py-0.5">
                            {entry.photos.map((photoSrc, pIdx) => (
                              <img
                                key={pIdx}
                                src={photoSrc}
                                alt={`Dokumentasi ${entry.formattedDate} #${
                                  pIdx + 1
                                }`}
                                referrerPolicy="no-referrer"
                                className="w-[74px] h-auto max-h-[48px] object-cover border border-slate-300 mx-auto"
                              />
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td
                        onClick={(e) =>
                          hasContent
                            ? handleQuickToggleCompleted(e, entry)
                            : undefined
                        }
                        className="text-center align-middle select-none"
                        title={
                          hasContent
                            ? 'Klik untuk ubah cepat Ya / Tidak'
                            : undefined
                        }
                      >
                        {displayCompleted}
                      </td>
                      <td className="text-center align-middle tabular-nums">
                        {displayProgress}
                      </td>
                      <td className="text-left align-middle whitespace-pre-line break-words">
                        {entry.notes}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* 5. BLOK TANDA TANGAN RESMI DI BAWAH TABEL (Role-aware: Worker = Petugas Pelapor only, Admin = Mengetahui & Pengawas) */}
          <SignatureBlock
            metadata={currentReportMetadata}
            userRole={session.role}
            onChangeMetadata={handleUpdateA4Metadata}
          />
        </div>
      </main>

      {/* Modal Input Harian Real-Time */}
      {editingDayNumber !== null &&
        monthData &&
        monthData.days[editingDayNumber] && (
          <DailyReportModal
            entry={monthData.days[editingDayNumber]}
            previousFilledEntry={previousFilledEntryForModal}
            onSave={handleSaveDayEntry}
            onClose={() => setEditingDayNumber(null)}
          />
        )}

      {/* Explicit Confirmation Modal for Google Drive Sync & Sample Reset */}
      <ConfirmActionModal
        dialog={confirmDialog}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
