import React, { useState } from 'react';
import { X, FileSpreadsheet, Upload, AlertTriangle, Loader2, Download } from 'lucide-react';
import { parseIdeaExcelWorkbook, ImportResult } from '../services/excelImportService';
import { downloadIdeaExcelTemplate } from '../services/excelTemplateService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApply: (result: ImportResult) => void;
}

export const ExcelImportDialog: React.FC<Props> = ({ isOpen, onClose, onApply }) => {
  const [fileName, setFileName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const reset = () => { setFileName(''); setResult(null); setError(''); };

  const handleFile = async (file: File) => {
    reset();
    setFileName(file.name);
    setIsParsing(true);
    try {
      const parsed = await parseIdeaExcelWorkbook(file);
      setResult(parsed);
    } catch (e: any) {
      setError(e.message || 'ファイルの読み込みに失敗しました。');
    } finally {
      setIsParsing(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    onApply(result);
    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center no-print">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-indigo-600" />
            Excelから読み込む（統合版簡単設定）
          </h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          「クラス定義」「普通」「TT」「選択授業」「総合」「先生名称」シートを含む、統合版簡単設定エクセルブック
          （.xlsx / .xlsm）を読み込みます。クラス・先生・科目・授業を自動生成します。
          現在のクラス・先生・科目・授業・配置済みの時間割は上書きされます（教室と個別条件はそのまま維持されます）。
        </p>

        <button
          onClick={() => downloadIdeaExcelTemplate()}
          className="w-full mb-4 flex items-center justify-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border border-indigo-100 rounded-lg py-2 transition"
        >
          <Download size={14} />
          このシート形式のひな形（.xlsx）をダウンロード
        </button>

        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-8 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition">
          {isParsing ? <Loader2 size={22} className="text-indigo-500 animate-spin" /> : <Upload size={22} className="text-gray-400" />}
          <span className="text-sm text-gray-500">{fileName || 'エクセルファイルを選択'}</span>
          <input
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />
        </label>

        {error && (
          <div className="mt-3 flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg p-3">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
              {[
                ['クラス', result.classes.length],
                ['先生', result.teachers.length],
                ['科目', result.subjects.length],
                ['授業', result.lessons.length],
              ].map(([label, count]) => (
                <div key={label as string} className="bg-gray-50 rounded-lg py-2">
                  <div className="font-bold text-gray-800">{count}</div>
                  <div className="text-gray-400">{label}</div>
                </div>
              ))}
            </div>

            {result.warnings.length > 0 && (
              <div className="mt-3 max-h-32 overflow-auto bg-amber-50 border border-amber-100 rounded-lg p-3 space-y-1">
                {result.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-700">
                    <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleApply}
              className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg shadow-md shadow-indigo-200 transition flex items-center justify-center gap-2"
            >
              <FileSpreadsheet size={16} />
              この内容で設定を反映する
            </button>
          </>
        )}
      </div>
    </div>
  );
};
