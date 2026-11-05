export type UserRole = 'admin' | 'worker';

export interface UserSession {
  role: UserRole;
  nama: string;
  nip: string;
  workerId?: string; // Present when role === 'worker'
  loginAt: string;
}

export interface UnitKerja {
  id: string;
  namaUnit: string; // e.g., "PT PLN Indonesia Power UBP Labuhan Angin"
  kodeSingkat: string; // e.g., "PLN IP UBP Labuhan Angin"
  lokasi: string;
  mengetahuiNama: string; // e.g., "(Walesa Miduk Jayanto)"
  mengetahuiJabatan: string; // e.g., "Officer Reliability"
  mengetahuiSignDataUrl: string | null;
  pengawasPerusahaan: string; // e.g., "PT. Energi Duta Utama"
  pengawasNama: string; // e.g., "Primazahra Agya Zaenal Mutaqin"
  pengawasJabatan: string; // e.g., "Pengawas Pelaksana Pekerjaan"
  pengawasSignDataUrl: string | null;
}

export interface AdminProfile {
  id: string;
  nama: string;
  nip: string;
  jabatan: string;
}

export interface WorkerProfile {
  id: string;
  nama: string; // e.g., "Desi Natalia Gultom"
  nip: string; // e.g., "40920241363"
  unitId: string; // References UnitKerja.id
  divisi: string; // e.g., "SMT, KM & Risiko"
  jabatan: string; // e.g., "Admin SMT, KM dan Risiko"
  petugasSignDataUrl: string | null;
}

export interface DayEntry {
  dayNumber: number; // 1..31
  dateIso: string; // YYYY-MM-DD
  dayName: string; // Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu
  formattedDate: string; // "01 April 2026"
  isWeekend: boolean; // Sabtu or Minggu
  tasks: string[]; // Array of individual tasks (rendered as 1., 2., 3.)
  photos: string[]; // Array of compressed Data URLs (max 800px width)
  completed: 'Ya' | 'Tidak' | ''; // Selesai (ya/tidak)
  progress: number | null; // Masih dalam progress (%) 0-100
  notes: string; // Keterangan
}

export interface ReportMetadata {
  judulLaporan?: string; // Default: "LAPORAN PELAKSANAAN TECHNICAL ASSISTANT"
  nama: string;
  nip?: string;
  divisi: string;
  unit: string;
  logoDataUrl: string | null;

  // Signature 1: Left Top (Petugas Pelapor)
  petugasLabel: string;
  petugasNama: string;
  petugasJabatan: string;
  petugasSignDataUrl: string | null;

  // Signature 2: Right Top (Mengetahui)
  mengetahuiLabel: string;
  mengetahuiUnitAtas: string;
  mengetahuiNama: string;
  mengetahuiJabatan: string;
  mengetahuiUnitBawah: string;
  mengetahuiSignDataUrl: string | null;

  // Signature 3: Bottom Full Width (Pengawas Pelaksana Pekerjaan)
  pengawasPerusahaan: string;
  pengawasNama: string;
  pengawasJabatan: string;
  pengawasSignDataUrl: string | null;
}

export interface MonthReportData {
  monthKey: string; // e.g., "laporan-worker-1-2026-04" or legacy "laporan-2026-04"
  workerId?: string;
  year: number;
  month: number; // 1..12
  days: Record<number, DayEntry>;
  updatedAt: string;
  isSampleData?: boolean;
}

export interface FullDatabaseBackup {
  version: number;
  exportedAt: string;
  metadata: ReportMetadata;
  admins?: AdminProfile[];
  units?: UnitKerja[];
  workers?: WorkerProfile[];
  months: Record<string, MonthReportData>;
}

export const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export const INDONESIAN_DAYS = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
] as const;
