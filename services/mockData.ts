import {
  ProjectData, SchoolClass, Teacher, Subject, Room, Lesson, DEFAULT_SCHEDULER_OPTIONS,
} from '../types';
import { generateId, DEFAULT_DAYS } from '../utils';
import { generateClassNames, SUBJECT_PRESETS } from '../data/presets';

// モック用のサンプルデータ: 中学校3学年×5クラス（15クラス）、先生約20人分の標準的な
// 時間割を想定したクラス・先生・科目・教室・授業一式。「サンプルデータを読み込む」から
// 利用できる。各クラスの週の合計コマ数は、実際の中学校の標準授業時数に近い構成
// （主要5教科4コマ・音楽/美術1コマ・保健体育3コマ・技術家庭2コマ・道徳/学級活動各1コマ）
// で週29コマとなり、既定の5日制×6時限（週30コマ枠）にほぼ収まる（空きは週1コマのみ）。
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
  const classIndexInGrade = (className: string) => Number(className.match(/(\d+)組$/)![1]) - 1;

  const teacherDefs: { name: string; short: string }[] = [
    { name: '山田太郎', short: '山田' }, { name: '佐藤花子', short: '佐藤' }, { name: '鈴木一郎', short: '鈴木' },
    { name: '田中美咲', short: '田中' }, { name: '高橋健二', short: '高橋' }, { name: '伊藤さくら', short: '伊藤' },
    { name: '渡辺健太', short: '渡辺' }, { name: '小林由美', short: '小林' }, { name: '加藤大輔', short: '加藤' },
    { name: '山本恵子', short: '山本' }, { name: '中村真由美', short: '中村' }, { name: '小川誠', short: '小川' },
    { name: '斎藤陽子', short: '斎藤' }, { name: '松本大輝', short: '松本' }, { name: '井上由紀', short: '井上' },
    { name: '木村隆', short: '木村' }, { name: '林美穂', short: '林' }, { name: '清水健一', short: '清水' },
    { name: '山口愛', short: '山口' }, { name: '森田翔', short: '森田' }, { name: '池田久美子', short: '池田' },
    { name: '石川優子', short: '石川' }, { name: '前田直樹', short: '前田' },
    { name: '松田健太', short: '松田' }, { name: '藤田真希', short: '藤田' },
  ];
  const teachers: Teacher[] = teacherDefs.map(t => ({
    id: generateId(), name: t.name, short: t.short, unavailable: [],
  }));
  const teacherByName = new Map(teachers.map(t => [t.name, t]));

  const subjectNames = ['国語', '社会', '数学', '理科', '英語', '音楽', '美術', '保健体育', '技術・家庭', '道徳', '学級活動'];
  const subjects: Subject[] = subjectNames.map(name => {
    const preset = SUBJECT_PRESETS.find(p => p.name === name);
    return { id: generateId(), name, color: preset?.color ?? 'blue', maxPerDayPerClass: 1, unavailable: [] };
  });
  const subjectByName = new Map(subjects.map(s => [s.name, s]));

  // 理科・保健体育は週コマ数が多いため特別教室を3部屋、技術家庭は2部屋用意し、
  // クラス番号の余りで振り分けて同時に使えるようにしている。
  const specialRoomNames = [
    '理科室1', '理科室2', '理科室3', '音楽室', '美術室', '体育館1', '体育館2', '体育館3', '技術室1', '技術室2',
  ];
  const homeroomRooms: Room[] = classNames.map(name => ({ id: generateId(), name: `${name}教室`, unavailable: [] }));
  const specialRooms: Room[] = specialRoomNames.map(name => ({ id: generateId(), name, unavailable: [] }));
  const rooms: Room[] = [...homeroomRooms, ...specialRooms];
  const homeroomRoomByClass = new Map(classNames.map((name, i) => [name, homeroomRooms[i]]));
  const roomByName = new Map(specialRooms.map(r => [r.name, r]));
  const splitRoomFor = (baseName: string, classIndex: number, roomCount: number) =>
    roomByName.get(`${baseName}${(classIndex % roomCount) + 1}`)!;

  // 学年ごとに担当を分ける教科（現実の「学年主担当」に近い形）: 学年1教科あたり1人。
  const gradeTeachers: Record<string, [string, string, string]> = {
    国語: ['山田太郎', '佐藤花子', '鈴木一郎'],
    社会: ['田中美咲', '高橋健二', '伊藤さくら'],
    数学: ['渡辺健太', '小林由美', '加藤大輔'],
    理科: ['山本恵子', '中村真由美', '小川誠'],
    英語: ['斎藤陽子', '松本大輝', '井上由紀'],
    保健体育: ['清水健一', '山口愛', '石川優子'],
    '技術・家庭': ['森田翔', '池田久美子', '前田直樹'],
  };
  // 1人が全クラスを受け持つ教科
  const wholeSchoolTeacher: Record<string, string> = {
    音楽: '木村隆',
    美術: '林美穂',
  };

  // 科目ごとの週コマ数（標準時数に準拠）: 主要5教科=4コマ、保健体育=3コマ、
  // 技術家庭=2コマ、音楽・美術・道徳・学級活動=各1コマ ―― 合計で週29コマ
  // （既定の週30コマ枠に対し空きは週1コマのみ）。道徳・学級活動はホームルーム教室で、
  // 国語・社会の学年担当教員は主要教科だけで既に週20コマと余裕が少ないため、より
  // 空きに余裕がある保健体育・技術家庭の学年担当教員が受け持つ形にしている。
  // 1年生の国語・社会だけは、駒入れの成功率を上げるため学年内でさらに2人に分担
  // （1〜3組／4〜5組）している。
  const subjectPlan: {
    subject: string;
    weeklyCount: number;
    room: 'homeroom' | 'special-single' | 'special-split';
    specialRoomBase?: string;
    specialRoomCount?: number;
    priority?: boolean;
    teacherFor: (className: string) => string;
  }[] = [
    {
      subject: '国語', weeklyCount: 4, room: 'homeroom',
      teacherFor: cn => (gradeOf(cn) === '1'
        ? (classIndexInGrade(cn) < 3 ? '山田太郎' : '松田健太')
        : gradeTeachers['国語'][Number(gradeOf(cn)) - 1]),
    },
    {
      subject: '社会', weeklyCount: 4, room: 'homeroom',
      teacherFor: cn => (gradeOf(cn) === '1'
        ? (classIndexInGrade(cn) < 3 ? '田中美咲' : '藤田真希')
        : gradeTeachers['社会'][Number(gradeOf(cn)) - 1]),
    },
    { subject: '数学', weeklyCount: 4, room: 'homeroom', teacherFor: cn => gradeTeachers['数学'][Number(gradeOf(cn)) - 1] },
    {
      subject: '理科', weeklyCount: 4, room: 'special-split', specialRoomBase: '理科室', specialRoomCount: 3, priority: true,
      teacherFor: cn => gradeTeachers['理科'][Number(gradeOf(cn)) - 1],
    },
    { subject: '英語', weeklyCount: 4, room: 'homeroom', teacherFor: cn => gradeTeachers['英語'][Number(gradeOf(cn)) - 1] },
    { subject: '音楽', weeklyCount: 1, room: 'special-single', specialRoomBase: '音楽室', priority: true, teacherFor: () => wholeSchoolTeacher['音楽'] },
    { subject: '美術', weeklyCount: 1, room: 'special-single', specialRoomBase: '美術室', priority: true, teacherFor: () => wholeSchoolTeacher['美術'] },
    {
      subject: '保健体育', weeklyCount: 3, room: 'special-split', specialRoomBase: '体育館', specialRoomCount: 3, priority: true,
      teacherFor: cn => gradeTeachers['保健体育'][Number(gradeOf(cn)) - 1],
    },
    {
      subject: '技術・家庭', weeklyCount: 2, room: 'special-split', specialRoomBase: '技術室', specialRoomCount: 2, priority: true,
      teacherFor: cn => gradeTeachers['技術・家庭'][Number(gradeOf(cn)) - 1],
    },
    { subject: '道徳', weeklyCount: 1, room: 'homeroom', teacherFor: cn => gradeTeachers['保健体育'][Number(gradeOf(cn)) - 1] },
    { subject: '学級活動', weeklyCount: 1, room: 'homeroom', teacherFor: cn => gradeTeachers['技術・家庭'][Number(gradeOf(cn)) - 1] },
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
        : splitRoomFor(plan.specialRoomBase!, classIndex, plan.specialRoomCount!);
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

  // 週29コマ（週30コマ枠の97%）と教員を共有する現実的な構成のため、既定の25回より
  // 試行回数を増やし、駒入れの成功率を上げている。
  const optionPreset = { ...DEFAULT_SCHEDULER_OPTIONS('標準'), maxAttempts: 100 };

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
