import React, { useRef } from 'react';
import { RotateCcw, Upload } from 'lucide-react';
import { compressImageFile } from '../utils/storage';

interface EnergiLogoProps {
  logoDataUrl: string | null;
  onUpdateLogo: (dataUrl: string | null) => void;
}

export const EnergiLogo: React.FC<EnergiLogoProps> = ({
  logoDataUrl,
  onUpdateLogo,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 500, 0.9);
      onUpdateLogo(compressed);
    } catch (err) {
      console.error('Gagal mengunggah logo:', err);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="relative inline-flex items-center gap-3 group">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {logoDataUrl ? (
        <img
          src={logoDataUrl}
          alt="Logo Perusahaan"
          referrerPolicy="no-referrer"
          className="h-10 w-auto max-w-[160px] object-contain"
        />
      ) : (
        /* Official ENERGI DUTA UTAMA Default Vector Logo matching PDF Kop */
        <div
          className="select-none flex flex-col items-start leading-none"
          aria-label="ENERGI DUTA UTAMA"
        >
          <div className="flex items-baseline tracking-tight">
            <span
              className="font-black text-[22px] text-[#232C3D]"
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            >
              E
            </span>
            {/* Stylized N with Red/Orange V Check Swoosh */}
            <svg
              viewBox="0 0 38 28"
              className="w-[26px] h-[21px] -mx-[1px] self-end mb-[1px]"
              aria-hidden="true"
            >
              <defs>
                <linearGradient
                  id="energiVGrad"
                  x1="0%"
                  y1="100%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#D62828" />
                  <stop offset="55%" stopColor="#F77F00" />
                  <stop offset="100%" stopColor="#FCBF49" />
                </linearGradient>
              </defs>
              {/* Left stem of N */}
              <path
                d="M4 25 L4 7"
                stroke="#232C3D"
                strokeWidth="5.2"
                strokeLinecap="round"
              />
              {/* Red-Orange V swoosh */}
              <path
                d="M4 8 L17 25 L34 2"
                fill="none"
                stroke="url(#energiVGrad)"
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="font-black text-[22px] text-[#232C3D]"
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            >
              ERGI
            </span>
          </div>
          <span
            className="text-[9.5px] font-extrabold tracking-[0.18em] text-[#232C3D] mt-[1px]"
            style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
          >
            DUTA UTAMA
          </span>
        </div>
      )}

      {/* Screen-only Logo Upload / Reset controls */}
      <div className="no-print flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs whitespace-nowrap shrink-0"
          title="Ubah / Upload Logo Kop"
        >
          <Upload className="w-3 h-3" />
          Upload Logo
        </button>
        {logoDataUrl && (
          <button
            type="button"
            onClick={() => onUpdateLogo(null)}
            className="p-1 text-[11px] rounded border border-slate-300 bg-white text-slate-600 hover:text-red-600 hover:bg-red-50 shadow-2xs"
            title="Kembalikan Logo Default ENERGI DUTA UTAMA"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
