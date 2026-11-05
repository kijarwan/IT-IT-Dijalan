import {
  AdminProfile,
  FullDatabaseBackup,
  MonthReportData,
  ReportMetadata,
  UnitKerja,
  WorkerProfile,
} from '../types/report';
import {
  createEmptyMonthData,
  createPreloadedApril2026,
  createPreloadedMarch2026,
  getDefaultAdmins,
  getDefaultMetadata,
  getDefaultUnits,
  getDefaultWorkers,
  getMonthKey,
} from './sampleData';

const DB_NAME = 'LaporanPelaksanaanTADB';
const DB_VERSION = 1;
const STORE_MONTHS = 'months';
const STORE_SETTINGS = 'settings';
const METADATA_KEY = 'report-metadata';
const ADMINS_KEY = 'report-admins';
const UNITS_KEY = 'report-units';
const WORKERS_KEY = 'report-workers';
const SAMPLE_CLEARED_KEY = 'sample-data-cleared';

// Safe in-memory fallback if IndexedDB is unavailable in private/sandbox mode
const memoryMonths: Record<string, MonthReportData> = {};
let memoryMetadata: ReportMetadata | null = null;
let memoryAdmins: AdminProfile[] | null = null;
let memoryUnits: UnitKerja[] | null = null;
let memoryWorkers: WorkerProfile[] | null = null;
let memorySampleCleared = false;

// BroadcastChannel for real-time cross-tab synchronization between Tenaga Kerja and Admin
const syncChannel =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('laporan_ta_sync_channel')
    : null;

export function notifyDataSync(reason: string): void {
  try {
    syncChannel?.postMessage({ type: 'DATA_UPDATED', reason, timestamp: Date.now() });
  } catch {
    // Ignore BroadcastChannel errors
  }
}

export function subscribeDataSync(callback: () => void): () => void {
  if (!syncChannel) return () => {};
  const handler = () => callback();
  syncChannel.addEventListener('message', handler);
  return () => syncChannel.removeEventListener('message', handler);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB tidak tersedia'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_MONTHS)) {
          db.createObjectStore(STORE_MONTHS, { keyPath: 'monthKey' });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Gagal membuka IndexedDB'));
    } catch (err) {
      reject(err);
    }
  });
}

export async function isSampleDataCleared(): Promise<boolean> {
  try {
    const db = await openDatabase();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly');
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.get(SAMPLE_CLEARED_KEY);
      req.onsuccess = () => resolve(Boolean(req.result));
      req.onerror = () => resolve(memorySampleCleared);
    });
  } catch {
    try {
      return localStorage.getItem(SAMPLE_CLEARED_KEY) === 'true' || memorySampleCleared;
    } catch {
      return memorySampleCleared;
    }
  }
}

export async function loadAdmins(): Promise<AdminProfile[]> {
  try {
    const db = await openDatabase();
    const saved = await new Promise<AdminProfile[] | undefined>((resolve) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly');
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.get(ADMINS_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    });
    if (saved && Array.isArray(saved) && saved.length > 0) {
      memoryAdmins = saved;
      return saved;
    }
  } catch {
    try {
      const raw = localStorage.getItem(ADMINS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AdminProfile[];
        memoryAdmins = parsed;
        return parsed;
      }
    } catch {
      // Ignore
    }
  }

  if (memoryAdmins && memoryAdmins.length > 0) return memoryAdmins;
  const defaults = getDefaultAdmins();
  await saveAdmins(defaults, false);
  return defaults;
}

export async function saveAdmins(
  admins: AdminProfile[],
  broadcast = true
): Promise<void> {
  memoryAdmins = admins;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readwrite');
      const store = tx.objectStore(STORE_SETTINGS);
      store.put(admins, ADMINS_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try {
      localStorage.setItem(ADMINS_KEY, JSON.stringify(admins));
    } catch {
      // Kept in memoryAdmins
    }
  }
  if (broadcast) notifyDataSync('admins');
}

export async function loadUnits(): Promise<UnitKerja[]> {
  try {
    const db = await openDatabase();
    const saved = await new Promise<UnitKerja[] | undefined>((resolve) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly');
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.get(UNITS_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    });
    if (saved && Array.isArray(saved) && saved.length > 0) {
      memoryUnits = saved;
      return saved;
    }
  } catch {
    try {
      const raw = localStorage.getItem(UNITS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as UnitKerja[];
        memoryUnits = parsed;
        return parsed;
      }
    } catch {
      // Ignore
    }
  }

  if (memoryUnits && memoryUnits.length > 0) return memoryUnits;
  const defaults = getDefaultUnits();
  await saveUnits(defaults, false);
  return defaults;
}

