import React from 'react';
import { AlertTriangle, CloudUpload, X } from 'lucide-react';

export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  description: string;
  details?: string[];
  confirmLabel: string;
  variant: 'primary' | 'danger';
  onConfirm: () => void;
}

interface ConfirmActionModalProps {
  dialog: ConfirmDialogState | null;
  onCancel: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  dialog,
  onCancel,
}) => {
  if (!dialog || !dialog.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 no-print">
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                dialog.variant === 'danger'
                  ? 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                  : 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
              }`}
            >
              {dialog.variant === 'danger' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <CloudUpload className="w-5 h-5" />
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {dialog.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {dialog.description}
          </p>

          {dialog.details && dialog.details.length > 0 && (
            <ul className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs text-slate-700 dark:text-slate-300 space-y-1">
              {dialog.details.map((item, i) => (
                <li key={i} className="font-mono text-[11px]">
                  • {item}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={dialog.onConfirm}
            className={`px-4 py-2 text-xs font-semibold rounded-lg text-white transition-colors whitespace-nowrap shrink-0 ${
              dialog.variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
