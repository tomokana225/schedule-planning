import React, { useState } from 'react';
import { X, ListChecks } from 'lucide-react';
import { SUBJECT_COLOR_CLASSES } from '../types';

interface PresetItem {
  key: string;
  label: string;
  swatchColor?: string; // SUBJECT_COLORS key, if this preset represents a subject
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: PresetItem[];
  onConfirm: (selectedKeys: string[]) => void;
}

export const PresetPickerDialog: React.FC<Props> = ({ isOpen, onClose, title, items, onConfirm }) => {
  const [selected, setSelected] = useState<string[]>([]);

  if (!isOpen) return null;

  const toggle = (key: string) => {
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleConfirm = () => {
    if (selected.length === 0) return;
    onConfirm(selected);
    setSelected([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center no-print">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <ListChecks size={18} className="text-indigo-600" />
            {title}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-80 overflow-auto grid grid-cols-2 gap-2 mb-4">
          {items.map(item => (
            <label
              key={item.key}
              className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border cursor-pointer transition ${
                selected.includes(item.key)
                  ? item.swatchColor ? SUBJECT_COLOR_CLASSES[item.swatchColor] : 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.includes(item.key)}
                onChange={() => toggle(item.key)}
                className="accent-indigo-600"
              />
              <span className="truncate">{item.label}</span>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{selected.length}件選択中</span>
          <button
            onClick={handleConfirm}
            disabled={selected.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-medium px-4 py-2 rounded-lg text-sm shadow-md shadow-indigo-200 transition"
          >
            選択した{selected.length}件を追加
          </button>
        </div>
      </div>
    </div>
  );
};
