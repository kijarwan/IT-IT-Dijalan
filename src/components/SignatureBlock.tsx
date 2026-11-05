import React, { useRef } from 'react';
import { Lock, Trash2, Upload } from 'lucide-react';
import { ReportMetadata, UserRole } from '../types/report';
import { compressImageFile } from '../utils/storage';

interface SignatureBlockProps {
  metadata: ReportMetadata;
  userRole: UserRole;
  onChangeMetadata: (updated: Partial<ReportMetadata>) => void;
}

export const SignatureBlock: React.FC<SignatureBlockProps> = ({
  metadata,
  userRole,
  onChangeMetadata,
}) => {
  const petugasFileRef = useRef<HTMLInputElement>(null);
  const mengetahuiFileRef = useRef<HTMLInputElement>(null);
  const pengawasFileRef = useRef<HTMLInputElement>(null);

  const canEditPetugas = userRole === 'worker' || userRole === 'admin';
  const canEditAdminColumns = userRole === 'admin';

  const handleSignUpload = async (
    field: 'petugasSignDataUrl' | 'mengetahuiSignDataUrl' | 'pengawasSignDataUrl',
    file?: File
  ) => {
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, 450, 0.9);
      onChangeMetadata({ [field]: dataUrl });
    } catch (err) {
      console.error('Gagal mengunggah tanda tangan:', err);
    }
  };

  return (
    <div className="signature-block mt-4 flex justify-center font-doc-serif text-black">
      <div className="w-[460px] max-w-full border-[1.5px] border-black bg-white">
        {/* Top Row: 2 Columns */}
        <div className="grid grid-cols-2 border-b-[1.5px] border-black">
          {/* Left Column: Petugas Pelapor (Editable by Tenaga Kerja) */}
          <div className="border-r-[1.5px] border-black px-3 py-2 flex flex-col items-center text-center justify-between min-h-[145px]">
            <input
              type="text"
              value={metadata.petugasLabel}
              readOnly={!canEditPetugas}
              onChange={(e) =>
                onChangeMetadata({ petugasLabel: e.target.value })
              }
              className="w-full text-center text-[9pt] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-none"
              aria-label="Label Petugas Pelapor"
            />

            {/* Signature Image Area 1: Petugas Pelapor */}
            <div className="relative group my-1 w-full h-[64px] flex items-center justify-center">
              <input
                ref={petugasFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) =>
                  handleSignUpload('petugasSignDataUrl', e.target.files?.[0])
                }
              />
              {metadata.petugasSignDataUrl ? (
                <img
                  src={metadata.petugasSignDataUrl}
                  alt="Tanda Tangan Petugas Pelapor"
                  referrerPolicy="no-referrer"
                  className="max-h-[60px] max-w-[140px] object-contain mx-auto"
                />
              ) : (
                <span className="no-print text-[10px] text-slate-400 italic">
                  Area TTD Petugas Pelapor
                </span>
              )}

              {canEditPetugas && (
                <div className="no-print absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 bg-white/90 transition-opacity">
                  <button
                    type="button"
                    onClick={() => petugasFileRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-sans font-medium rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs"
                  >
                    <Upload className="w-3 h-3" />
                    Upload TTD Pelapor
                  </button>
                  {metadata.petugasSignDataUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        onChangeMetadata({ petugasSignDataUrl: null })
                      }
                      className="p-1 rounded border border-slate-300 bg-white text-red-600 hover:bg-red-50 shadow-2xs"
                      title="Hapus tanda tangan pelapor"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="w-full space-y-0.5">
              <input
                type="text"
                value={metadata.petugasNama}
                readOnly={!canEditPetugas}
                onChange={(e) =>
                  onChangeMetadata({ petugasNama: e.target.value })
                }
                className="w-full text-center font-bold underline decoration-1 underline-offset-2 text-[9pt] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-none"
                aria-label="Nama Petugas Pelapor"
              />
              <input
                type="text"
                value={metadata.petugasJabatan}
                readOnly={!canEditPetugas}
                onChange={(e) =>
                  onChangeMetadata({ petugasJabatan: e.target.value })
                }
                className="w-full text-center font-bold text-[9pt] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-none"
                aria-label="Jabatan Petugas Pelapor"
              />
            </div>
          </div>

          {/* Right Column: Mengetahui (Editable ONLY by Admin) */}
          <div className="px-3 py-2 flex flex-col items-center text-center justify-between min-h-[145px]">
            <div className="w-full space-y-0.5">
              <input
                type="text"
                value={metadata.mengetahuiLabel}
                readOnly={!canEditAdminColumns}
                onChange={(e) =>
                  onChangeMetadata({ mengetahuiLabel: e.target.value })
                }
                className={`w-full text-center text-[9pt] bg-transparent border-b border-transparent ${
                  canEditAdminColumns
                    ? 'hover:border-slate-300 focus:border-blue-600'
                    : 'cursor-default'
                } focus:outline-none`}
                aria-label="Label Mengetahui"
              />
              <input
                type="text"
                value={metadata.mengetahuiUnitAtas}
                readOnly={!canEditAdminColumns}
                onChange={(e) =>
                  onChangeMetadata({ mengetahuiUnitAtas: e.target.value })
                }
                className={`w-full text-center text-[8.5pt] bg-transparent border-b border-transparent ${
                  canEditAdminColumns
                    ? 'hover:border-slate-300 focus:border-blue-600'
                    : 'cursor-default'
                } focus:outline-none`}
                aria-label="Unit Mengetahui Atas"
              />
            </div>

            {/* Signature Image Area 2: Mengetahui (Admin Only) */}
            <div className="relative group my-1 w-full h-[54px] flex items-center justify-center">
              <input
                ref={mengetahuiFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) =>
                  handleSignUpload(
                    'mengetahuiSignDataUrl',
                    e.target.files?.[0]
                  )
                }
              />
              {metadata.mengetahuiSignDataUrl ? (
                <img
                  src={metadata.mengetahuiSignDataUrl}
                  alt="Tanda Tangan Mengetahui"
                  referrerPolicy="no-referrer"
                  className="max-h-[52px] max-w-[135px] object-contain mx-auto"
                />
              ) : (
                <span className="no-print text-[10px] text-slate-400 italic">
                  {canEditAdminColumns
                    ? 'Area TTD Mengetahui (Admin)'
                    : 'Menunggu TTD Mengetahui (Admin)'}
                </span>
              )}

              {canEditAdminColumns ? (
                <div className="no-print absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 bg-white/90 transition-opacity">
                  <button
                    type="button"
                    onClick={() => mengetahuiFileRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-sans font-medium rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs"
                  >
                    <Upload className="w-3 h-3" />
                    Upload TTD Mengetahui
                  </button>
                  {metadata.mengetahuiSignDataUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        onChangeMetadata({ mengetahuiSignDataUrl: null })
                      }
                      className="p-1 rounded border border-slate-300 bg-white text-red-600 hover:bg-red-50 shadow-2xs"
                      title="Hapus tanda tangan mengetahui"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="no-print absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-white/85 transition-opacity">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-sans text-slate-600 bg-slate-100 rounded border border-slate-200">
                    <Lock className="w-3 h-3" />
                    Diisi oleh Admin
                  </span>
                </div>
              )}
            </div>

            <div className="w-full space-y-0.5">
              <input
                type="text"
                value={metadata.mengetahuiNama}
                readOnly={!canEditAdminColumns}
                onChange={(e) =>
                  onChangeMetadata({ mengetahuiNama: e.target.value })
                }
                className={`w-full text-center font-bold underline decoration-1 underline-offset-2 text-[9pt] bg-transparent border-b border-transparent ${
                  canEditAdminColumns
                    ? 'hover:border-slate-300 focus:border-blue-600'
                    : 'cursor-default'
                } focus:outline-none`}
                aria-label="Nama Pejabat Mengetahui"
              />
              <input
                type="text"
                value={metadata.mengetahuiJabatan}
                readOnly={!canEditAdminColumns}
                onChange={(e) =>
                  onChangeMetadata({ mengetahuiJabatan: e.target.value })
                }
                className={`w-full text-center font-bold text-[9pt] bg-transparent border-b border-transparent ${
                  canEditAdminColumns
                    ? 'hover:border-slate-300 focus:border-blue-600'
                    : 'cursor-default'
                } focus:outline-none`}
                aria-label="Jabatan Pejabat Mengetahui"
              />
              <input
                type="text"
                value={metadata.mengetahuiUnitBawah}
                readOnly={!canEditAdminColumns}
                onChange={(e) =>
                  onChangeMetadata({ mengetahuiUnitBawah: e.target.value })
                }
                className={`w-full text-center font-bold text-[9pt] bg-transparent border-b border-transparent ${
                  canEditAdminColumns
                    ? 'hover:border-slate-300 focus:border-blue-600'
                    : 'cursor-default'
                } focus:outline-none`}
                aria-label="Unit Pejabat Mengetahui"
              />
            </div>
          </div>
        </div>

        {/* Bottom Row: Full Width (PT. Energi Duta Utama / Pengawas Pelaksana Pekerjaan — Editable ONLY by Admin) */}
        <div className="px-4 py-2 flex flex-col items-center text-center justify-between min-h-[115px]">
          <input
            type="text"
            value={metadata.pengawasPerusahaan}
            readOnly={!canEditAdminColumns}
            onChange={(e) =>
              onChangeMetadata({ pengawasPerusahaan: e.target.value })
            }
            className={`w-full text-center text-[9pt] bg-transparent border-b border-transparent ${
              canEditAdminColumns
                ? 'hover:border-slate-300 focus:border-blue-600'
                : 'cursor-default'
            } focus:outline-none`}
            aria-label="Nama Perusahaan Pengawas"
          />

          {/* Signature Image Area 3: Pengawas (Admin Only) */}
          <div className="relative group my-1 w-full h-[54px] flex items-center justify-center">
            <input
              ref={pengawasFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) =>
                handleSignUpload('pengawasSignDataUrl', e.target.files?.[0])
              }
            />
            {metadata.pengawasSignDataUrl ? (
              <img
                src={metadata.pengawasSignDataUrl}
                alt="Tanda Tangan Pengawas"
                referrerPolicy="no-referrer"
                className="max-h-[52px] max-w-[140px] object-contain mx-auto"
              />
            ) : (
              <span className="no-print text-[10px] text-slate-400 italic">
                {canEditAdminColumns
                  ? 'Area TTD Pengawas (Admin)'
                  : 'Menunggu TTD Pengawas (Admin)'}
              </span>
            )}

            {canEditAdminColumns ? (
              <div className="no-print absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 bg-white/90 transition-opacity">
                <button
                  type="button"
                  onClick={() => pengawasFileRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-sans font-medium rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  <Upload className="w-3 h-3" />
                  Upload TTD Pengawas
                </button>
                {metadata.pengawasSignDataUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      onChangeMetadata({ pengawasSignDataUrl: null })
                    }
                    className="p-1 rounded border border-slate-300 bg-white text-red-600 hover:bg-red-50 shadow-2xs"
                    title="Hapus tanda tangan pengawas"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ) : (
              <div className="no-print absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-white/85 transition-opacity">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-sans text-slate-600 bg-slate-100 rounded border border-slate-200">
                  <Lock className="w-3 h-3" />
                  Diisi oleh Admin
                </span>
              </div>
            )}
          </div>

          <div className="w-full space-y-0.5">
            <input
              type="text"
              value={metadata.pengawasNama}
              readOnly={!canEditAdminColumns}
              onChange={(e) =>
                onChangeMetadata({ pengawasNama: e.target.value })
              }
              className={`w-full text-center font-bold underline decoration-1 underline-offset-2 text-[9pt] bg-transparent border-b border-transparent ${
                canEditAdminColumns
                  ? 'hover:border-slate-300 focus:border-blue-600'
                  : 'cursor-default'
              } focus:outline-none`}
              aria-label="Nama Pengawas Pelaksana Pekerjaan"
            />
            <input
              type="text"
              value={metadata.pengawasJabatan}
              readOnly={!canEditAdminColumns}
              onChange={(e) =>
                onChangeMetadata({ pengawasJabatan: e.target.value })
              }
              className={`w-full text-center font-bold text-[9pt] bg-transparent border-b border-transparent ${
                canEditAdminColumns
                  ? 'hover:border-slate-300 focus:border-blue-600'
                  : 'cursor-default'
              } focus:outline-none`}
              aria-label="Jabatan Pengawas Pelaksana Pekerjaan"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
