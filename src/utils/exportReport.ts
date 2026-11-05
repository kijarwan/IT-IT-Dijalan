import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import {
  INDONESIAN_MONTHS,
  MonthReportData,
  ReportMetadata,
} from '../types/report';
import { generateDefaultLogoDataUrl } from './sampleData';

function getImageFormatFromDataUrl(dataUrl: string): 'PNG' | 'JPEG' {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  return 'JPEG';
}

export function getExportBaseFilename(
  monthData: MonthReportData,
  metadata: ReportMetadata
): string {
  const monthName = (INDONESIAN_MONTHS[monthData.month - 1] || 'APRIL').toUpperCase();
  const cleanName = (metadata.nama || 'DESI NATALIA GULTOM').trim().toUpperCase();
  return `LAPORAN PELAKSANAAN - ${cleanName} - ${monthName} ${monthData.year}`;
}

/**
 * Generates and downloads an official A4 Portrait PDF for the selected month.
 */
export async function exportMonthToPDF(
  monthData: MonthReportData,
  metadata: ReportMetadata
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 15; // 1.5 cm margin

  // 1. Logo at top-left
  const logoUrl = metadata.logoDataUrl || generateDefaultLogoDataUrl();
  if (logoUrl) {
    try {
      doc.addImage(
        logoUrl,
        getImageFormatFromDataUrl(logoUrl),
        margin,
        12,
        30,
        9,
        undefined,
        'FAST'
      );
    } catch {
      // Fallback text if image fails
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('ENERGI DUTA UTAMA', margin, 18);
    }
  }

  // 2. Centered Report Title (Times New Roman, 11pt, Bold)
  const reportTitle =
    metadata.judulLaporan || 'LAPORAN PELAKSANAAN TECHNICAL ASSISTANT';
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(reportTitle, pageWidth / 2, 24, {
    align: 'center',
  });

  // 3. Identity Block (Times New Roman, 9pt, Bold)
  const monthName = INDONESIAN_MONTHS[monthData.month - 1] || 'April';
  const identityRows: [string, string][] = [
    ['Nama', metadata.nama],
    ['Divisi', metadata.divisi],
    ['Unit', metadata.unit],
    ['Bulan dan tahun', `${monthName} ${monthData.year}`],
  ];

  let currentY = 29;
  doc.setFontSize(9);
  for (const [label, value] of identityRows) {
    doc.setFont('times', 'bold');
    doc.text(label, margin, currentY);
    doc.text(':', margin + 32, currentY);
    doc.text(value || '', margin + 34.5, currentY);
    currentY += 4.2;
  }

  // 4. Prepare Table Rows (1..daysInMonth)
  const daysInMonth = new Date(monthData.year, monthData.month, 0).getDate();
  const bodyRows: (string | number)[][] = [];
  const rowPhotosMap: Record<number, string[]> = {};

  for (let d = 1; d <= daysInMonth; d++) {
    const entry = monthData.days[d];
    if (!entry) continue;

    const tasksText =
      entry.tasks && entry.tasks.length > 0
        ? entry.tasks.map((t, idx) => `${idx + 1}. ${t}`).join('\n')
        : '';

    const completedText =
      entry.completed || (entry.tasks.length > 0 ? 'Tidak' : '');
    const progressText =
      entry.progress !== null && entry.progress !== undefined && completedText
        ? `${entry.progress}%`
        : completedText === 'Ya'
        ? '100%'
        : '';

    if (entry.photos && entry.photos.length > 0) {
      rowPhotosMap[d - 1] = entry.photos;
    }

    // Reserve vertical space in column 4 if photos exist
    const photoPlaceholder =
      entry.photos && entry.photos.length > 0
        ? '\n'.repeat(Math.min(entry.photos.length, 2) * 3)
        : '';

    bodyRows.push([
      entry.dayNumber,
      entry.dayName,
      entry.formattedDate,
      tasksText,
      photoPlaceholder,
      completedText,
      progressText,
      entry.notes || '',
    ]);
  }

  // 5. Render Main Table with autoTable
  autoTable(doc, {
    startY: currentY + 1.5,
    margin: { top: 15, right: margin, bottom: 15, left: margin },
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    theme: 'grid',
    head: [
      [
        { content: 'No.', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'Hari', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'Tanggal', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        {
          content: 'Uraian Tugas',
          rowSpan: 2,
          styles: { valign: 'middle', halign: 'center' },
        },
        {
          content: 'Dokumentasi Hasil\nPekerjaan / Pendukung',
          rowSpan: 2,
          styles: { valign: 'middle', halign: 'center' },
        },
        {
          content: 'Progress Tugas',
          colSpan: 2,
          styles: { valign: 'middle', halign: 'center' },
        },
        {
          content: 'Keterangan',
          rowSpan: 2,
          styles: { valign: 'middle', halign: 'center' },
        },
      ],
      [
        {
          content: 'Selesai\n(ya/tidak)',
          styles: { valign: 'middle', halign: 'center' },
        },
        {
          content: 'Masih dalam\nprogress (%)',
          styles: { valign: 'middle', halign: 'center' },
        },
      ],
    ],
    body: bodyRows,
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      cellPadding: { top: 1.4, right: 1.6, bottom: 1.4, left: 1.6 },
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      font: 'times',
      fontStyle: 'bold',
      fontSize: 8.5,
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      halign: 'center',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' }, // No.
      1: { cellWidth: 13, halign: 'left' }, // Hari
      2: { cellWidth: 23, halign: 'center' }, // Tanggal
      3: { cellWidth: 59, halign: 'left' }, // Uraian Tugas
      4: { cellWidth: 26, halign: 'center' }, // Dokumentasi
      5: { cellWidth: 13, halign: 'center' }, // Selesai
      6: { cellWidth: 14, halign: 'center' }, // Progress (%)
      7: { cellWidth: 24, halign: 'left' }, // Keterangan (Total = 180mm)
    },
    didParseCell: (data) => {
      // Ensure weekend rows are pure white in PDF and have minimum height if photos exist
      if (data.section === 'body') {
        data.cell.styles.fillColor = [255, 255, 255];
        const photos = rowPhotosMap[data.row.index];
        if (photos && photos.length > 0 && data.column.index === 4) {
          data.cell.styles.minCellHeight = Math.max(
            15 * Math.min(photos.length, 2),
            16
          );
        }
      }
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const photos = rowPhotosMap[data.row.index];
        if (photos && photos.length > 0) {
          const maxPhotosToRender = Math.min(photos.length, 2);
          const thumbW = 21;
          const thumbH = 12.5;
          const totalH =
            maxPhotosToRender * thumbH + (maxPhotosToRender - 1) * 1.2;
          let startY = data.cell.y + (data.cell.height - totalH) / 2;
          const startX = data.cell.x + (data.cell.width - thumbW) / 2;

          for (let i = 0; i < maxPhotosToRender; i++) {
            const imgData = photos[i];
            try {
              doc.addImage(
                imgData,
                getImageFormatFromDataUrl(imgData),
                startX,
                startY,
                thumbW,
                thumbH,
                undefined,
                'FAST'
              );
            } catch {
              // Ignore broken image
            }
            startY += thumbH + 1.2;
          }
        }
      }
    },
  });

  // 6. Signature Block (Must never split across pages!)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY || currentY + 20;
  const sigBoxWidth = 118;
  const sigRow1Height = 36;
  const sigRow2Height = 29;
  const totalSigHeight = sigRow1Height + sigRow2Height;

  let sigStartY = finalY + 4;
  if (sigStartY + totalSigHeight > pageHeight - margin) {
    doc.addPage();
    sigStartY = margin + 4;
  }

  const sigStartX = (pageWidth - sigBoxWidth) / 2;
  const colW = sigBoxWidth / 2;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);

  // Outer rectangle of Signature Block
  doc.rect(sigStartX, sigStartY, sigBoxWidth, totalSigHeight);
  // Horizontal divider between Row 1 and Row 2
  doc.line(
    sigStartX,
    sigStartY + sigRow1Height,
    sigStartX + sigBoxWidth,
    sigStartY + sigRow1Height
  );
  // Vertical divider in Row 1
  doc.line(
    sigStartX + colW,
    sigStartY,
    sigStartX + colW,
    sigStartY + sigRow1Height
  );

  const drawUnderlinedBoldText = (
    text: string,
    centerX: number,
    y: number,
    fontSize = 8.5
  ) => {
    doc.setFont('times', 'bold');
    doc.setFontSize(fontSize);
    doc.text(text, centerX, y, { align: 'center' });
    const textW = doc.getTextWidth(text);
    doc.setLineWidth(0.25);
    doc.line(centerX - textW / 2, y + 0.6, centerX + textW / 2, y + 0.6);
  };

  // Left Top Cell: Petugas Pelapor
  const leftCenterX = sigStartX + colW / 2;
  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  doc.text(metadata.petugasLabel || 'Petugas Pelapor,', leftCenterX, sigStartY + 4.5, {
    align: 'center',
  });

  if (metadata.petugasSignDataUrl) {
    try {
      doc.addImage(
        metadata.petugasSignDataUrl,
        getImageFormatFromDataUrl(metadata.petugasSignDataUrl),
        leftCenterX - 14,
        sigStartY + 6.5,
        28,
        15,
        undefined,
        'FAST'
      );
    } catch {
      // Ignore
    }
  }

  drawUnderlinedBoldText(
    metadata.petugasNama || '(Desi Natalia Gultom)',
    leftCenterX,
    sigStartY + 26.5
  );
  doc.setFont('times', 'bold');
  doc.setFontSize(8.5);
  doc.text(
    metadata.petugasJabatan || 'Admin SMT, KM dan Risiko',
    leftCenterX,
    sigStartY + 30.2,
    { align: 'center' }
  );

  // Right Top Cell: Mengetahui
  const rightCenterX = sigStartX + colW + colW / 2;
  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  doc.text(metadata.mengetahuiLabel || 'Mengetahui,', rightCenterX, sigStartY + 4.5, {
    align: 'center',
  });
  doc.setFontSize(8);
  doc.text(
    metadata.mengetahuiUnitAtas || 'PT PLN Indonesia Power UBP Labuhan Angin',
    rightCenterX,
    sigStartY + 9.2,
    { align: 'center', maxWidth: colW - 4 }
  );

  if (metadata.mengetahuiSignDataUrl) {
    try {
      doc.addImage(
        metadata.mengetahuiSignDataUrl,
        getImageFormatFromDataUrl(metadata.mengetahuiSignDataUrl),
        rightCenterX - 13,
        sigStartY + 11.2,
        26,
        12.5,
        undefined,
        'FAST'
      );
    } catch {
      // Ignore
    }
  }

  drawUnderlinedBoldText(
    metadata.mengetahuiNama || '(Walesa Miduk Jayanto)',
    rightCenterX,
    sigStartY + 26.5
  );
  doc.setFont('times', 'bold');
  doc.setFontSize(8.5);
  doc.text(
    metadata.mengetahuiJabatan || 'Officer Reliability',
    rightCenterX,
    sigStartY + 30.2,
    { align: 'center' }
  );
  doc.text(
    metadata.mengetahuiUnitBawah || 'PLN IP UBP Labuhan Angin',
    rightCenterX,
    sigStartY + 33.8,
    { align: 'center' }
  );

  // Bottom Full-Width Cell: PT. Energi Duta Utama / Pengawas
  const bottomCenterX = sigStartX + sigBoxWidth / 2;
  const row2StartY = sigStartY + sigRow1Height;
  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    metadata.pengawasPerusahaan || 'PT. Energi Duta Utama',
    bottomCenterX,
    row2StartY + 4.5,
    { align: 'center' }
  );

  if (metadata.pengawasSignDataUrl) {
    try {
      doc.addImage(
        metadata.pengawasSignDataUrl,
        getImageFormatFromDataUrl(metadata.pengawasSignDataUrl),
        bottomCenterX - 14,
        row2StartY + 6,
        28,
        13,
        undefined,
        'FAST'
      );
    } catch {
      // Ignore
    }
  }

  drawUnderlinedBoldText(
    metadata.pengawasNama || 'Primazahra Agya Zaenal Mutaqin',
    bottomCenterX,
    row2StartY + 22.5
  );
  doc.setFont('times', 'bold');
  doc.setFontSize(8.5);
  doc.text(
    metadata.pengawasJabatan || 'Pengawas Pelaksana Pekerjaan',
    bottomCenterX,
    row2StartY + 26.2,
    { align: 'center' }
  );

  const filename = `${getExportBaseFilename(monthData, metadata)}.pdf`;
  doc.save(filename);
}

