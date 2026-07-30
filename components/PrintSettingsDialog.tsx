import React, { useState } from 'react';
import { X, Printer } from 'lucide-react';
import { PrintSettings, ProjectData } from '../types';
import { buildAllClassesTableHtml, HTML_STYLE } from '../services/exportService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: ProjectData;
  printSettings: PrintSettings;
  setPrintSettings: (s: PrintSettings) => void;
}

const PAGE_SIZE_MM: Record<PrintSettings['paperSize'], string> = {
  A4: 'A4',
  B5: 'B5',
  Letter: 'letter',
};

export const PrintSettingsDialog: React.FC<Props> = ({ isOpen, onClose, data, printSettings, setPrintSettings }) => {
  const [local, setLocal] = useState<PrintSettings>(printSettings);

  if (!isOpen) return null;

  const handlePrint = () => {
    setPrintSettings(local);

    let styleTag = document.getElementById('dynamic-print-page-style') as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'dynamic-print-page-style';
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = `@page { size: ${PAGE_SIZE_MM[local.paperSize]} ${local.orientation}; margin: 10mm; }`;

    const cleanup = () => {
      document.body.classList.remove('printing-all');
      const container = document.getElementById('print-all-container');
      if (container) container.remove();
      window.removeEventListener('afterprint', cleanup);
    };

    if (local.target === 'allClasses') {
      let container = document.getElementById('print-all-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'print-all-container';
        document.body.appendChild(container);
      }
      const tableStyle = document.createElement('style');
      tableStyle.textContent = HTML_STYLE;
      container.innerHTML = '';
      container.appendChild(tableStyle);
      const wrapper = document.createElement('div');
      wrapper.innerHTML = buildAllClassesTableHtml(data);
      container.appendChild(wrapper);
      document.body.classList.add('printing-all');
      window.addEventListener('afterprint', cleanup);
    }

    onClose();
    setTimeout(() => window.print(), 50);
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center no-print">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Printer size={18} className="text-indigo-600" />
            印刷設定
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <label className="block font-medium text-gray-700 mb-1">用紙サイズ</label>
            <select
              value={local.paperSize}
              onChange={e => setLocal({ ...local, paperSize: e.target.value as PrintSettings['paperSize'] })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white"
            >
              <option value="A4">A4</option>
              <option value="B5">B5</option>
              <option value="Letter">Letter</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">向き</label>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['portrait', 'landscape'] as const).map(o => (
                <button
                  key={o}
                  onClick={() => setLocal({ ...local, orientation: o })}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${local.orientation === o ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
                >
                  {o === 'portrait' ? '縦' : '横'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">印刷対象</label>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['current', 'allClasses'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setLocal({ ...local, target: t })}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${local.target === t ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
                >
                  {t === 'current' ? '現在の表示のみ' : '全クラス一括'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg shadow-md shadow-indigo-200 transition flex items-center justify-center gap-2"
        >
          <Printer size={16} />
          印刷する
        </button>
      </div>
    </div>
  );
};
