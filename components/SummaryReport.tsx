import React, { useMemo, useState } from 'react';
import { Download, BarChart3, AlertTriangle } from 'lucide-react';
import { ProjectData, SUBJECT_COLOR_CLASSES } from '../types';
import { computeSummary, computeUnitComparison, exportSummaryCsv, SummaryRow } from '../services/summaryService';

interface Props {
  data: ProjectData;
}

type Tab = 'teachers' | 'classes' | 'subjects' | 'units';

const Table: React.FC<{ rows: SummaryRow[]; weeksPerYear: number }> = ({ rows, weeksPerYear }) => {
  const mismatches = rows.filter(r => !r.matches);
  return (
    <>
      {mismatches.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border-b border-amber-200 text-amber-700 px-4 py-2 text-xs">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            週コマ数が本来の（授業設定上の）コマ数と一致していません（未配置の駒がある可能性があります）:
            {' '}{mismatches.map(r => r.name).join('、')}
          </span>
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="bg-gray-50 sticky top-0 text-left text-gray-500 text-xs uppercase">
          <tr>
            <th className="px-4 py-2 font-medium">名称</th>
            <th className="px-4 py-2 font-medium">週コマ数</th>
            <th className="px-4 py-2 font-medium">本来のコマ数</th>
            <th className="px-4 py-2 font-medium">年間換算（週数{weeksPerYear}）</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(r => (
            <tr key={r.id} className={`hover:bg-gray-50 ${!r.matches ? 'bg-amber-50/60' : ''}`}>
              <td className="px-4 py-2">{r.name}</td>
              <td className={`px-4 py-2 ${!r.matches ? 'text-amber-700 font-semibold' : ''}`}>{r.weeklyPeriods}</td>
              <td className="px-4 py-2 text-gray-500">{r.expectedPeriods}</td>
              <td className="px-4 py-2 font-medium text-indigo-600">{r.annualPeriods}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">データがありません</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
};

const UnitComparisonView: React.FC<{ data: ProjectData }> = ({ data }) => {
  const grades = useMemo(() => computeUnitComparison(data), [data]);

  if (grades.length === 0 || grades.every(g => g.subjectRows.length === 0)) {
    return <div className="text-center text-gray-400 text-sm py-12">データがありません</div>;
  }

  return (
    <div className="space-y-6 p-4">
      {grades.map(g => (
        <div key={g.grade} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 font-semibold text-sm text-gray-700">{g.grade}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 sticky left-0 bg-white">教科</th>
                  {g.classes.map(c => (
                    <th key={c.id} className="px-3 py-2 text-xs font-medium text-gray-500 text-center whitespace-nowrap">{c.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {g.subjectRows.map(row => (
                  <tr key={row.subjectId} className={row.mismatched ? 'bg-red-50' : ''}>
                    <td className={`px-3 py-2 sticky left-0 bg-inherit font-medium ${SUBJECT_COLOR_CLASSES[row.color]?.split(' ')[1] ?? ''}`}>
                      {row.subjectName}
                      {row.mismatched && <AlertTriangle size={12} className="inline-block ml-1 text-red-500" />}
                    </td>
                    {g.classes.map(c => (
                      <td key={c.id} className={`px-3 py-2 text-center ${row.mismatched ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                        {row.byClass[c.id]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

export const SummaryReport: React.FC<Props> = ({ data }) => {
  const [tab, setTab] = useState<Tab>('teachers');
  const [weeksPerYear, setWeeksPerYear] = useState(35);

  const summary = useMemo(() => computeSummary(data, weeksPerYear), [data, weeksPerYear]);

  return (
    <div className="flex flex-col h-full">
      <p className="text-xs text-gray-500 mb-3 flex items-start gap-1.5">
        <BarChart3 size={14} className="mt-0.5 flex-shrink-0" />
        現在配置されている週あたりのコマ数を、先生・クラス・科目ごとに集計します（年間実績集計プログラムの簡易版）。
        「本来のコマ数」（授業設定上の値）と一致していない場合は未配置の駒がある可能性があります。
        「単位数比較」では、学年内のクラス間で各教科の単位数が揃っているかを確認できます。
      </p>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1 w-fit">
          {(['teachers', 'classes', 'subjects', 'units'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                tab === t ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'teachers' ? '先生別' : t === 'classes' ? 'クラス別' : t === 'subjects' ? '科目別' : '単位数比較'}
            </button>
          ))}
        </div>

        {tab !== 'units' && (
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
        )}
      </div>

      <div className="flex-1 overflow-auto bg-white rounded-xl border border-gray-200 shadow-sm">
        {tab === 'units' ? <UnitComparisonView data={data} /> : <Table rows={summary[tab]} weeksPerYear={weeksPerYear} />}
      </div>
    </div>
  );
};