/**
 * Generates and downloads a CSV file of the monthly report (with UTF-8 BOM for Excel).
 */
export function exportMonthToCSV(
  monthData: MonthReportData,
  metadata: ReportMetadata
): void {
  const monthName = INDONESIAN_MONTHS[monthData.month - 1] || 'April';
  const escapeCsv = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const reportTitle =
    metadata.judulLaporan || 'LAPORAN PELAKSANAAN TECHNICAL ASSISTANT';
  const lines: string[] = [
    [reportTitle].map(escapeCsv).join(','),
    ['Nama', metadata.nama].map(escapeCsv).join(','),
    ['Divisi', metadata.divisi].map(escapeCsv).join(','),
    ['Unit', metadata.unit].map(escapeCsv).join(','),
    ['Bulan dan tahun', `${monthName} ${monthData.year}`].map(escapeCsv).join(','),
    '',
    [
      'No.',
      'Hari',
      'Tanggal',
      'Uraian Tugas',
      'Jumlah Dokumentasi',
      'Selesai (ya/tidak)',
      'Masih dalam progress (%)',
      'Keterangan',
    ]
      .map(escapeCsv)
      .join(','),
  ];

  const daysInMonth = new Date(monthData.year, monthData.month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const entry = monthData.days[d];
    if (!entry) continue;
    const tasksText = entry.tasks
      .map((t, idx) => `${idx + 1}. ${t}`)
      .join('\n');
    const completedText =
      entry.completed || (entry.tasks.length > 0 ? 'Tidak' : '');
    const progressText =
      entry.progress !== null && entry.progress !== undefined && completedText
        ? `${entry.progress}%`
        : completedText === 'Ya'
        ? '100%'
        : '';

    lines.push(
      [
        entry.dayNumber,
        entry.dayName,
        entry.formattedDate,
        tasksText,
        entry.photos.length > 0 ? `${entry.photos.length} foto` : '',
        completedText,
        progressText,
        entry.notes || '',
      ]
        .map(escapeCsv)
        .join(',')
    );
  }

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${getExportBaseFilename(monthData, metadata)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads an Excel (.xlsx) workbook with embedded images and official styling.
 */
export async function exportMonthToExcel(
  monthData: MonthReportData,
  metadata: ReportMetadata
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const monthName = INDONESIAN_MONTHS[monthData.month - 1] || 'April';
  const sheet = workbook.addWorksheet(`${monthName} ${monthData.year}`, {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true },
  });

  sheet.columns = [
    { key: 'no', width: 6 },
    { key: 'hari', width: 11 },
    { key: 'tanggal', width: 17 },
    { key: 'uraian', width: 46 },
    { key: 'dokumentasi', width: 20 },
    { key: 'selesai', width: 13 },
    { key: 'progress', width: 15 },
    { key: 'keterangan', width: 32 },
  ];

  // Title row
  sheet.mergeCells('A2:H2');
  const titleCell = sheet.getCell('A2');
  titleCell.value =
    metadata.judulLaporan || 'LAPORAN PELAKSANAAN TECHNICAL ASSISTANT';
  titleCell.font = { name: 'Times New Roman', size: 12, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Identity rows
  const idData: [string, string][] = [
    ['Nama', `: ${metadata.nama}`],
    ['Divisi', `: ${metadata.divisi}`],
    ['Unit', `: ${metadata.unit}`],
    ['Bulan dan tahun', `: ${monthName} ${monthData.year}`],
  ];

  idData.forEach(([label, val], idx) => {
    const r = 3 + idx;
    sheet.mergeCells(`A${r}:B${r}`);
    sheet.mergeCells(`C${r}:H${r}`);
    sheet.getCell(`A${r}`).value = label;
    sheet.getCell(`A${r}`).font = { name: 'Times New Roman', size: 10, bold: true };
    sheet.getCell(`C${r}`).value = val;
    sheet.getCell(`C${r}`).font = { name: 'Times New Roman', size: 10, bold: true };
  });

  // Table Headers (Rows 8 & 9)
  sheet.mergeCells('A8:A9');
  sheet.mergeCells('B8:B9');
  sheet.mergeCells('C8:C9');
  sheet.mergeCells('D8:D9');
  sheet.mergeCells('E8:E9');
  sheet.mergeCells('F8:G8');
  sheet.mergeCells('H8:H9');

  sheet.getCell('A8').value = 'No.';
  sheet.getCell('B8').value = 'Hari';
  sheet.getCell('C8').value = 'Tanggal';
  sheet.getCell('D8').value = 'Uraian Tugas';
  sheet.getCell('E8').value = 'Dokumentasi Hasil Pekerjaan / Pendukung';
  sheet.getCell('F8').value = 'Progress Tugas';
  sheet.getCell('F9').value = 'Selesai (ya/tidak)';
  sheet.getCell('G9').value = 'Masih dalam progress (%)';
  sheet.getCell('H8').value = 'Keterangan';

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  for (let r = 8; r <= 9; r++) {
    sheet.getRow(r).height = 22;
    for (let c = 1; c <= 8; c++) {
      const cell = sheet.getCell(r, c);
      cell.font = { name: 'Times New Roman', size: 10, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
    }
  }

  const daysInMonth = new Date(monthData.year, monthData.month, 0).getDate();
  let currentRow = 10;

  for (let d = 1; d <= daysInMonth; d++) {
    const entry = monthData.days[d];
    if (!entry) continue;

    const tasksText = entry.tasks
      .map((t, idx) => `${idx + 1}. ${t}`)
      .join('\n');
    const completedText =
      entry.completed || (entry.tasks.length > 0 ? 'Tidak' : '');
    const progressText =
      entry.progress !== null && entry.progress !== undefined && completedText
        ? `${entry.progress}%`
        : completedText === 'Ya'
        ? '100%'
        : '';

    const row = sheet.getRow(currentRow);
    row.values = [
      entry.dayNumber,
      entry.dayName,
      entry.formattedDate,
      tasksText,
      '',
      completedText,
      progressText,
      entry.notes || '',
    ];

    const lineCount = Math.max(entry.tasks.length, 1);
    const hasPhoto = entry.photos && entry.photos.length > 0;
    row.height = hasPhoto ? Math.max(52, lineCount * 15) : Math.max(18, lineCount * 14);

    for (let c = 1; c <= 8; c++) {
      const cell = row.getCell(c);
      cell.font = { name: 'Calibri', size: 9 };
      cell.border = thinBorder;
      cell.alignment = {
        vertical: 'middle',
        horizontal: c === 1 || c === 3 || c === 5 || c === 6 || c === 7 ? 'center' : 'left',
        wrapText: true,
      };
    }

    // Embed first thumbnail photo inside column E if present
    if (hasPhoto) {
      try {
        const photoUrl = entry.photos[0];
        const ext = photoUrl.startsWith('data:image/png') ? 'png' : 'jpeg';
        const imgId = workbook.addImage({
          base64: photoUrl,
          extension: ext,
        });
        sheet.addImage(imgId, {
          tl: { col: 4.15, row: currentRow - 1 + 0.12 },
          ext: { width: 95, height: 55 },
        });
      } catch {
        // Ignore image embed failure
      }
    }

    currentRow++;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${getExportBaseFilename(monthData, metadata)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
