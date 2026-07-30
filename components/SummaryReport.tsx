import React, { useMemo, useState } from 'react';
import { Download, BarChart3 } from 'lucide-react';
import { ProjectData } from '../types';
import { computeSummary, exportSummaryCsv, SummaryRow } from '../services/summaryService';

interface Props {
  data: ProjectData;
}

type Tab = 'teachers' | 'classes' | 'subjects';

const Table: React.FC<{ rows: SummaryRow[]; weeksPerYear: number }> = ({ rows, weeksPerYear }) => (
  <table className="w-full text-sm">
    <thead className="bg-gray-50 sticky top-0 text-left text-gray-500 text-xs uppercase">
      <tr>
        <th className="px-4 py-2 font-medium">名称</th>
        <th className="px-4 py-2 font-medium">週コマ数</th>
        <th className="px-4 py-2 font-medium">年間換算（週数{weeksPerYear}）</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-100">
      {rows.map(r => (
        <tr key={r.id} className="hover:bg-gray-50">
          <td className="px-4 py-2">{r.name}</td>
          <td className="px-4 py-2">{r.weeklyPeriods}</td>
          <td className="px-4 py-2 font-medium text-indigo-600">{r.annualPeriods}</td>
        </tr>
      ))}
      {rows.length === 0 && (
        <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">データがありません</td></tr>
      )}
    </tbody>
  </table>
);

export const SummaryReport: React.FC<Props> = ({ data }) => {
  const [tab, setTab] = useState<Tab>('teachers');
  const [weeksPerYear, setWeeksPerYear] = useState(35);

  const summary = useMemo(() => computeSummary(data, weeksPerYear), [data, weeksPerYear]);

  return (
    <div className="flex flex-col h-full">
      <p className="text-xs text-gray-500 mb-3 flex items-start gap-1.5">
        <BarChart3 size={14} className="mt-0.5 flex-shrink-0" />
        現在配置されている週あたりのコマ数を、先生・クラス・科目ごとに集計します（年間実績集計プログラムの簡易版）。
      </p>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1 w-fit">
          {(['teachers', 'classes', 'subjects'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                tab === t ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'teachers' ? '先生別' : t === 'classes' ? 'クラス別' : '科目別'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            年間の週数：
            <input
              type="number"
              min={1}
              max={52}
              value={weeksPerYear}
              onChange={e => setWeeksPerYear(Number(e.target.value))}
              className="w-20 px-2 py-1 rounded border border-gray-200"
            />
          </label>
          <button
            onClick={() => exportSummaryCsv(summary, weeksPerYear)}
            className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition"
          >
            <Download size={16} />
            <span>CSV出力</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white rounded-xl border border-gray-200 shadow-sm">
        <Table rows={summary[tab]} weeksPerYear={weeksPerYear} />
      </div>
    </div>
  );
};
