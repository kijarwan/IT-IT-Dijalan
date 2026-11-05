import {
  AdminProfile,
  DayEntry,
  INDONESIAN_DAYS,
  INDONESIAN_MONTHS,
  MonthReportData,
  ReportMetadata,
  UnitKerja,
  WorkerProfile,
} from '../types/report';

export function getDefaultAdmins(): AdminProfile[] {
  return [
    {
      id: 'admin-1',
      nama: 'Primazahra Agya Zaenal Mutaqin',
      nip: '199008152018',
      jabatan: 'Pengawas Pelaksana Pekerjaan',
    },
    {
      id: 'admin-2',
      nama: 'Walesa Miduk Jayanto',
      nip: '198804122015',
      jabatan: 'Officer Reliability',
    },
  ];
}

export function formatIndonesianDate(year: number, month: number, day: number): string {
  const dd = String(day).padStart(2, '0');
  const monthName = INDONESIAN_MONTHS[month - 1] || 'Januari';
  return `${dd} ${monthName} ${year}`;
}

export function getMonthKey(year: number, month: number, workerId = 'worker-1'): string {
  return `laporan-${workerId}-${year}-${String(month).padStart(2, '0')}`;
}

export function createEmptyMonthData(
  year: number,
  month: number,
  workerId = 'worker-1'
): MonthReportData {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: Record<number, DayEntry> = {};

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = dateObj.getDay(); // 0 = Minggu, 6 = Sabtu
    const dayName = INDONESIAN_DAYS[dayOfWeek];
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dateIso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    days[d] = {
      dayNumber: d,
      dateIso,
      dayName,
      formattedDate: formatIndonesianDate(year, month, d),
      isWeekend,
      tasks: [],
      photos: [],
      completed: '',
      progress: null,
      notes: '',
    };
  }

  return {
    monthKey: getMonthKey(year, month, workerId),
    workerId,
    year,
    month,
    days,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Renders the default official "ENERGI DUTA UTAMA" logo to a PNG data URL
 * so it displays sharply on screen and embeds directly into PDF & Excel exports.
 */
export function generateDefaultLogoDataUrl(): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 440;
  canvas.height = 130;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // "E" in ENERGI
  ctx.fillStyle = '#232C3D';
  ctx.font = '900 58px Arial, Helvetica, sans-serif';
  ctx.fillText('E', 10, 74);

  // Stylized Red/Orange "N/V" check swoosh in ENERGI
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Left vertical leg of N
  ctx.strokeStyle = '#232C3D';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(62, 70);
  ctx.lineTo(62, 32);
  ctx.stroke();

  // Diagonal V-swoosh in orange-red gradient
  const grad = ctx.createLinearGradient(62, 30, 122, 12);
  grad.addColorStop(0, '#D92B2B');
  grad.addColorStop(0.55, '#E85D24');
  grad.addColorStop(1, '#F48C2A');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(62, 34);
  ctx.lineTo(88, 70);
  ctx.lineTo(118, 14);
  ctx.stroke();

  // "ERGI"
  ctx.fillStyle = '#232C3D';
  ctx.font = '900 58px Arial, Helvetica, sans-serif';
  ctx.fillText('ERGI', 114, 74);

  // "DUTA UTAMA" subtitle
  ctx.fillStyle = '#232C3D';
  ctx.font = '800 25px Arial, Helvetica, sans-serif';
  ctx.letterSpacing = '3.5px';
  ctx.fillText('DUTA UTAMA', 12, 110);

  return canvas.toDataURL('image/png');
}

/**
 * Generates realistic blue-ink signature PNG data URLs for the default state
 * matching the official PDF screenshot.
 */
