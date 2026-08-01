import {
  ProjectData, SchoolClass, Teacher, Subject, Room, Lesson, DEFAULT_SCHEDULER_OPTIONS,
} from '../types';
import { generateId, DEFAULT_DAYS } from '../utils';
import { generateClassNames, SUBJECT_PRESETS } from '../data/presets';

// モック用のサンプルデータ: 中学校3学年×5クラス（15クラス）、先生約20人分の標準的な
// 時間割を想定したクラス・先生・科目・教室・授業一式。「サンプルデータを読み込む」から
// 利用できる。各クラスの週の合計コマ数は、主要5教科3コマ・音楽/美術1コマ・保健体育/
// 技術家庭2コマの標準時数パターンで週21コマとなり、既定の5日制×6時限（週30コマ枠）の
// 中に無理なく収まる（駒入れで全コマ0残りを狙いやすい構成）。
export const buildMockProjectData = (): ProjectData => {
  const GRADES = 3;
  const CLASSES_PER_GRADE = 5;
  const classNames = generateClassNames(GRADES, CLASSES_PER_GRADE); // 1年1組 ... 3年5組
  const classes: SchoolClass[] = classNames.map(name => ({
    id: generateId(),
    name,
    grade: name.match(/^(\d+年)/)?.[1],
    unavailable: [],
  }));
  const classByName = new Map(classes.map(c => [c.name, c]));
  const gradeOf = (className: string) => className.match(/^(\d+)年/)![1];

  const teacherDefs: { name: string; short: string }[] = [
    { name: '山田太郎', short: '山田' }, { name: '佐藤花子', short: '佐藤' }, { name: '鈴木一郎', short: '鈴木' },
    { name: '田中美咲', short: '田中' }, { name: '高橋健二', short: '高橋' }, { name: '伊藤さくら', short: '伊藤' },
    { name: '渡辺健太', short: '渡辺' }, { name: '小林由美', short: '小林' }, { name: '加藤大輔', short: '加藤' },
    { name: '山本恵子', short: '山本' }, { name: '中村真由美', short: '中村' }, { name: '小川誠', short: '小川' },
    { name: '斎藤陽子', short: '斎藤' }, { name: '松本大輝', short: '松本' }, { name: '井上由紀', short: '井上' },
    { name: '木村隆', short: '木村' }, { name: '林美穂', short: '林' }, { name: '清水健一', short: '清水' },
    { name: '山口愛', short: '山口' }, { name: '森田翔', short: '森田' }, { name: '池田久美子', short: '池田' },
  ];
  const teachers: Teacher[] = teacherDefs.map(t => ({
    id: generateId(), name: t.name, short: t.short, unavailable: [],
  }));
  const teacherByName = new Map(teachers.map(t => [t.name, t]));

  const subjectNames = ['国語', '社会', '数学', '理科', '英語', '音楽', '美術', '保健体育', '技術・家庭'];
  const subjects: Subject[] = subjectNames.map(name => {
    const preset = SUBJECT_PRESETS.find(p => p.name === name);
    return { id: generateId(), name, color: preset?.color ?? 'blue', maxPerDayPerClass: 1, unavailable: [] };
  });
  const subjectByName = new Map(subjects.map(s => [s.name, s]));

  // 理科・保健体育・技術家庭は使用頻度が高いため特別教室を2部屋ずつ用意し、
  // クラスの偶奇で振り分けて同時に使えるようにしている。
  const specialRoomNames = ['理科室1', '理科室2', '音楽室', '美術室', '体育館1', '体育館2', '技術室1', '技術室2'];
  const homeroomRooms: Room[] = classNames.map(name => ({ id: generateId(), name: `${name}教室`, unavailable: [] }));
  const specialRooms: Room[] = specialRoomNames.map(name => ({ id: generateId(), name, unavailable: [] }));
  const rooms: Room[] = [...homeroomRooms, ...specialRooms];
  const homeroomRoomByClass = new Map(classNames.map((name, i) => [name, homeroomRooms[i]]));
  const roomByName = new Map(specialRooms.map(r => [r.name, r]));
  const splitRoomFor = (baseName: string, classIndex: number) =>
    roomByName.get(`${baseName}${(classIndex % 2) + 1}`)!;

  // 学年ごとに担当を分ける教科（現実の「学年主担当」に近い形）: 学年1教科あたり1人。
  const gradeTeachers: Record<string, [string, string, string]> = {
    国語: ['山田太郎', '佐藤花子', '鈴木一郎'],
    社会: ['田中美咲', '高橋健二', '伊藤さくら'],
    数学: ['渡辺健太', '小林由美', '加藤大輔'],
    理科: ['山本恵子', '中村真由美', '小川誠'],
    英語: ['斎藤陽子', '松本大輝', '井上由紀'],
  };
  // 1人が全クラスを受け持つ教科
  const wholeSchoolTeacher: Record<string, string> = {
    音楽: '木村隆',
    美術: '林美穂',
  };
  // 2人で学年をまたいで分担する教科（1・2年生を1人、3年生をもう1人）
  const splitGradeTeachers: Record<string, [string, string]> = {
    保健体育: ['清水健一', '山口愛'],
    技術・家庭: ['森田翔', '池田久美子'],
  };

  // 科目ごとの週コマ数（標準時数）: 主要5教科=3コマ、音楽・美術=1コマ、
  // 保健体育・技術家庭=2コマ ―― 合計で週21コマ（既定の週30コマ枠に収まる）。
  const subjectPlan: {
    subject: string;
    weeklyCount: number;
    room: 'homeroom' | 'special-single' | 'special-split';
    specialRoomBase?: string;
    priority?: boolean;
    teacherFor: (className: string) => string;
  }[] = [
    { subject: '国語', weeklyCount: 3, room: 'homeroom', teacherFor: cn => gradeTeachers['国語'][Number(gradeOf(cn)) - 1] },
    { subject: '社会', weeklyCount: 3, room: 'homeroom', teacherFor: cn => gradeTeachers['社会'][Number(gradeOf(cn)) - 1] },
    { subject: '数学', weeklyCount: 3, room: 'homeroom', teacherFor: cn => gradeTeachers['数学'][Number(gradeOf(cn)) - 1] },
    {
      subject: '理科', weeklyCount: 3, room: 'special-split', specialRoomBase: '理科室', priority: true,
      teacherFor: cn => gradeTeachers['理科'][Number(gradeOf(cn)) - 1],
    },
    { subject: '英語', weeklyCount: 3, room: 'homeroom', teacherFor: cn => gradeTeachers['英語'][Number(gradeOf(cn)) - 1] },
    { subject: '音楽', weeklyCount: 1, room: 'special-single', specialRoomBase: '音楽室', priority: true, teacherFor: () => wholeSchoolTeacher['音楽'] },
    { subject: '美術', weeklyCount: 1, room: 'special-single', specialRoomBase: '美術室', priority: true, teacherFor: () => wholeSchoolTeacher['美術'] },
    {
      subject: '保健体育', weeklyCount: 2, room: 'special-split', specialRoomBase: '体育館', priority: true,
      teacherFor: cn => (Number(gradeOf(cn)) <= 2 ? splitGradeTeachers['保健体育'][0] : splitGradeTeachers['保健体育'][1]),
    },
    {
      subject: '技術・家庭', weeklyCount: 2, room: 'special-split', specialRoomBase: '技術室', priority: true,
      teacherFor: cn => (Number(gradeOf(cn)) <= 2 ? splitGradeTeachers['技術・家庭'][0] : splitGradeTeachers['技術・家庭'][1]),
    },
  ];

  const lessons: Lesson[] = [];
  classNames.forEach((className, classIndex) => {
    const cls = classByName.get(className)!;
    for (const plan of subjectPlan) {
      const subject = subjectByName.get(plan.subject)!;
      const teacher = teacherByName.get(plan.teacherFor(className))!;
      const room = plan.room === 'homeroom'
        ? homeroomRoomByClass.get(className)!
        : plan.room === 'special-single'
        ? roomByName.get(plan.specialRoomBase!)!
        : splitRoomFor(plan.specialRoomBase!, classIndex);
      lessons.push({
        id: generateId(),
        type: 'basic',
        classIds: [cls.id],
        teacherIds: [teacher.id],
        subjectId: subject.id,
        roomIds: [room.id],
        weeklyCount: plan.weeklyCount,
        consecutive: 1,
        priority: plan.priority,
      });
    }
  });

  const optionPreset = DEFAULT_SCHEDULER_OPTIONS('標準');

  return {
    settings: {
      schoolName: 'サンプル中学校',
      days: DEFAULT_DAYS,
      periodsPerDay: 6,
      lunchAfterPeriod: 4,
    },
    classes,
    teachers,
    subjects,
    rooms,
    lessons,
    placements: [],
    optionPresets: [optionPreset],
    activeOptionId: optionPreset.id,
    meetings: [{
      id: generateId(),
      name: '職員会議',
      day: 2, // 水曜日
      period: 6,
      teacherIds: teachers.map(t => t.id),
    }],
    examSessions: [],
    bandPlacements: [],
    bandWeekOffset: 0,
  };
};
