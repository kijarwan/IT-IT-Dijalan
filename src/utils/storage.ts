import {
  AdminProfile,
  DayEntry,
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

/**
 * Storage layer
 * -------------
 * The single source of truth is the shared cloud database (Netlify Database via /api).
 * Every device (Tenaga Kerja & Admin) reads and writes the same data, so a report
 * entered on one phone/laptop is immediately visible on any other device.
 *
 * - Images (photos, signatures, logos) are uploaded once by content hash and
 *   referenced as "img:<sha256>" in the database to keep payloads small.
 * - Monthly reports are stored per day; only changed days are sent, so a worker
 *   and an admin editing different days never overwrite each other.
 * - IndexedDB is kept as a local offline mirror. Changes made while offline are
 *   queued and pushed to the cloud automatically once the connection returns.
 * - Other devices detect changes by polling a lightweight version endpoint.
 */

const API_BASE = '/api';
const DB_NAME = 'LaporanPelaksanaanTADB';
const DB_VERSION = 1;
const STORE_MONTHS = 'months';
const STORE_SETTINGS = 'settings';
const METADATA_KEY = 'report-metadata';
const ADMINS_KEY = 'report-admins';
const UNITS_KEY = 'report-units';
const WORKERS_KEY = 'report-workers';
const SAMPLE_CLEARED_KEY = 'sample-data-cleared';
const PENDING_KEY = 'laporan-cloud-pending-v1';
const MIGRATED_KEY = 'laporan-cloud-migrated-v1';
const IMG_REF_PREFIX = 'img:';
const IMG_INLINE_LIMIT = 1024; // Data URLs shorter than this are stored inline
const POLL_INTERVAL_MS = 5000;

type SettingKey =
  | typeof METADATA_KEY
  | typeof ADMINS_KEY
  | typeof UNITS_KEY
  | typeof WORKERS_KEY
  | typeof SAMPLE_CLEARED_KEY;

// ---------------------------------------------------------------------------
// Local sync notifications (same browser tabs) + cross-device polling
// ---------------------------------------------------------------------------

const syncChannel =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('laporan_ta_sync_channel')
    : null;

const syncListeners = new Set<() => void>();
let lastKnownVersion: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

export function notifyDataSync(reason: string): void {
  try {
    syncChannel?.postMessage({ type: 'DATA_UPDATED', reason, timestamp: Date.now() });
  } catch {
    // Ignore BroadcastChannel errors
  }
}

function emitSync() {
  syncListeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // Ignore listener errors
    }
  });
}

async function pollRemoteVersion() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  await flushPending();
  try {
    const res = await fetch(`${API_BASE}/version`, { cache: 'no-store' });
    if (!res.ok) return;
    const { version } = (await res.json()) as { version: string | null };
    if (lastKnownVersion === null) {
      lastKnownVersion = version;
      return;
    }
    if (version !== lastKnownVersion) {
      lastKnownVersion = version;
      emitSync();
    }
  } catch {
    // Offline — try again next tick
  }
}

function startPolling() {
  if (pollTimer || typeof window === 'undefined') return;
  pollRemoteVersion();
  pollTimer = setInterval(pollRemoteVersion, POLL_INTERVAL_MS);
  window.addEventListener('focus', pollRemoteVersion);
  window.addEventListener('online', pollRemoteVersion);
  document.addEventListener('visibilitychange', pollRemoteVersion);
}

function stopPolling() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
  window.removeEventListener('focus', pollRemoteVersion);
  window.removeEventListener('online', pollRemoteVersion);
  document.removeEventListener('visibilitychange', pollRemoteVersion);
}

/**
 * Subscribe to data changes coming from other tabs AND other devices.
 */
export function subscribeDataSync(callback: () => void): () => void {
  syncListeners.add(callback);
  const handler = () => callback();
  syncChannel?.addEventListener('message', handler);
  startPolling();
  return () => {
    syncListeners.delete(callback);
    syncChannel?.removeEventListener('message', handler);
    if (syncListeners.size === 0) stopPolling();
  };
}

// ---------------------------------------------------------------------------
// IndexedDB local mirror (offline fallback)
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
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
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