export function generateSampleSignatureDataUrl(
  variant: 'petugas' | 'mengetahui' | 'pengawas'
): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 280;
  canvas.height = 130;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#1E3A8A';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (variant === 'petugas') {
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(75, 38);
    ctx.bezierCurveTo(105, 15, 112, 55, 80, 62);
    ctx.bezierCurveTo(60, 68, 110, 82, 85, 108);
    ctx.bezierCurveTo(72, 118, 65, 92, 95, 75);
    ctx.lineTo(122, 58);
    ctx.bezierCurveTo(126, 85, 134, 85, 142, 62);
    ctx.bezierCurveTo(148, 84, 158, 84, 166, 62);
    ctx.bezierCurveTo(174, 82, 185, 80, 196, 48);
    ctx.bezierCurveTo(202, 25, 188, 22, 186, 52);
    ctx.bezierCurveTo(185, 86, 200, 92, 225, 68);
    ctx.stroke();
  } else if (variant === 'mengetahui') {
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(85, 95);
    ctx.bezierCurveTo(68, 65, 92, 22, 106, 38);
    ctx.bezierCurveTo(115, 52, 88, 104, 104, 102);
    ctx.bezierCurveTo(118, 98, 124, 42, 132, 35);
    ctx.bezierCurveTo(136, 65, 134, 92, 145, 86);
    ctx.bezierCurveTo(154, 80, 162, 64, 174, 82);
    ctx.bezierCurveTo(184, 92, 198, 65, 192, 55);
    ctx.moveTo(118, 96);
    ctx.lineTo(228, 66);
    ctx.stroke();
  } else {
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(65, 88);
    ctx.bezierCurveTo(85, 25, 118, 28, 105, 92);
    ctx.bezierCurveTo(98, 108, 125, 50, 142, 62);
    ctx.bezierCurveTo(156, 72, 168, 44, 182, 76);
    ctx.bezierCurveTo(195, 92, 215, 58, 232, 64);
    ctx.stroke();
  }

  return canvas.toDataURL('image/png');
}

/**
 * Generates a realistic miniature work documentation screenshot (spreadsheet / portal table)
 * so sample rows display authentic thumbnails in "Dokumentasi Hasil Pekerjaan / Pendukung".
 */
export function generateSampleDocThumbnail(
  variant: 'ims' | 'km' | 'rtm' | 'iso' = 'ims'
): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 190;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const headerColors: Record<string, string> = {
    ims: '#0D9488',
    km: '#0284C7',
    rtm: '#1D4ED8',
    iso: '#15803D',
  };
  ctx.fillStyle = headerColors[variant] || '#0D9488';
  ctx.fillRect(0, 0, canvas.width, 26);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 10px Arial, sans-serif';
  const titles: Record<string, string> = {
    ims: 'MONITORING LAPORAN IMS & PROBIS 2026',
    km: 'PORTAL KNOWLEDGE CENTER & PEMETAAN KM',
    rtm: 'BAHAN RAPAT TINJAUAN MANAJEMEN (RTM) SEM 1',
    iso: 'TRAINING AWARENESS ISO 9001:2015 PLN IP',
  };
  ctx.fillText(titles[variant], 10, 17);

  const startY = 36;
  const rowH = 18;
  const cols = [10, 40, 165, 235, 310];

  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(10, startY, 300, rowH);

  for (let r = 0; r < 7; r++) {
    const y = startY + r * rowH;
    if (r > 0) {
      ctx.fillStyle = r % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
      ctx.fillRect(10, y, 300, rowH);

      ctx.fillStyle =
        r % 3 === 0 ? '#BBF7D0' : r % 2 === 0 ? '#FEF08A' : '#BAE6FD';
      ctx.fillRect(cols[2] + 4, y + 3, 60, rowH - 6);

      ctx.fillStyle = '#64748B';
      ctx.fillRect(cols[0] + 6, y + 7, 16, 4);
      ctx.fillRect(cols[1] + 6, y + 7, 95 + ((r * 17) % 20), 4);
      ctx.fillRect(cols[3] + 6, y + 7, 50, 4);
    }

    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, y, 300, rowH);
  }

  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

  return canvas.toDataURL('image/jpeg', 0.85);
}

