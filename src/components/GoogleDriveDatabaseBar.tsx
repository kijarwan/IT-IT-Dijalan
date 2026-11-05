import React from 'react';
import type { User } from 'firebase/auth';
import {
  Cloud,
  CloudOff,
  Database,
  ExternalLink,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { DriveBackupFileMeta } from '../services/googleDriveSync';

interface GoogleDriveDatabaseBarProps {
  needsAuth: boolean;
  isLoggingIn: boolean;
  user: User | null;
  driveSyncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  driveSyncMessage: string;
  driveFileMeta: DriveBackupFileMeta | null;
  autoSyncDriveApproved: boolean;
  onGoogleLogin: () => void;
  onRequestDriveSync: () => void;
  onRequestDriveRestore: () => void;
  onGoogleLogout: () => void;
}

export const GoogleDriveDatabaseBar: React.FC<GoogleDriveDatabaseBarProps> = ({
  needsAuth,
  isLoggingIn,
  user,
  driveSyncStatus,
  driveSyncMessage,
  driveFileMeta,
  autoSyncDriveApproved,
  onGoogleLogin,
  onRequestDriveSync,
  onRequestDriveRestore,
  onGoogleLogout,
}) => {
  if (needsAuth) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
          <Database className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          Database Google Drive:
        </span>
        <button
          type="button"
          onClick={onGoogleLogin}
          disabled={isLoggingIn}
          className="gsi-material-button"
        >
          <div className="gsi-material-button-state"></div>
          <div className="gsi-material-button-content-wrapper">
            <div className="gsi-material-button-icon">
              <svg
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                style={{ display: 'block' }}
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                ></path>
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                ></path>
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                ></path>
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                ></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
            </div>
            <span className="gsi-material-button-contents">
              {isLoggingIn
                ? 'Menghubungkan Database Drive...'
                : 'Sign in with Google (Hubungkan Database Drive)'}
            </span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
      <Database className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
      {driveSyncStatus === 'syncing' ? (
        <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          {driveSyncMessage || 'Menyinkronkan Database Google Drive...'}
        </span>
      ) : driveSyncStatus === 'error' ? (
        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
          <CloudOff className="w-3.5 h-3.5" />
          {driveSyncMessage || 'Sinkronisasi Database Drive gagal'}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
          <Cloud className="w-3.5 h-3.5" />
          {driveSyncMessage || `Database Drive (${user?.email || 'Terhubung'})`}
        </span>
      )}

      <button
        type="button"
        onClick={onRequestDriveSync}
        disabled={driveSyncStatus === 'syncing'}
        className="px-2.5 py-1 text-[11px] font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
      >
        {autoSyncDriveApproved
          ? 'Sinkronkan Database'
          : 'Aktifkan Auto-Sync Database'}
      </button>

      <button
        type="button"
        onClick={onRequestDriveRestore}
        disabled={driveSyncStatus === 'syncing'}
        className="px-2.5 py-1 text-[11px] font-medium rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
      >
        Muat dari Drive
      </button>

      {driveFileMeta?.id && (
        <a
          href={
            driveFileMeta.webViewLink ||
            `https://drive.google.com/file/d/${driveFileMeta.id}/view`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
          title="Lihat file database di Google Drive"
        >
          <ExternalLink className="w-3 h-3" />
          File Drive
        </a>
      )}

      <button
        type="button"
        onClick={onGoogleLogout}
        title="Putuskan akun Google Drive"
        className="p-1 text-slate-400 hover:text-red-600 rounded"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
