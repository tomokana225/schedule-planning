import type * as XLSXType from 'xlsx';

// Builds and downloads a blank starter workbook in the exact "統合版簡単設定" layout
// that parseIdeaExcelWorkbook (excelImportService.ts) expects: シート「クラス定義」
// 「普通」「TT」「選択授業」「総合」「先生名称」, with the same header rows, class
// columns, and hour-cell format as a real file, pre-filled with a small example so
// the required shape is clear without having to read the parser source.
//
// Column/row layout must stay in lockstep with excelImportService.ts's readClassColumns
// row/column indices (grade row / class row / data-start row) — if that parser's
// expected shape changes, this template must be updated to match.
export const downloadIdeaExcelTemplate = async (): Promise<void> => {
  const XLSX = await import('xlsx'); // lazily loaded: keeps the xlsx lib out of the main bundle

  const GRADES = ['1年', '2年', '3年'];
  const CLASSES_PER_GRADE = 3;

  const wb = XLSX.utils.book_new();

  const addSheet = (name: string, rows: unknown[][]) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  // ---- クラス定義 ----
  addSheet('クラス定義', [
    ['', '学年', '組数'],
    ...GRADES.map(grade => ['', grade, CLASSES_PER_GRADE]),
  ]);

  // ---- 先生名称（任意）----
  // このシートは全行のB列を先生名として読み取るため、見出し行のB列は必ず空欄にする
  // こと（B列に文字列を入れるとその文字列自体が先生として取り込まれてしまう）。
  addSheet('先生名称', [
    ['先生の正式名称・略称の一覧です（このシートは任意です。A列はマクロ計算用のため空欄でよく、B列に先生名を入力します）'],
    ['', '山田太郎', '山田', ''],
    ['', '佐藤花子', '佐藤', ''],
    ['', '鈴木一郎', '鈴木', ''],
  ]);

  // Grade/class header rows shared by 普通/TT/選択授業. 普通 starts class columns at
  // column C (index 2); TT/選択授業 start one column later, at column D (index 3),
  // since they have an extra ラベル column.
  const gradeHeaderCells = GRADES.flatMap(grade => Array(CLASSES_PER_GRADE).fill(grade));
  const classNumHeaderCells = GRADES.flatMap(() => Array.from({ length: CLASSES_PER_GRADE }, (_, i) => i + 1));

  // ---- 普通: 一人の先生が一つのクラスを教える基本授業 ----
  addSheet('普通', [
    ['1人の先生が1クラスを教える授業を入力してください。'],
    ['時数は半角数字（例：4）、または「2②」「6②」のように2連続コマの数を丸数字で添えた表記にも対応しています。'],
    ['先生名', '科目名', ...gradeHeaderCells],
    ['', '', ...classNumHeaderCells],
    ['↓この行から入力してください'],
    ['山田太郎', '国語', ...GRADES.flatMap(() => Array(CLASSES_PER_GRADE).fill(4))],
    ['佐藤花子', '数学', ...GRADES.flatMap(() => Array(CLASSES_PER_GRADE).fill(4))],
  ]);

  // ---- TT: 複数の先生が一つのクラスを教える授業 ----
  addSheet('TT', [
    ['複数の先生が1クラスを一緒に教える授業を入力してください。'],
    ['先生名は「山田太郎,佐藤花子」のようにカンマ区切りで複数指定できます。'],
    ['ラベル', '先生名(カンマ区切り)', '科目名', ...gradeHeaderCells],
    ['', '', '', ...classNumHeaderCells],
    ['↓この行から入力してください'],
    ['TT国語', '山田太郎,佐藤花子', '国語', ...GRADES.flatMap(() => Array(CLASSES_PER_GRADE).fill(2))],
  ]);

  // ---- 選択授業: 複数の先生・科目・クラスにまたがる選択/合同/展開授業 ----
  addSheet('選択授業', [
    ['複数クラス合同の選択授業や、クラスを分割して行う展開授業を入力してください。'],
    ['科目名を「美術,音楽」のようにカンマ区切りで複数指定すると、先生名との組み合わせごとに別々の授業として取り込まれます（展開授業）。'],
    ['ラベル', '先生名(カンマ区切り)', '科目名(複数可)', ...gradeHeaderCells],
    ['', '', '', ...classNumHeaderCells],
    ['↓この行から入力してください'],
    // 参加しないクラスは空欄のままにできる例として、各学年1組のみ埋めている
    ['選択A', '鈴木一郎', '美術', ...GRADES.flatMap(() => [2, '', ''])],
  ]);

  // ---- 総合: 学年単位の総合的な学習の時間 ----
  // 学年名の見出し行は3行目（0始まりでindex 2）でなければならない点に注意
  // （excelImportServiceのheaderRow = integratedRows[2]に対応）。
  addSheet('総合', [
    ['学年単位（クラス共通）で行う総合的な学習の時間などを入力してください。'],
    [''],
    ['ラベル', '先生名(カンマ区切り)', '科目名', ...GRADES],
    ['総合的な学習', '山田太郎,佐藤花子,鈴木一郎', '総合', ...GRADES.map(() => 1)],
  ]);

  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // ASCII filename: some browsers fall back to a generic "download" name for blob:
  // URLs when `a.download` contains non-ASCII characters (confirmed in headless
  // Chromium during testing) — matches the ASCII-only filenames already used by
  // exportService.ts's HTML/CSV/JSON downloads.
  a.download = 'schedule-template.xlsx';
  a.click();
  URL.revokeObjectURL(url);
};