export function getDefaultUnits(): UnitKerja[] {
  const defaultMengetahuiSign = generateSampleSignatureDataUrl('mengetahui');
  return [
    {
      id: 'unit-labuhan-angin',
      namaUnit: 'PT PLN Indonesia Power UBP Labuhan Angin',
      kodeSingkat: 'PLN IP UBP Labuhan Angin',
      lokasi: 'Tapanuli Tengah, Sumatera Utara',
      mengetahuiNama: '(Walesa Miduk Jayanto)',
      mengetahuiJabatan: 'Officer Reliability',
      mengetahuiSignDataUrl: defaultMengetahuiSign,
      pengawasPerusahaan: 'PT. Energi Duta Utama',
      pengawasNama: 'Primazahra Agya Zaenal Mutaqin',
      pengawasJabatan: 'Pengawas Pelaksana Pekerjaan',
      pengawasSignDataUrl: null,
    },
    {
      id: 'unit-pangkalan-susu',
      namaUnit: 'PT PLN Indonesia Power UBP Pangkalan Susu',
      kodeSingkat: 'PLN IP UBP Pangkalan Susu',
      lokasi: 'Langkat, Sumatera Utara',
      mengetahuiNama: '(Hendri Saputra Siregar)',
      mengetahuiJabatan: 'Team Leader Enjiniring & QA',
      mengetahuiSignDataUrl: defaultMengetahuiSign,
      pengawasPerusahaan: 'PT. Energi Duta Utama',
      pengawasNama: 'Primazahra Agya Zaenal Mutaqin',
      pengawasJabatan: 'Pengawas Pelaksana Pekerjaan',
      pengawasSignDataUrl: null,
    },
    {
      id: 'unit-belawan',
      namaUnit: 'PT PLN Indonesia Power UBP Belawan',
      kodeSingkat: 'PLN IP UBP Belawan',
      lokasi: 'Medan Belawan, Sumatera Utara',
      mengetahuiNama: '(Rizky Pratama Nasution)',
      mengetahuiJabatan: 'Officer K3L & Keamanan',
      mengetahuiSignDataUrl: null,
      pengawasPerusahaan: 'PT. Energi Duta Utama',
      pengawasNama: 'Primazahra Agya Zaenal Mutaqin',
      pengawasJabatan: 'Pengawas Pelaksana Pekerjaan',
      pengawasSignDataUrl: null,
    },
  ];
}

export function getDefaultWorkers(): WorkerProfile[] {
  const defaultPetugasSign = generateSampleSignatureDataUrl('petugas');
  return [
    {
      id: 'worker-1',
      nama: 'Desi Natalia Gultom',
      nip: '40920241363',
      unitId: 'unit-labuhan-angin',
      divisi: 'SMT, KM & Risiko',
      jabatan: 'Admin SMT, KM dan Risiko',
      petugasSignDataUrl: defaultPetugasSign,
    },
    {
      id: 'worker-2',
      nama: 'Budi Santoso Pasaribu',
      nip: '40920241364',
      unitId: 'unit-labuhan-angin',
      divisi: 'Pemeliharaan & Keandalan',
      jabatan: 'Technical Assistant Pemeliharaan',
      petugasSignDataUrl: defaultPetugasSign,
    },
    {
      id: 'worker-3',
      nama: 'Rina Maharani Lubis',
      nip: '40920241388',
      unitId: 'unit-pangkalan-susu',
      divisi: 'Administrasi & Umum',
      jabatan: 'Technical Assistant Dokumentasi',
      petugasSignDataUrl: defaultPetugasSign,
    },
    {
      id: 'worker-4',
      nama: 'Andi Kurniawan Tanjung',
      nip: '40920241402',
      unitId: 'unit-belawan',
      divisi: 'K3 & Lingkungan',
      jabatan: 'Technical Assistant K3L',
      petugasSignDataUrl: null,
    },
  ];
}

export function getDefaultMetadata(): ReportMetadata {
  return {
    judulLaporan: 'LAPORAN PELAKSANAAN TECHNICAL ASSISTANT',
    nama: 'Desi Natalia Gultom',
    nip: '40920241363',
    divisi: 'SMT, KM & Risiko',
    unit: 'PT PLN Indonesia Power UBP Labuhan Angin',
    logoDataUrl: null,

    petugasLabel: 'Petugas Pelapor,',
    petugasNama: '(Desi Natalia Gultom)',
    petugasJabatan: 'Admin SMT, KM dan Risiko',
    petugasSignDataUrl: generateSampleSignatureDataUrl('petugas'),

    mengetahuiLabel: 'Mengetahui,',
    mengetahuiUnitAtas: 'PT PLN Indonesia Power UBP Labuhan Angin',
    mengetahuiNama: '(Walesa Miduk Jayanto)',
    mengetahuiJabatan: 'Officer Reliability',
    mengetahuiUnitBawah: 'PLN IP UBP Labuhan Angin',
    mengetahuiSignDataUrl: generateSampleSignatureDataUrl('mengetahui'),

    pengawasPerusahaan: 'PT. Energi Duta Utama',
    pengawasNama: 'Primazahra Agya Zaenal Mutaqin',
    pengawasJabatan: 'Pengawas Pelaksana Pekerjaan',
    pengawasSignDataUrl: null,
  };
}

