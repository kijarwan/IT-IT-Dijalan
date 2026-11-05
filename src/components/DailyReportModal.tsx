import React, { useState, useRef } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ImagePlus,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { DayEntry } from '../types/report';
import { compressImageFile } from '../utils/storage';
import { generateSampleDocThumbnail } from '../utils/sampleData';

interface DailyReportModalProps {
  entry: DayEntry;
  previousFilledEntry: DayEntry | null;
  onSave: (updated: DayEntry) => void;
  onClose: () => void;
}

export const DailyReportModal: React.FC<DailyReportModalProps> = ({
  entry,
  previousFilledEntry,
  onSave,
  onClose,
}) => {
  const [tasks, setTasks] = useState<string[]>(
    entry.tasks.length > 0 ? [...entry.tasks] : ['']
  );
  const [photos, setPhotos] = useState<string[]>([...entry.photos]);
  const [completed, setCompleted] = useState<'Ya' | 'Tidak' | ''>(
    entry.completed || (entry.tasks.length > 0 ? 'Tidak' : '')
  );
  const [progress, setProgress] = useState<number>(
    entry.progress !== null && entry.progress !== undefined
      ? entry.progress
      : entry.completed === 'Ya'
      ? 100
      : 25
  );
  const [notes, setNotes] = useState<string>(entry.notes || '');
  const [isCompressing, setIsCompressing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTaskChange = (index: number, value: string) => {
    const next = [...tasks];
    next[index] = value;
    setTasks(next);
    // Ensure status defaults to Tidak if user starts typing tasks on an empty day
    if (completed === '' && value.trim() !== '') {
      setCompleted(progress === 100 ? 'Ya' : 'Tidak');
    }
  };

  const handleAddTask = () => {
    setTasks([...tasks, '']);
  };

  const handleRemoveTask = (index: number) => {
    if (tasks.length <= 1) {
      setTasks(['']);
      return;
    }
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const handleMoveTask = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tasks.length) return;
    const next = [...tasks];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    setTasks(next);
  };

  const handleCompletedChange = (newStatus: 'Ya' | 'Tidak') => {
    setCompleted(newStatus);
    if (newStatus === 'Ya') {
      setProgress(100);
    } else if (progress === 100) {
      setProgress(50);
    }
  };

  const handleProgressChange = (val: number) => {
    const clamped = Math.max(0, Math.min(100, Number.isNaN(val) ? 0 : val));
    setProgress(clamped);
    if (clamped === 100) {
      setCompleted('Ya');
    } else {
      setCompleted('Tidak');
    }
  };

  const handleCopyFromPrevious = () => {
    if (!previousFilledEntry) return;
    setTasks(
      previousFilledEntry.tasks.length > 0
        ? [...previousFilledEntry.tasks]
        : ['']
    );
    setCompleted(previousFilledEntry.completed || 'Tidak');
    setProgress(
      previousFilledEntry.progress !== null
        ? previousFilledEntry.progress
        : previousFilledEntry.completed === 'Ya'
        ? 100
        : 25
    );
    setNotes(previousFilledEntry.notes || '');
    setCopyFeedback(
      `Disalin dari ${previousFilledEntry.dayName}, ${previousFilledEntry.formattedDate}`
    );
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsCompressing(true);
    try {
      const compressedList: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        const dataUrl = await compressImageFile(file, 800, 0.82);
        compressedList.push(dataUrl);
      }
      if (compressedList.length > 0) {
        setPhotos((prev) => [...prev, ...compressedList]);
      }
    } catch (err) {
      console.error('Gagal mengompres gambar:', err);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleAddSampleThumbnail = () => {
    const variants: ('ims' | 'km' | 'rtm' | 'iso')[] = ['ims', 'km', 'rtm', 'iso'];
    const randomVariant = variants[photos.length % variants.length];
    const sampleUrl = generateSampleDocThumbnail(randomVariant);
    if (sampleUrl) {
      setPhotos((prev) => [...prev, sampleUrl]);
    }
  };

  const handleClearDay = () => {
    onSave({
      ...entry,
      tasks: [],
      photos: [],
      completed: '',
      progress: null,
      notes: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedTasks = tasks.map((t) => t.trim()).filter(Boolean);
    const isDayEmpty =
      cleanedTasks.length === 0 &&
      photos.length === 0 &&
      notes.trim() === '';

    const finalCompleted: 'Ya' | 'Tidak' | '' = isDayEmpty
      ? ''
      : progress === 100
      ? 'Ya'
      : completed || 'Tidak';

    const finalProgress = isDayEmpty
      ? null
      : finalCompleted === 'Ya'
      ? 100
      : progress;

    onSave({
      ...entry,
      tasks: cleanedTasks,
      photos,
      completed: finalCompleted,
      progress: finalProgress,
      notes: notes.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto no-print">
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Isi Laporan Harian — Hari ke-{entry.dayNumber}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {entry.dayName}, {entry.formattedDate}
              {entry.isWeekend ? ' · Akhir Pekan (Lembur Opsional)' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            aria-label="Tutup panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-5 space-y-5"
        >
          {/* Quick Action: Copy from Previous Day */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Tugas berulang dari hari kerja sebelumnya?
            </div>
            <div className="flex items-center gap-2">
              {copyFeedback && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {copyFeedback}
                </span>
              )}
              <button
                type="button"
                disabled={!previousFilledEntry}
                onClick={handleCopyFromPrevious}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                {previousFilledEntry
                  ? `Salin dari ${previousFilledEntry.dayName} (${previousFilledEntry.formattedDate.slice(0, 6)})`
                  : 'Belum ada hari sebelumnya'}
              </button>
            </div>
          </div>

          {/* 1. Uraian Tugas (Dynamic Numbered List) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Uraian Tugas (Otomatis Bernomor 1., 2., 3.)
              </label>
              <button
                type="button"
                onClick={handleAddTask}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Baris Tugas
              </button>
            </div>

            <div className="space-y-2">
              {tasks.map((taskText, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="w-6 pt-2 text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 text-right select-none">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    value={taskText}
                    onChange={(e) => handleTaskChange(idx, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTask();
                      }
                    }}
                    placeholder={`Ketik uraian tugas ke-${idx + 1}...`}
                    className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <div className="flex items-center gap-0.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleMoveTask(idx, 'up')}
                      disabled={idx === 0}
                      title="Pindah ke atas"
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 rounded"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveTask(idx, 'down')}
                      disabled={idx === tasks.length - 1}
                      title="Pindah ke bawah"
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 rounded"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveTask(idx)}
                      title="Hapus item tugas"
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Upload Dokumentasi Hasil Pekerjaan / Pendukung */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Dokumentasi Hasil Pekerjaan / Pendukung (Maks. lebar 800px otomatis)
              </label>
              <button
                type="button"
                onClick={handleAddSampleThumbnail}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                + Contoh Screenshot
              </button>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFilesSelected(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
              <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1" />
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {isCompressing
                  ? 'Mengompres gambar ke maks. 800px...'
                  : 'Klik untuk pilih gambar atau seret & lepas (drag & drop) di sini'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Mendukung banyak foto/screenshot sekaligus (PNG, JPG, WebP)
              </p>
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                {photos.map((src, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 aspect-video flex items-center justify-center"
                  >
                    <img
                      src={src}
                      alt={`Dokumentasi ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhotos(photos.filter((_, i) => i !== idx));
                      }}
                      className="absolute top-1.5 right-1.5 p-1 rounded-md bg-red-600/90 text-white hover:bg-red-700 shadow-xs transition-opacity"
                      title="Hapus gambar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Status Selesai & Progress (%) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                Selesai (Ya / Tidak)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleCompletedChange('Ya')}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                    completed === 'Ya'
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Ya (Selesai 100%)
                </button>
                <button
                  type="button"
                  onClick={() => handleCompletedChange('Tidak')}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                    completed === 'Tidak'
                      ? 'bg-amber-600 border-amber-600 text-white'
                      : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Tidak (Dalam Progress)
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Masih dalam progress (%)
                </label>
                <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                  {progress}%
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={progress}
                  onChange={(e) => handleProgressChange(Number(e.target.value))}
                  className="flex-1 accent-blue-600 cursor-pointer"
                />
                <div className="relative w-20">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={progress}
                    onChange={(e) => handleProgressChange(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-right pr-6"
                  />
                  <span className="absolute right-2 top-1.5 text-xs text-slate-400">
                    %
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Keterangan */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Keterangan
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Laporan Bulanan Monev IMS Tahun 2026 / kendala / tindak lanjut..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Modal Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={handleClearDay}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Kosongkan Hari
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                Batal
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors whitespace-nowrap shrink-0"
              >
                <Check className="w-4 h-4" />
                Simpan Perubahan
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
