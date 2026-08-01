import React, { useState } from 'react';
import { X, GitMerge, Upload } from 'lucide-react';
import { ProjectData } from '../types';
import { loadProjectJson } from '../services/exportService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onMerge: (incoming: ProjectData) => void;
}

export const MergeDataDialog: React.FC<Props> = ({ isOpen, onClose, onMerge }) => {
  const [incoming, setIncoming] = useState<ProjectData | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setError('');
    try {
      const data = await loadProjectJson(file);
      setIncoming(data);
      setFileName(file.name);
    } catch {
      setError('ファイルの読み込みに失敗しました。JSON形式の時間割データを選択してください。');
      setIncoming(null);
    }
  };

  const handleMerge = () => {
    if (!incoming) return;
    onMerge(incoming);
    setIncoming(null);
    setFileName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center no-print">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <GitMerge size={18} className="text-indigo-600" />
            データ結合（統合連結）
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          別の担当者が作成した時間割データ（JSON）を読み込み、クラス・先生・科目・教室・授業を
          現在のデータに統合します。同じ名称のものは同一とみなして重複登録しません。
          駒の配置（時間割）は統合されないため、結合後に「AIで自動駒入れ」を再実行してください。
        </p>

        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-8 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition">
          <Upload size={22} className="text-gray-400" />
          <span className="text-sm text-gray-500">{fileName || 'JSONファイルを選択'}</span>
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </label>

        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

        {incoming && (
          <div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs">
            {[
              ['クラス', incoming.classes.length],
              ['先生', incoming.teachers.length],
              ['科目', incoming.subjects.length],
              ['教室', incoming.rooms.length],
              ['授業', incoming.lessons.length],
            ].map(([label, count]) => (
              <div key={label as string} className="bg-gray-50 rounded-lg py-2">
                <div className="font-bold text-gray-800">{count}</div>
                <div className="text-gray-400">{label}</div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleMerge}
          disabled={!incoming}
          className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-medium py-2.5 rounded-lg shadow-md shadow-indigo-200 transition flex items-center justify-center gap-2"
        >
          <GitMerge size={16} />
          結合する
        </button>
      </div>
    </div>
  );
};