/**
 * Merges a WorkerProfile + UnitKerja + global logo/title into a unified ReportMetadata
 * for rendering on the A4 sheet and exporting to PDF/Excel/CSV.
 */
export function buildWorkerReportMetadata(
  worker: WorkerProfile,
  unit: UnitKerja | undefined,
  globalLogoDataUrl: string | null,
  judulLaporan?: string
): ReportMetadata {
  const formattedPetugasName = worker.nama.startsWith('(')
    ? worker.nama
    : `(${worker.nama})`;

  return {
    judulLaporan: judulLaporan || 'LAPORAN PELAKSANAAN TECHNICAL ASSISTANT',
    nama: worker.nama,
    nip: worker.nip,
    divisi: worker.divisi,
    unit: unit?.namaUnit || 'PT PLN Indonesia Power UBP Labuhan Angin',
    logoDataUrl: globalLogoDataUrl,

    petugasLabel: 'Petugas Pelapor,',
    petugasNama: formattedPetugasName,
    petugasJabatan: worker.jabatan || 'Technical Assistant',
    petugasSignDataUrl: worker.petugasSignDataUrl,

    mengetahuiLabel: 'Mengetahui,',
    mengetahuiUnitAtas:
      unit?.namaUnit || 'PT PLN Indonesia Power UBP Labuhan Angin',
    mengetahuiNama: unit?.mengetahuiNama || '(Walesa Miduk Jayanto)',
    mengetahuiJabatan: unit?.mengetahuiJabatan || 'Officer Reliability',
    mengetahuiUnitBawah: unit?.kodeSingkat || 'PLN IP UBP Labuhan Angin',
    mengetahuiSignDataUrl: unit?.mengetahuiSignDataUrl ?? null,

    pengawasPerusahaan: unit?.pengawasPerusahaan || 'PT. Energi Duta Utama',
    pengawasNama: unit?.pengawasNama || 'Primazahra Agya Zaenal Mutaqin',
    pengawasJabatan: unit?.pengawasJabatan || 'Pengawas Pelaksana Pekerjaan',
    pengawasSignDataUrl: unit?.pengawasSignDataUrl ?? null,
  };
}

/**
 * Generates the preloaded sample data for April 2026 (as requested in Section 6)
 */