export async function saveUnits(
  units: UnitKerja[],
  broadcast = true
): Promise<void> {
  memoryUnits = units;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readwrite');
      const store = tx.objectStore(STORE_SETTINGS);
      store.put(units, UNITS_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try {
      localStorage.setItem(UNITS_KEY, JSON.stringify(units));
    } catch {
      // Kept in memoryUnits
    }
  }
  if (broadcast) notifyDataSync('units');
}

export async function loadWorkers(): Promise<WorkerProfile[]> {
  try {
    const db = await openDatabase();
    const saved = await new Promise<WorkerProfile[] | undefined>((resolve) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly');
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.get(WORKERS_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    });
    if (saved && Array.isArray(saved) && saved.length > 0) {
      memoryWorkers = saved;
      return saved;
    }
  } catch {
    try {
      const raw = localStorage.getItem(WORKERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as WorkerProfile[];
        memoryWorkers = parsed;
        return parsed;
      }
    } catch {
      // Ignore
    }
  }

  if (memoryWorkers && memoryWorkers.length > 0) return memoryWorkers;
  const defaults = getDefaultWorkers();
  await saveWorkers(defaults, false);
  return defaults;
}

export async function saveWorkers(
  workers: WorkerProfile[],
  broadcast = true
): Promise<void> {
  memoryWorkers = workers;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readwrite');
      const store = tx.objectStore(STORE_SETTINGS);
      store.put(workers, WORKERS_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try {
      localStorage.setItem(WORKERS_KEY, JSON.stringify(workers));
    } catch {
      // Kept in memoryWorkers
    }
  }
  if (broadcast) notifyDataSync('workers');
}

export async function loadMetadata(): Promise<ReportMetadata> {
  try {
    const db = await openDatabase();
    const saved = await new Promise<ReportMetadata | undefined>((resolve) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly');
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.get(METADATA_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    });
    if (saved) {
      memoryMetadata = saved;
      return saved;
    }
  } catch {
    try {
      const raw = localStorage.getItem(METADATA_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ReportMetadata;
        memoryMetadata = parsed;
        return parsed;
      }
    } catch {
      // Ignore fallback error
    }
  }

  if (memoryMetadata) return memoryMetadata;
  const def = getDefaultMetadata();
  await saveMetadata(def);
  return def;
}

export async function saveMetadata(metadata: ReportMetadata): Promise<void> {
  memoryMetadata = metadata;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readwrite');
      const store = tx.objectStore(STORE_SETTINGS);
      store.put(metadata, METADATA_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try {
      localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
    } catch {
      // Fallback already in memoryMetadata
    }
  }
  notifyDataSync('metadata');
}

export async function loadMonthData(
  year: number,
  month: number,
  workerId = 'worker-1'
): Promise<MonthReportData> {
  const key = getMonthKey(year, month, workerId);
  const legacyKey = `laporan-${year}-${String(month).padStart(2, '0')}`;

  try {
    const db = await openDatabase();
    const saved = await new Promise<MonthReportData | undefined>((resolve) => {
      const tx = db.transaction(STORE_MONTHS, 'readonly');
      const store = tx.objectStore(STORE_MONTHS);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    });
    if (saved) {
      memoryMonths[key] = saved;
      return saved;
    }

    // Check legacy key if loading worker-1
    if (workerId === 'worker-1') {
      const legacySaved = await new Promise<MonthReportData | undefined>(
        (resolve) => {
          const tx = db.transaction(STORE_MONTHS, 'readonly');
          const store = tx.objectStore(STORE_MONTHS);
          const req = store.get(legacyKey);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(undefined);
        }
      );
      if (legacySaved) {
        const migrated: MonthReportData = {
          ...legacySaved,
          monthKey: key,
          workerId: 'worker-1',
        };
        await saveMonthData(migrated);
        return migrated;
      }
    }
  } catch {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as MonthReportData;
        memoryMonths[key] = parsed;
        return parsed;
      }
    } catch {
      // Ignore
    }
  }

  if (memoryMonths[key]) {
    return memoryMonths[key];
  }

  const sampleCleared = await isSampleDataCleared();
  if (!sampleCleared) {
    if (year === 2026 && month === 4) {
      const aprilSample = createPreloadedApril2026(workerId);
      await saveMonthData(aprilSample);
      return aprilSample;
    }
    if (year === 2026 && month === 3 && workerId === 'worker-1') {
      const marchSample = createPreloadedMarch2026(workerId);
      await saveMonthData(marchSample);
      return marchSample;
    }
  }

  const empty = createEmptyMonthData(year, month, workerId);
  await saveMonthData(empty);
  return empty;
}

