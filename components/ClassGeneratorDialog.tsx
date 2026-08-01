import React, { useState } from 'react';
import { X, GraduationCap } from 'lucide-react';
import { generateClassNames } from '../data/presets';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (names: string[]) => void;
}

export const ClassGeneratorDialog: React.FC<Props> = ({ isOpen, onClose, onConfirm }) => {
  const [grades, setGrades] = useState(3);
  const [classesPerGrade, setClassesPerGrade] = useState(2);

  if (!isOpen) return null;

  const preview = generateClassNames(grades, classesPerGrade);

  const handleConfirm = () => {
    if (preview.length === 0) return;
    onConfirm(preview);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center no-print">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap size={18} className="text-indigo-600" />
            クラスを一括生成
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <label className="flex flex-col gap-1">
            学年数
            <input
              type="number" min={1} max={6} value={grades}
              onChange={e => setGrades(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-200"
            />
          </label>
          <label className="flex flex-col gap-1">
            1学年あたりの組数
            <input
              type="number" min={1} max={10} value={classesPerGrade}
              onChange={e => setClassesPerGrade(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-200"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4 max-h-32 overflow-auto">
          {preview.map(name => (
            <span key={name} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md">{name}</span>
          ))}
        </div>

        <button
          onClick={handleConfirm}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg shadow-md shadow-indigo-200 transition"
        >
          {preview.length}件のクラスを追加
        </button>
      </div>
    </div>
  );
};