export function createPreloadedApril2026(workerId = 'worker-1'): MonthReportData {
  const monthData = createEmptyMonthData(2026, 4, workerId);
  monthData.isSampleData = true;

  const thumbIms = generateSampleDocThumbnail('ims');
  const thumbKm = generateSampleDocThumbnail('km');
  const thumbRtm = generateSampleDocThumbnail('rtm');
  const thumbIso = generateSampleDocThumbnail('iso');

  if (workerId === 'worker-1') {
    // 01 April 2026 (Rabu)
    monthData.days[1] = {
      ...monthData.days[1],
      tasks: [
        'Update Laporan Integrated Management System (IMS)',
        'Update Kertas Kerja Pemetaan KM Tahun 2026',
        'Update Laporan Akses Portal KC Tahun 2026',
        'Review dan Revisi Proses Bisnis Level 5 Bidang Enjineering',
      ],
      photos: thumbIms ? [thumbIms] : [],
      completed: 'Tidak',
      progress: 33,
      notes: 'Laporan Bulanan Monev IMS Tahun 2026',
    };

    // 02 April 2026 (Kamis)
    monthData.days[2] = {
      ...monthData.days[2],
      tasks: [
        'Update Laporan Integrated Management System (IMS)',
        'Update Kertas Kerja Pemetaan KM Tahun 2026',
        'Review dan Revisi Proses Bisnis Level 5 Bidang Enjineering',
      ],
      photos: thumbKm ? [thumbKm] : [],
      completed: 'Tidak',
      progress: 33,
      notes: 'Laporan Bulanan Monev IMS Tahun 2026',
    };

    // 08 April 2026 (Rabu)
    monthData.days[8] = {
      ...monthData.days[8],
      tasks: [
        'Menyusun Bahan Rapat Tinjauan Manajemen (RTM) SMT dan KM SEM 1 Tahun 2026',
        'Revisi SK Tim SME KM Tahun 2026',
        'Review dan Revisi Proses Bisnis Level 5 Bidang K3K',
      ],
      photos: thumbRtm ? [thumbRtm] : [],
      completed: 'Ya',
      progress: 100,
      notes: 'Bahan RTM SMT dan KM sudah 100% selesai',
    };

    // 09 April 2026 (Kamis)
    monthData.days[9] = {
      ...monthData.days[9],
      tasks: [
        'Monitoring bahan RTM setiap Bidang/PIC',
        'Pengecekan Kesesuaian Klausul Standarisasi bahan RTM setiap bidang',
      ],
      photos: thumbKm ? [thumbKm] : [],
      completed: 'Tidak',
      progress: 10,
      notes:
        'Bidang terkait masih belum memberikan data secara lengkap dikarenakan masih banyak kesibukan',
    };

    // 22 April 2026 (Rabu)
    monthData.days[22] = {
      ...monthData.days[22],
      tasks: ['Pelaksanaan Rapat Tinjauan Manajemen (RTM) SEM 1 Tahun 2026'],
      photos: thumbRtm ? [thumbRtm] : [],
      completed: 'Ya',
      progress: 100,
      notes: 'Pelaksanaan RTM Semester 1 Tahun 2026 berjalan lancar',
    };

    // 30 April 2026 (Kamis)
    monthData.days[30] = {
      ...monthData.days[30],
      tasks: ['Training Awareness ISO 9001'],
      photos: thumbIso ? [thumbIso] : [],
      completed: 'Ya',
      progress: 100,
      notes: 'Hari 2 : Training Awareness ISO 9001',
    };
  } else {
    // Sample rows for other preloaded workers so Admin monitoring shows live data across units
    monthData.days[1] = {
      ...monthData.days[1],
      tasks: [
        'Rekapitulasi Laporan Harian Pemeliharaan Preventif Unit',
        'Verifikasi Dokumen Work Order (WO) Mingguan',
      ],
      photos: thumbIms ? [thumbIms] : [],
      completed: 'Ya',
      progress: 100,
      notes: 'Dokumen WO telah diverifikasi oleh Supervisor',
    };
    monthData.days[2] = {
      ...monthData.days[2],
      tasks: [
        'Inspeksi Rutin Kepatuhan SOP & Dokumentasi Area Kerja',
        'Input Data Monitoring Kehadiran dan Realisasi Jam Kerja',
      ],
      photos: thumbKm ? [thumbKm] : [],
      completed: 'Tidak',
      progress: 65,
      notes: 'Menunggu konfirmasi data lapangan shift sore',
    };
  }

  return monthData;
}

/**
 * Generates the preloaded sample data for Maret 2026 matching the user's attached PDF
 */