export async function saveMonthData(data: MonthReportData): Promise<void> {
  const updated: MonthReportData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  memoryMonths[updated.monthKey] = updated;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_MONTHS, 'readwrite');
      const store = tx.objectStore(STORE_MONTHS);
      store.put(updated);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try {
      localStorage.setItem(updated.monthKey, JSON.stringify(updated));
    } catch {
      // Kept in memoryMonths
    }
  }
  notifyDataSync('monthData');
}

export async function clearSampleDataAndReset(
  currentYear: number,
  currentMonth: number,
  workerId = 'worker-1'
): Promise<MonthReportData> {
  memorySampleCleared = true;
  const aprilEmpty = createEmptyMonthData(2026, 4, workerId);
  const marchEmpty = createEmptyMonthData(2026, 3, workerId);
  const currentEmpty = createEmptyMonthData(currentYear, currentMonth, workerId);

  memoryMonths[aprilEmpty.monthKey] = aprilEmpty;
  memoryMonths[marchEmpty.monthKey] = marchEmpty;
  memoryMonths[currentEmpty.monthKey] = currentEmpty;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const tx = db.transaction([STORE_MONTHS, STORE_SETTINGS], 'readwrite');
      tx.objectStore(STORE_SETTINGS).put(true, SAMPLE_CLEARED_KEY);
      tx.objectStore(STORE_MONTHS).put(aprilEmpty);
      tx.objectStore(STORE_MONTHS).put(marchEmpty);
      tx.objectStore(STORE_MONTHS).put(currentEmpty);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    try {
      localStorage.setItem(SAMPLE_CLEARED_KEY, 'true');
      localStorage.setItem(aprilEmpty.monthKey, JSON.stringify(aprilEmpty));
      localStorage.setItem(marchEmpty.monthKey, JSON.stringify(marchEmpty));
      localStorage.setItem(currentEmpty.monthKey, JSON.stringify(currentEmpty));
    } catch {
      // Ignore
    }
  }

  notifyDataSync('clearSample');
  return currentEmpty;
}

export async function exportFullBackup(): Promise<FullDatabaseBackup> {
  const [metadata, admins, units, workers] = await Promise.all([
    loadMetadata(),
    loadAdmins(),
    loadUnits(),
    loadWorkers(),
  ]);
  const months: Record<string, MonthReportData> = { ...memoryMonths };

  try {
    const db = await openDatabase();
    const allMonths = await new Promise<MonthReportData[]>((resolve) => {
      const tx = db.transaction(STORE_MONTHS, 'readonly');
      const store = tx.objectStore(STORE_MONTHS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
    for (const m of allMonths) {
      months[m.monthKey] = m;
    }
  } catch {
    // Fallback uses memoryMonths
  }

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    metadata,
    admins,
    units,
    workers,
    months,
  };
}

export async function importFullBackup(backup: FullDatabaseBackup): Promise<void> {
  if (!backup || typeof backup !== 'object') {
    throw new Error('Format file backup JSON tidak valid.');
  }

  if (backup.metadata) {
    await saveMetadata(backup.metadata);
  }
  if (backup.admins && Array.isArray(backup.admins)) {
    await saveAdmins(backup.admins, false);
  }
  if (backup.units && Array.isArray(backup.units)) {
    await saveUnits(backup.units, false);
  }
  if (backup.workers && Array.isArray(backup.workers)) {
    await saveWorkers(backup.workers, false);
  }

  if (backup.months && typeof backup.months === 'object') {
    for (const key of Object.keys(backup.months)) {
      const monthData = backup.months[key];
      if (monthData && monthData.monthKey && monthData.days) {
        await saveMonthData(monthData);
      }
    }
  }
  notifyDataSync('importBackup');
}

/**
 * Compresses an uploaded image file to max width 800px (preserving aspect ratio)
 * before storing in IndexedDB.
 */
export function compressImageFile(
  file: File,
  maxWidth = 800,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        reject(new Error('Gagal membaca file gambar'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        const isPng = file.type === 'image/png';
        if (!isPng) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL(
          isPng ? 'image/png' : 'image/jpeg',
          isPng ? undefined : quality
        );
        resolve(compressed);
      };
      img.onerror = () => reject(new Error('Format gambar tidak didukung'));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
}
