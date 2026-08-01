import {
  ProjectData, SchoolClass, Teacher, Subject, Room, Lesson, DEFAULT_SCHEDULER_OPTIONS,
} from '../types';
import { generateId, DEFAULT_DAYS } from '../utils';
import { generateClassNames, SUBJECT_PRESETS } from '../data/presets';

// モック用のサンプルデータ: 中学校3学年×2クラスの標準的な時間割を想定した
// クラス・先生・科目・教室・授業一式。「サンプルデータを読み込む」から利用できる。
export const buildMockProjectData = (): ProjectData => {
  const classNames = generateClassNames(3, 2); // 1年1組 ... 3年2組
  const classes: SchoolClass[] = classNames.map(name => ({
    id: generateId(),
    name,
    grade: name.match(/^(\d+年)/)?.[1],
    unavailable: [],
  }));
  const classByName = new Map(classes.map(c => [c.name, c]));

  const teacherDefs: { name: string; short: string }[] = [
    { name: '山田太郎', short: '山田' },
    { name: '佐藤花子', short: '佐藤' },
    { name: '鈴木一郎', short: '鈴木' },
    { name: '田中美咲', short: '田中' },
    { name: '高橋健二', short: '高橋' },
    { name: '伊藤さくら', short: '伊藤' },
    { name: '渡辺健太', short: '渡辺' },
    { name: '小林由美', short: '小林' },
    { name: '加藤大輔', short: '加藤' },
    { name: '山本恵子', short: '山本' },
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

  const specialRoomNames = ['理科室', '音楽室', '美術室', '体育館', '技術室'];
  const homeroomRooms: Room[] = classNames.map(name => ({ id: generateId(), name: `${name}教室`, unavailable: [] }));
  const specialRooms: Room[] = specialRoomNames.map(name => ({ id: generateId(), name, unavailable: [] }));
  const rooms: Room[] = [...homeroomRooms, ...specialRooms];
  const homeroomRoomByClass = new Map(classNames.map((name, i) => [name, homeroomRooms[i]]));
  const roomByName = new Map(specialRooms.map(r => [r.name, r]));

  // 科目ごとの: 週コマ数・担当の割り振り方・使用教室・先入れフラグ
  const subjectPlan: {
    subject: string;
    weeklyCount: number;
    room: 'homeroom' | string;
    priority?: boolean;
    teacherFor: (className: string) => string;
  }[] = [
    { subject: '国語', weeklyCount: 4, room: 'homeroom', teacherFor: () => '山田太郎' },
    { subject: '社会', weeklyCount: 3, room: 'homeroom', teacherFor: () => '伊藤さくら' },
    {
      subject: '数学', weeklyCount: 4, room: 'homeroom',
      teacherFor: className => ['1年1組', '1年2組', '2年1組'].includes(className) ? '佐藤花子' : '鈴木一郎',
    },
    { subject: '理科', weeklyCount: 3, room: '理科室', priority: true, teacherFor: () => '高橋健二' },
    { subject: '英語', weeklyCount: 4, room: 'homeroom', teacherFor: () => '田中美咲' },
    { subject: '音楽', weeklyCount: 1, room: '音楽室', priority: true, teacherFor: () => '渡辺健太' },
    { subject: '美術', weeklyCount: 1, room: '美術室', priority: true, teacherFor: () => '小林由美' },
    { subject: '保健体育', weeklyCount: 3, room: '体育館', priority: true, teacherFor: () => '加藤大輔' },
    { subject: '技術・家庭', weeklyCount: 2, room: '技術室', priority: true, teacherFor: () => '山本恵子' },
  ];

  const lessons: Lesson[] = [];
  for (const className of classNames) {
    const cls = classByName.get(className)!;
    for (const plan of subjectPlan) {
      const subject = subjectByName.get(plan.subject)!;
      const teacher = teacherByName.get(plan.teacherFor(className))!;
      const room = plan.room === 'homeroom' ? homeroomRoomByClass.get(className)! : roomByName.get(plan.room)!;
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
  }

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