export function createPreloadedMarch2026(workerId = 'worker-1'): MonthReportData {
  const monthData = createEmptyMonthData(2026, 3, workerId);
  monthData.isSampleData = true;

  if (workerId !== 'worker-1') return monthData;

  const thumbIms = generateSampleDocThumbnail('ims');
  const thumbKm = generateSampleDocThumbnail('km');
  const thumbRtm = generateSampleDocThumbnail('rtm');

  const fillDay = (
    day: number,
    tasks: string[],
    completed: 'Ya' | 'Tidak',
    progress: number,
    notes: string,
    thumb: string
  ) => {
    if (!monthData.days[day]) return;
    monthData.days[day] = {
      ...monthData.days[day],
      tasks,
      photos: thumb ? [thumb] : [],
      completed,
      progress,
      notes,
    };
  };

  const kmNote =
    'Monitoring Kegiatan akan terus dilakukan hingga Target OCR BE KM Tahun 2026 Tercapai';

  fillDay(
    2,
    [
      'Update Laporan Integrated Management System (IMS)',
      'Mengarsipkan Dokumen SMT',
      'Menyusun Dokumen Knowledge Management',
    ],
    'Tidak',
    25,
    'Laporan Bulanan Monev IMS Tahun 2026',
    thumbIms
  );
  fillDay(
    3,
    [
      'Update Laporan Integrated Management System (IMS)',
      'Review dan revisi proses bisnis level 5 bidang Enjineering',
    ],
    'Tidak',
    25,
    'Laporan Bulanan Monev IMS Tahun 2026',
    thumbIms
  );
  fillDay(
    4,
    [
      'Update Laporan Integrated Management System (IMS)',
      'Melakukan follow up dan pendampingan kepada Innovator terkait proses penyusunan dokumen Inovasi',
    ],
    'Tidak',
    25,
    'Laporan Bulanan Monev IMS Tahun 2026',
    thumbIms
  );
  fillDay(
    5,
    [
      'Update Laporan Integrated Management System (IMS)',
      'Melakukan follow up dan pendampingan kepada Innovator terkait proses penyusunan dokumen Inovasi',
    ],
    'Tidak',
    25,
    'Laporan Bulanan Monev IMS Tahun 2026',
    thumbIms
  );

  for (const d of [6, 9, 10, 16, 17, 23, 24]) {
    fillDay(
      d,
      [
        'Monitoring Kegiatan Knowledge Management Tahun 2026',
        'Monitoring Akses Portal Knowledge Center Tahun 2026',
        'Review dan Revisi Probis Level 5 Bidang K3K',
      ],
      'Tidak',
      25,
      kmNote,
      thumbKm
    );
  }

  fillDay(
    11,
    [
      'Monitoring Kegiatan Knowledge Management Tahun 2026',
      'Monitoring Akses Portal Knowledge Center Tahun 2026',
      'Melakukan follow up dan pendampingan kepada Innovator terkait proses penyusunan dokumen Inovasi',
    ],
    'Tidak',
    25,
    kmNote,
    thumbKm
  );

  for (const d of [12, 13, 18, 19, 20, 25]) {
    fillDay(
      d,
      [
        'Monitoring Kegiatan Knowledge Management Tahun 2026',
        'Monitoring Akses Portal Knowledge Center Tahun 2026',
      ],
      'Tidak',
      25,
      kmNote,
      thumbKm
    );
  }

  fillDay(
    26,
    [
      'Monitoring Kegiatan Knowledge Management Tahun 2026',
      'Monitoring Akses Portal Knowledge Center Tahun 2026',
      'Review dan Revisi Probis Level 5 Bidang K3K',
    ],
    'Tidak',
    37,
    'PROBIS dalam tahap penyempurnaan; masih terdapat revisi yang perlu ditindaklanjuti dan masih banyak dokumen yang belum dikerjakan oleh setiap bidang',
    thumbKm
  );

  fillDay(
    27,
    [
      'Monitoring Kegiatan Knowledge Management Tahun 2026',
      'Monitoring Akses Portal Knowledge Center Tahun 2026',
      'Pemetaan Knowledge Management Tahun 2026',
      'Menyusun Dokumen Kegiatan Knowledge Management',
    ],
    'Tidak',
    25,
    kmNote,
    thumbKm
  );

  fillDay(
    30,
    [
      'Monitoring Kegiatan Knowledge Management Tahun 2026',
      'Monitoring Akses Portal Knowledge Center Tahun 2026',
      'Pemetaan Knowledge Management Tahun 2026',
      'Menyusun SK Tim SMT dan SK Tim SME KM Tahun 2026',
    ],
    'Tidak',
    75,
    'SK Tim SMT dan SK Tim SME KM sedang direview oleh User',
    thumbRtm
  );

  fillDay(
    31,
    [
      'Sosialisasi Innovation Gateway PLN 2026',
      'Monitoring Kegiatan Knowledge Management Tahun 2026',
      'Monitoring Akses Portal Knowledge Center Tahun 2026',
      'Pemetaan Knowledge Management Tahun 2026',
      'Menyusun SK Tim SMT dan SK Tim SME KM Tahun 2026',
      'Review dan Revisi Probis Level 5 Bidang K3K',
      'Review Dokumen Inovasi Tahun 2026',
    ],
    'Tidak',
    75,
    'SK Tim SMT dan SK Tim SME KM sedang direview oleh User',
    thumbRtm
  );

  return monthData;
}