async function localGet<T>(store: string, key: string): Promise<T | undefined> {
  try {
    const db = await openDatabase();
    return await new Promise<T | undefined>((resolve) => {
      const req = db.transaction(store, 'readonly').objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}

async function localGetAllMonths(): Promise<MonthReportData[]> {
  try {
    const db = await openDatabase();
    return await new Promise<MonthReportData[]>((resolve) => {
      const req = db.transaction(STORE_MONTHS, 'readonly').objectStore(STORE_MONTHS).getAll();
      req.onsuccess = () => resolve((req.result as MonthReportData[]) || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function localPutSetting(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_SETTINGS, 'readwrite');
      tx.objectStore(STORE_SETTINGS).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Local mirror is best-effort only
  }
}

async function localPutMonth(data: MonthReportData): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_MONTHS, 'readwrite');
      tx.objectStore(STORE_MONTHS).put(data);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Local mirror is best-effort only
  }
}

// ---------------------------------------------------------------------------
// Offline queue
// ---------------------------------------------------------------------------

interface PendingState {
  settings: string[];
  months: Record<string, number[] | 'all'>;
}

function readPending(): PendingState {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (raw) return JSON.parse(raw) as PendingState;
  } catch {
    // Ignore
  }
  return { settings: [], months: {} };
}

function writePending(state: PendingState) {
  try {
    if (state.settings.length === 0 && Object.keys(state.months).length === 0) {
      localStorage.removeItem(PENDING_KEY);
    } else {
      localStorage.setItem(PENDING_KEY, JSON.stringify(state));
    }
  } catch {
    // Ignore
  }
}

function queueSetting(key: string) {
  const p = readPending();
  if (!p.settings.includes(key)) p.settings.push(key);
  writePending(p);
}

function queueMonthDays(monthKey: string, days: number[] | 'all') {
  const p = readPending();
  const prev = p.months[monthKey];
  if (days === 'all' || prev === 'all') {
    p.months[monthKey] = 'all';
  } else {
    p.months[monthKey] = Array.from(new Set([...(prev || []), ...days]));
  }
  writePending(p);
}

let flushing: Promise<void> | null = null;

async function flushPending(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    const p = readPending();
    if (p.settings.length === 0 && Object.keys(p.months).length === 0) return;

    for (const key of [...p.settings]) {
      const value = await localGet<unknown>(STORE_SETTINGS, key);
      if (value === undefined) {
        p.settings = p.settings.filter((k) => k !== key);
        continue;
      }
      try {
        await putSettingRemote(key as SettingKey, value);
        p.settings = p.settings.filter((k) => k !== key);
        writePending(p);
      } catch {
        return; // Still offline
      }
    }

    for (const monthKey of Object.keys(p.months)) {
      const local = await localGet<MonthReportData>(STORE_MONTHS, monthKey);
      if (!local) {
        delete p.months[monthKey];
        continue;
      }
      const want = p.months[monthKey];
      const days: Record<number, DayEntry> = {};
      for (const [k, v] of Object.entries(local.days)) {
        if (want === 'all' || want.includes(Number(k))) days[Number(k)] = v;
      }
      try {
        await putMonthRemote(local, days);
        delete p.months[monthKey];
        writePending(p);
      } catch {
        return; // Still offline
      }
    }
    writePending(p);
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

// ---------------------------------------------------------------------------
// Image dehydration / hydration (data URL <-> content-hash reference)
// ---------------------------------------------------------------------------

const imageByHash = new Map<string, string>();
const hashByImage = new Map<string, string>();
const uploadedHashes = new Set<string>();
const imageFetches = new Map<string, Promise<string | null>>();

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function uploadImage(dataUrl: string): Promise<string> {
  let hash = hashByImage.get(dataUrl);
  if (!hash) {
    hash = await sha256Hex(dataUrl);
    hashByImage.set(dataUrl, hash);
    imageByHash.set(hash, dataUrl);
  }
  if (!uploadedHashes.has(hash)) {
    const res = await fetch(`${API_BASE}/images/${hash}`, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
      body: dataUrl,
    });
    if (!res.ok) throw new Error('Gagal mengunggah gambar');
    uploadedHashes.add(hash);
  }
  return hash;
}

function isImageRef(v: unknown): v is string {
  return typeof v === 'string' && v.startsWith(IMG_REF_PREFIX) && /^img:[a-f0-9]{64}$/.test(v);
}

async function fetchImage(hash: string): Promise<string | null> {
  const cached = imageByHash.get(hash);
  if (cached) return cached;
  let pending = imageFetches.get(hash);
  if (!pending) {
    pending = fetch(`${API_BASE}/images/${hash}`)
      .then(async (res) => {
        if (!res.ok) return null;
        const text = await res.text();
        imageByHash.set(hash, text);
        hashByImage.set(text, hash);
        uploadedHashes.add(hash);
        return text;
      })
      .catch(() => null)
      .finally(() => imageFetches.delete(hash));
    imageFetches.set(hash, pending);
  }
  return pending;
}

/** Replace large data URLs with "img:<hash>" refs (uploading images as needed). */
async function dehydrate<T>(value: T): Promise<T> {
  if (typeof value === 'string') {
    if (value.startsWith('data:image/') && value.length > IMG_INLINE_LIMIT) {
      const hash = await uploadImage(value);
      return `${IMG_REF_PREFIX}${hash}` as unknown as T;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return (await Promise.all(value.map((v) => dehydrate(v)))) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const entries = await Promise.all(
      Object.entries(value as Record<string, unknown>).map(
        async ([k, v]) => [k, await dehydrate(v)] as const
      )
    );
    return Object.fromEntries(entries) as T;
  }
  return value;
}

/** Resolve "img:<hash>" refs back into data URLs. */
async function hydrate<T>(value: T, resolveImages = true): Promise<T> {
  if (isImageRef(value)) {
    if (!resolveImages) return value;
    const data = await fetchImage(value.slice(IMG_REF_PREFIX.length));
    return (data ?? null) as unknown as T;
  }
  if (Array.isArray(value)) {
    const out = await Promise.all(value.map((v) => hydrate(v, resolveImages)));
    // Drop images that could not be resolved from arrays (e.g. photos list)
    return out.filter((v, i) => !(v === null && isImageRef(value[i]))) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const entries = await Promise.all(
      Object.entries(value as Record<string, unknown>).map(
        async ([k, v]) => [k, await hydrate(v, resolveImages)] as const
      )
    );
    return Object.fromEntries(entries) as T;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Remote API helpers
// ---------------------------------------------------------------------------

let settingsFetch: Promise<Record<string, unknown>> | null = null;

function fetchRemoteSettings(): Promise<Record<string, unknown>> {
  if (settingsFetch) return settingsFetch;
  settingsFetch = fetch(`${API_BASE}/settings`, { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) throw new Error('Gagal memuat data dari server');
      const body = (await res.json()) as {
        settings: Record<string, unknown>;
        version: string | null;
      };
      if (lastKnownVersion === null) lastKnownVersion = body.version;
      return body.settings;
    })
    .finally(() => {
      // Allow concurrent callers to share one request, then refresh next time
      setTimeout(() => {
        settingsFetch = null;
      }, 0);
    });
  return settingsFetch;
}

async function putSettingRemote(
  key: SettingKey,
  value: unknown,
  ifAbsent = false
): Promise<unknown> {
  const stored = await dehydrate(value);
  const res = await fetch(
    `${API_BASE}/settings/${encodeURIComponent(key)}${ifAbsent ? '?ifAbsent=1' : ''}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: stored }),
    }
  );
  if (!res.ok) throw new Error('Gagal menyimpan data ke server');
  const body = (await res.json()) as { value: unknown };
  return body.value;
}

// Last day snapshots received from / sent to the server, used to send only changed days
const serverDaySnapshots = new Map<string, Record<number, string>>();

// JSON with sorted keys (Postgres jsonb does not preserve key order)
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function rememberServerMonth(monthKey: string, days: Record<number, unknown>) {
  const snap: Record<number, string> = {};
  for (const [k, v] of Object.entries(days)) snap[Number(k)] = stableStringify(v);
  serverDaySnapshots.set(monthKey, snap);
}

async function putMonthRemote(
  data: MonthReportData,
  days: Record<number, DayEntry>,
  ifAbsent = false
): Promise<MonthReportData | null> {
  const storedDays = await dehydrate(days);
  const res = await fetch(
    `${API_BASE}/months/${encodeURIComponent(data.monthKey)}${ifAbsent ? '?ifAbsent=1' : ''}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workerId: data.workerId ?? null,
        year: data.year,
        month: data.month,
        isSampleData: Boolean(data.isSampleData),
        days: storedDays,
      }),
    }
  );
  if (!res.ok) throw new Error('Gagal menyimpan laporan ke server');
  const remote = (await res.json()) as MonthReportData | null;
  if (remote) rememberServerMonth(remote.monthKey, remote.days);
  return remote;
}

async function getMonthRemote(monthKey: string): Promise<MonthReportData | null> {
  const res = await fetch(`${API_BASE}/months/${encodeURIComponent(monthKey)}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Gagal memuat laporan dari server');
  const remote = (await res.json()) as MonthReportData;
  rememberServerMonth(remote.monthKey, remote.days);
  return remote;
}

// ---------------------------------------------------------------------------
// One-time upload of data that previously lived only in this browser
// ---------------------------------------------------------------------------

function dayHasContent(d: DayEntry | undefined): boolean {
  if (!d) return false;
  return (
    (d.tasks?.length ?? 0) > 0 ||
    (d.photos?.length ?? 0) > 0 ||
    (d.notes ?? '').trim() !== '' ||
    (d.completed ?? '') !== '' ||
    (d.progress !== null && d.progress !== undefined)
  );
}

function mergeById<T extends { id: string }>(remote: T[] | undefined, local: T[] | undefined): T[] {
  const out = [...(remote || [])];
  for (const item of local || []) {
    if (!out.some((r) => r.id === item.id)) out.push(item);
  }
  return out;
}

let migrationPromise: Promise<void> | null = null;

function migrateLocalDataToCloud(): Promise<void> {
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    try {
      if (localStorage.getItem(MIGRATED_KEY) === 'done') return;
    } catch {
      return;
    }

    const [localAdmins, localUnits, localWorkers, localMeta, localCleared, localMonths] =
      await Promise.all([
        localGet<AdminProfile[]>(STORE_SETTINGS, ADMINS_KEY),
        localGet<UnitKerja[]>(STORE_SETTINGS, UNITS_KEY),
        localGet<WorkerProfile[]>(STORE_SETTINGS, WORKERS_KEY),
        localGet<ReportMetadata>(STORE_SETTINGS, METADATA_KEY),
        localGet<boolean>(STORE_SETTINGS, SAMPLE_CLEARED_KEY),
        localGetAllMonths(),
      ]);

    const hasLocalData =
      localAdmins || localUnits || localWorkers || localMeta || localMonths.length > 0;
    if (!hasLocalData) {
      try {
        localStorage.setItem(MIGRATED_KEY, 'done');
      } catch {
        // Ignore
      }
      return;
    }

    const remote = await fetchRemoteSettings();

    const listMerges: Array<[SettingKey, { id: string }[] | undefined]> = [
      [ADMINS_KEY, localAdmins],
      [UNITS_KEY, localUnits],
      [WORKERS_KEY, localWorkers],
    ];
    for (const [key, local] of listMerges) {
      if (!local || local.length === 0) continue;
      const remoteList = Array.isArray(remote[key])
        ? (remote[key] as { id: string }[])
        : undefined;
      const merged = mergeById(remoteList, local);
      if (!remoteList || merged.length !== remoteList.length) {
        await putSettingRemote(key, merged);
      }
    }
    if (localMeta && !remote[METADATA_KEY]) {
      await putSettingRemote(METADATA_KEY, localMeta, true);
    }
    if (localCleared && !remote[SAMPLE_CLEARED_KEY]) {
      await putSettingRemote(SAMPLE_CLEARED_KEY, true, true);
    }

    for (const local of localMonths) {
      if (!local?.monthKey || !local.days) continue;
      // Legacy key format "laporan-YYYY-MM" belonged to worker-1
      const legacy = /^laporan-(\d{4})-(\d{2})$/.exec(local.monthKey);
      const month: MonthReportData = legacy
        ? { ...local, monthKey: getMonthKey(local.year, local.month, 'worker-1'), workerId: 'worker-1' }
        : local;

      const filledLocal = Object.values(month.days).filter(dayHasContent);
      if (filledLocal.length === 0) continue;

      const remoteMonth = await getMonthRemote(month.monthKey);
      const toSend: Record<number, DayEntry> = {};
      if (!remoteMonth) {
        Object.assign(toSend, month.days);
      } else {
        for (const d of filledLocal) {
          const r = remoteMonth.days[d.dayNumber] as DayEntry | undefined;
          if (!dayHasContent(r)) toSend[d.dayNumber] = d;
        }
      }
      if (Object.keys(toSend).length > 0) {
        await putMonthRemote(month, toSend);
      }
    }

    try {
      localStorage.setItem(MIGRATED_KEY, 'done');
    } catch {
      // Ignore
    }
    notifyDataSync('migration');
  })().catch((err) => {
    console.warn('Migrasi data lokal ke cloud tertunda:', err);
    migrationPromise = null;
  });
  return migrationPromise;
}

// ---------------------------------------------------------------------------
// Settings (admins, units, workers, metadata)
// ---------------------------------------------------------------------------

async function loadSetting<T>(
  key: SettingKey,
  isValid: (v: unknown) => boolean,
  getDefault: () => T
): Promise<T> {
  await migrateLocalDataToCloud();
  try {
    const remote = await fetchRemoteSettings();
    let value = remote[key];
    if (!isValid(value)) {
      // Seed defaults once; if another device seeded first, use its value
      value = await putSettingRemote(key, getDefault(), true);
    }
    if (readPending().settings.includes(key)) {
      // A local change has not reached the server yet: keep showing it
      const local = await localGet<T>(STORE_SETTINGS, key);
      if (local !== undefined && isValid(local)) return local;
    }
    const hydrated = await hydrate(value as T);
    await localPutSetting(key, hydrated);
    return hydrated;
  } catch {
    // Offline fallback: use the local mirror
    const local = await localGet<T>(STORE_SETTINGS, key);
    if (local !== undefined && isValid(local)) return local;
    return getDefault();
  }
}

async function saveSetting(key: SettingKey, value: unknown, broadcast = true): Promise<void> {
  await localPutSetting(key, value);
  try {
    await putSettingRemote(key, value);
  } catch {
    queueSetting(key);
  }
  if (broadcast) notifyDataSync(key);
}

const isNonEmptyArray = (v: unknown) => Array.isArray(v) && v.length > 0;
const isObject = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);

export async function isSampleDataCleared(): Promise<boolean> {
  try {
    const remote = await fetchRemoteSettings();
    return remote[SAMPLE_CLEARED_KEY] === true;
  } catch {
    return (await localGet<boolean>(STORE_SETTINGS, SAMPLE_CLEARED_KEY)) === true;
  }
}

export function loadAdmins(): Promise<AdminProfile[]> {
  return loadSetting(ADMINS_KEY, isNonEmptyArray, getDefaultAdmins);
}

export function saveAdmins(admins: AdminProfile[], broadcast = true): Promise<void> {
  return saveSetting(ADMINS_KEY, admins, broadcast);
}

export function loadUnits(): Promise<UnitKerja[]> {
  return loadSetting(UNITS_KEY, isNonEmptyArray, getDefaultUnits);
}

export function saveUnits(units: UnitKerja[], broadcast = true): Promise<void> {
  return saveSetting(UNITS_KEY, units, broadcast);
}

export function loadWorkers(): Promise<WorkerProfile[]> {
  return loadSetting(WORKERS_KEY, isNonEmptyArray, getDefaultWorkers);
}

export function saveWorkers(workers: WorkerProfile[], broadcast = true): Promise<void> {
  return saveSetting(WORKERS_KEY, workers, broadcast);
}

export function loadMetadata(): Promise<ReportMetadata> {
  return loadSetting(METADATA_KEY, isObject, getDefaultMetadata);
}

export function saveMetadata(metadata: ReportMetadata): Promise<void> {
  return saveSetting(METADATA_KEY, metadata, true);
}

// ---------------------------------------------------------------------------
// Monthly reports
// ---------------------------------------------------------------------------

/**
 * Load a worker's monthly report from the shared database.
 * Pass `{ resolveImages: false }` when only counts/statistics are needed
 * (photo entries stay as lightweight references).
 */
export async function loadMonthData(
  year: number,
  month: number,
  workerId = 'worker-1',
  options: { resolveImages?: boolean } = {}
): Promise<MonthReportData> {
  const resolveImages = options.resolveImages !== false;
  const key = getMonthKey(year, month, workerId);
  await migrateLocalDataToCloud();

  try {
    let remote = await getMonthRemote(key);

    if (!remote) {
      const sampleCleared = await isSampleDataCleared();
      let seed: MonthReportData | null = null;
      if (!sampleCleared && year === 2026 && month === 4) {
        seed = createPreloadedApril2026(workerId);
      } else if (!sampleCleared && year === 2026 && month === 3 && workerId === 'worker-1') {
        seed = createPreloadedMarch2026(workerId);
      }
      if (!seed) {
        // Nothing stored yet: show an empty month (saved on first edit)
        return createEmptyMonthData(year, month, workerId);
      }
      remote = await putMonthRemote(seed, seed.days, true);
      if (!remote) return seed;
    }

    const empty = createEmptyMonthData(year, month, workerId);
    const hydratedDays = await hydrate(remote.days, resolveImages);
    const result: MonthReportData = {
      ...empty,
      ...remote,
      workerId: remote.workerId ?? workerId,
      days: { ...empty.days, ...hydratedDays },
    };

    if (resolveImages) {
      // Keep local unsent edits intact; otherwise refresh the offline mirror
      const pending = readPending().months[key];
      if (!pending) {
        await localPutMonth(result);
      } else {
        const local = await localGet<MonthReportData>(STORE_MONTHS, key);
        if (local) {
          for (const [k, v] of Object.entries(local.days)) {
            if (pending === 'all' || pending.includes(Number(k))) {
              result.days[Number(k)] = v;
            }
          }
        }
      }
    }
    return result;
  } catch {
    const local = await localGet<MonthReportData>(STORE_MONTHS, key);
    return local ?? createEmptyMonthData(year, month, workerId);
  }
}

/**
 * Save a monthly report. Only days that differ from the last known server copy
 * are sent, so edits from different devices on different days are merged.
 */
export async function saveMonthData(
  data: MonthReportData,
  options: { forceAllDays?: boolean } = {}
): Promise<void> {
  const updated: MonthReportData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  await localPutMonth(updated);

  const snapshot = serverDaySnapshots.get(updated.monthKey) || {};
  const changedDays: Record<number, DayEntry> = {};
  const changedNumbers: number[] = [];

  if (options.forceAllDays) {
    for (const [k, v] of Object.entries(updated.days)) {
      changedDays[Number(k)] = v;
      changedNumbers.push(Number(k));
    }
  } else {
    for (const [k, v] of Object.entries(updated.days)) {
      const n = Number(k);
      const known = snapshot[n];
      if (known === undefined) {
        // Day not stored on the server yet: only send it if it has content
        if (dayHasContent(v)) {
          changedDays[n] = v;
          changedNumbers.push(n);
        }
        continue;
      }
      let stored: string;
      try {
        stored = stableStringify(await dehydrate(v));
      } catch {
        stored = '';
      }
      if (stored !== known) {
        changedDays[n] = v;
        changedNumbers.push(n);
      }
    }
  }

  if (changedNumbers.length > 0) {
    try {
      await putMonthRemote(updated, changedDays);
    } catch {
      queueMonthDays(updated.monthKey, changedNumbers);
    }
  }
  notifyDataSync('monthData');
}

export async function clearSampleDataAndReset(
  currentYear: number,
  currentMonth: number,
  workerId = 'worker-1'
): Promise<MonthReportData> {
  const aprilEmpty = createEmptyMonthData(2026, 4, workerId);
  const marchEmpty = createEmptyMonthData(2026, 3, workerId);
  const currentEmpty = createEmptyMonthData(currentYear, currentMonth, workerId);

  await saveSetting(SAMPLE_CLEARED_KEY, true, false);
  const seen = new Set<string>();
  for (const m of [aprilEmpty, marchEmpty, currentEmpty]) {
    if (seen.has(m.monthKey)) continue;
    seen.add(m.monthKey);
    await saveMonthData(m, { forceAllDays: true });
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
  const months: Record<string, MonthReportData> = {};

  try {
    const res = await fetch(`${API_BASE}/months`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Gagal memuat laporan');
    const body = (await res.json()) as { months: MonthReportData[] };
    for (const m of body.months) {
      months[m.monthKey] = { ...m, days: await hydrate(m.days) };
    }
  } catch {
    for (const m of await localGetAllMonths()) {
      months[m.monthKey] = m;
    }
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
        await saveMonthData(monthData, { forceAllDays: true });
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
