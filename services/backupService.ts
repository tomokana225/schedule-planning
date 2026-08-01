import { ProjectData } from '../types';

const STORAGE_KEY = 'ai-jikanwari-backups';
const MAX_GENERATIONS = 10; // 複数世代でのバックアップ

export interface BackupEntry {
  id: string;
  timestamp: string; // ISO string
  data: ProjectData;
}

const readAll = (): BackupEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BackupEntry[];
  } catch {
    return [];
  }
};

const writeAll = (entries: BackupEntry[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage full or unavailable: drop silently, this is a best-effort safety net
  }
};

// 自動バックアップ機能: 現在のプロジェクトデータをローカルストレージに保存する。
// 古い世代から自動的に間引かれる（最大 MAX_GENERATIONS 件保持）。
export const saveBackup = (data: ProjectData): BackupEntry => {
  const entry: BackupEntry = {
    id: Math.random().toString(36).slice(2, 10),
    timestamp: new Date().toISOString(),
    data,
  };
  const entries = [...readAll(), entry].slice(-MAX_GENERATIONS);
  writeAll(entries);
  return entry;
};

export const listBackups = (): BackupEntry[] =>
  readAll().sort((a, b) => b.timestamp.localeCompare(a.timestamp));

export const deleteBackup = (id: string) => {
  writeAll(readAll().filter(e => e.id !== id));
};

export const clearBackups = () => writeAll([]);
