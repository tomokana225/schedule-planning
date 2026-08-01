// よく使う科目・教室の名称プリセット。一つずつ入力する代わりに、
// 学校でよく使われる名称をチェックボックスで選んで一括登録できるようにする。

export interface SubjectPreset {
  name: string;
  color: string; // SUBJECT_COLORS のいずれか
}

export const SUBJECT_PRESETS: SubjectPreset[] = [
  { name: '国語', color: 'rose' },
  { name: '社会', color: 'amber' },
  { name: '数学', color: 'blue' },
  { name: '理科', color: 'green' },
  { name: '英語', color: 'indigo' },
  { name: '音楽', color: 'violet' },
  { name: '美術', color: 'pink' },
  { name: '保健体育', color: 'orange' },
  { name: '技術・家庭', color: 'teal' },
  { name: '道徳', color: 'cyan' },
  { name: '総合的な学習の時間', color: 'lime' },
  { name: '学級活動', color: 'fuchsia' },
];

export const ROOM_PRESETS: string[] = [
  '理科室',
  '音楽室',
  '美術室',
  '家庭科室',
  '技術室',
  '体育館',
  '武道場',
  'コンピュータ室',
  '図書室',
  '視聴覚室',
  '校庭',
];

// クラスの一括生成: 例）学年数3・組数2 → 1年1組, 1年2組, 2年1組, 2年2組, 3年1組, 3年2組
export const generateClassNames = (grades: number, classesPerGrade: number): string[] => {
  const names: string[] = [];
  for (let g = 1; g <= grades; g++) {
    for (let c = 1; c <= classesPerGrade; c++) {
      names.push(`${g}年${c}組`);
    }
  }
  return names;
};
