import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { FullDatabaseBackup } from '../types/report';

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
export const DRIVE_BACKUP_FILENAME = 'Laporan_Pelaksanaan_TA_Database.json';
export const DRIVE_FOLDER_NAME = 'Database Laporan Pelaksanaan TA - EDU PLN IP';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// Cache the access token strictly in memory (never in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses dari Google Auth');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export interface DriveBackupFileMeta {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
}

/**
 * Finds or creates the dedicated folder in Google Drive for the database.
 */
export async function findOrCreateDriveDatabaseFolder(): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const query = encodeURIComponent(
      `name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    );
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name)&pageSize=1`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (res.ok) {
      const data = (await res.json()) as { files?: { id: string }[] };
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }

    // Create folder if not found
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: DRIVE_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
        description:
          'Folder Database Resmi Laporan Pelaksanaan Harian Technical Assistant PT Energi Duta Utama / PT PLN Indonesia Power',
      }),
    });
    if (createRes.ok) {
      const folder = (await createRes.json()) as { id: string };
      return folder.id;
    }
  } catch {
    // Fallback to root if folder creation fails
  }
  return null;
}

/**
 * Searches the user's Google Drive (files created by this app via drive.file scope)
 * for the database backup file.
 */
export async function findDriveBackupFile(): Promise<DriveBackupFileMeta | null> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('UNAUTHENTICATED');
  }

  const query = encodeURIComponent(
    `name = '${DRIVE_BACKUP_FILENAME}' and trashed = false`
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,modifiedTime,size,webViewLink)&orderBy=modifiedTime desc&pageSize=5`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401 || res.status === 403) {
    cachedAccessToken = null;
    throw new Error('UNAUTHENTICATED');
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal memeriksa Google Drive: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as { files?: DriveBackupFileMeta[] };
  if (data.files && data.files.length > 0) {
    return data.files[0];
  }
  return null;
}

/**
 * Creates or updates the master JSON database file in Google Drive.
 * IMPORTANT: Callers must ensure user has explicitly confirmed creating/updating
 * the file in Google Drive before invoking this function.
 */
export async function syncBackupToGoogleDrive(
  backup: FullDatabaseBackup,
  existingFileId?: string | null
): Promise<DriveBackupFileMeta> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('UNAUTHENTICATED');
  }

  let targetFileId = existingFileId;
  if (!targetFileId) {
    const found = await findDriveBackupFile();
    if (found) {
      targetFileId = found.id;
    }
  }

  let folderId: string | null = null;
  if (!targetFileId) {
    folderId = await findOrCreateDriveDatabaseFolder();
  }

  const metadata: Record<string, unknown> = {
    name: DRIVE_BACKUP_FILENAME,
    mimeType: 'application/json',
    description:
      'Database Utama (Unit Kerja, Tenaga Kerja, Admin, Tanda Tangan & Laporan Bulanan) PT Energi Duta Utama / PT PLN Indonesia Power',
  };

  if (!targetFileId && folderId) {
    metadata.parents = [folderId];
  }

  const jsonContent = JSON.stringify(backup, null, 2);
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const multipartBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    jsonContent +
    closeDelim;

  const uploadUrl = targetFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${targetFileId}?uploadType=multipart&fields=id,name,modifiedTime,size,webViewLink`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size,webViewLink`;

  const method = targetFileId ? 'PATCH' : 'POST';

  const res = await fetch(uploadUrl, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (res.status === 401 || res.status === 403) {
    cachedAccessToken = null;
    throw new Error('UNAUTHENTICATED');
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal menyimpan ke Google Drive: ${res.status} ${errText}`);
  }

  return (await res.json()) as DriveBackupFileMeta;
}

/**
 * Downloads the backup JSON content from Google Drive.
 */
export async function downloadBackupFromGoogleDrive(
  fileId: string
): Promise<FullDatabaseBackup> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('UNAUTHENTICATED');
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (res.status === 401 || res.status === 403) {
    cachedAccessToken = null;
    throw new Error('UNAUTHENTICATED');
  }

  if (!res.ok) {
    throw new Error(`Gagal mengunduh data dari Google Drive (${res.status})`);
  }

  return (await res.json()) as FullDatabaseBackup;
}
