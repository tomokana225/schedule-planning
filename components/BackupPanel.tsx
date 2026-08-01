import React, { useEffect, useState } from 'react';
import { X, History, RotateCcw, Trash2, Save } from 'lucide-react';
import { ProjectData } from '../types';
import { BackupEntry, deleteBackup, listBackups, saveBackup } from '../services/backupService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentData: () => ProjectData;
  onRestore: (data: ProjectData) => void;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  intervalMinutes: number;
  setIntervalMinutes: (v: number) => void;
}

const formatTimestamp = (iso: string) =>
  new Date(iso).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

export const BackupPanel: React.FC<Props> = ({
  isOpen, onClose, currentData, onRestore, enabled, setEnabled, intervalMinutes, setIntervalMinutes,
}) => {
  const [backups, setBackups] = useState<BackupEntry[]>([]);

  useEffect(() => {
    if (isOpen) setBackups(listBackups());
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackupNow = () => {
    saveBackup(currentData());
    setBackups(listBackups());
  };

  const handleRestore = (entry: BackupEntry) => {
    if (!window.confirm(`${formatTimestamp(entry.timestamp)} のバックアップを復元します。現在の変更は失われます。よろしいですか？`)) return;
    onRestore(entry.data);
    onClose();
  };

  const handleDelete = (id: string) => {
    deleteBackup(id);
    setBackups(listBackups());
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center no-print">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <History size={18} className="text-indigo-600" />
            自動バックアップ
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 mb-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="accent-indigo-600" />
            自動バックアップを有効にする
          </label>
          <label className="flex items-center gap-2">
            間隔：
            <input
              type="number" min={10} max={30} value={intervalMinutes}
              onChange={e => setIntervalMinutes(Number(e.target.value))}
              className="w-16 px-2 py-1 rounded border border-gray-200"
            />
            分
          </label>
        </div>

        <button
          onClick={handleBackupNow}
          className="w-full flex items-center justify-center gap-2 mb-4 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg py-2 hover:bg-indigo-50 transition"
        >
          <Save size={16} />
          今すぐバックアップを作成
        </button>

        <div className="max-h-72 overflow-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
          {backups.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-gray-400">バックアップはまだありません</div>
          )}
          {backups.map(b => (
            <div key={b.id} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50">
              <span className="text-gray-700">{formatTimestamp(b.timestamp)}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => handleRestore(b)} title="復元" className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-gray-100">
                  <RotateCcw size={14} />
                </button>
                <button onClick={() => handleDelete(b.id)} title="削除" className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-3">
          バックアップは最大10世代までブラウザ内に保存されます。同じブラウザ・同じ端末でのみ復元できます。
        </p>
      </div>
    </div>
  );
};
