import React, { useRef, useState } from 'react';
import {
  CalendarDays, Settings2, Users, ListChecks, Ban, Grid3x3, Sparkles,
  Download, Upload, Printer, FileSpreadsheet,
} from 'lucide-react';
import { SetupWizard } from './components/SetupWizard';
import { MasterDataEditor } from './components/MasterDataEditor';
import { LessonEditor } from './components/LessonEditor';
import { ConstraintsEditor } from './components/ConstraintsEditor';
import { TimetableGrid } from './components/TimetableGrid';
import { AIAssistant } from './components/AIAssistant';
import {
  AppStep, SchoolClass, Teacher, Subject, Room, Lesson, Placement, TimetableSettings,
  ProjectData,
} from './types';
import { runScheduler } from './services/scheduler';
import { exportCsv, saveProjectJson, loadProjectJson } from './services/exportService';
import { DEFAULT_DAYS } from './utils';

const STEPS: { key: AppStep; label: string; icon: React.ReactNode }[] = [
  { key: 'setup', label: '基本設定', icon: <Settings2 size={20} /> },
  { key: 'master', label: 'マスタデータ', icon: <Users size={20} /> },
  { key: 'lessons', label: '授業設定', icon: <ListChecks size={20} /> },
  { key: 'constraints', label: '個別条件', icon: <Ban size={20} /> },
  { key: 'timetable', label: '時間割作成', icon: <Grid3x3 size={20} /> },
];

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('setup');
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<TimetableSettings>({
    schoolName: '',
    days: DEFAULT_DAYS,
    periodsPerDay: 6,
    lunchAfterPeriod: 4,
  });
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);

  const handleRunScheduler = () => {
    setIsRunning(true);
    setTimeout(() => {
      const result = runScheduler({ settings, classes, teachers, subjects, lessons }, placements);
      setPlacements(result.placements);
      setIsRunning(false);
    }, 50);
  };

  const currentData = (): ProjectData => ({ settings, classes, teachers, subjects, rooms, lessons, placements });

  const handleLoad = async (file: File) => {
    const data = await loadProjectJson(file);
    setSettings(data.settings);
    setClasses(data.classes);
    setTeachers(data.teachers);
    setSubjects(data.subjects);
    setRooms(data.rooms);
    setLessons(data.lessons);
    setPlacements(data.placements);
  };

  return (
    <div className="flex h-screen bg-gray-100 text-gray-800 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-20 bg-white border-r border-gray-200 flex-col items-center py-6 space-y-6 z-20 shadow-sm hidden sm:flex">
        <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
          <CalendarDays size={28} />
        </div>
        <nav className="flex flex-col space-y-3 w-full items-center">
          {STEPS.map(s => (
            <button
              key={s.key}
              onClick={() => setStep(s.key)}
              className={`p-3 rounded-xl transition-all ${
                step === s.key ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
              title={s.label}
            >
              {s.icon}
            </button>
          ))}
        </nav>
        <div className="mt-auto flex flex-col items-center w-full">
          <button
            onClick={() => setIsAIOpen(!isAIOpen)}
            className={`p-3 rounded-xl transition-all relative ${
              isAIOpen ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'
            }`}
            title="AIアシスタント"
          >
            <Sparkles size={24} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold tracking-tight text-gray-900">
              {settings.schoolName || 'イデア学園'} の AI時間割
            </h1>
            <div className="hidden md:flex items-center bg-gray-100 rounded-lg p-1 space-x-1">
              {STEPS.map(s => (
                <button
                  key={s.key}
                  onClick={() => setStep(s.key)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                    step === s.key ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleLoad(f); e.target.value = ''; }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="ファイルを開く"
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
            >
              <Upload size={18} />
            </button>
            <button
              onClick={() => saveProjectJson(currentData())}
              title="名前を付けて保存"
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
            >
              <Download size={18} />
            </button>
            <button
              onClick={() => exportCsv(currentData())}
              title="テキスト（CSV）出力"
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
            >
              <FileSpreadsheet size={18} />
            </button>
            <button
              onClick={() => window.print()}
              title="印刷"
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
            >
              <Printer size={18} />
            </button>
          </div>
        </header>

        {/* View Area */}
        <div className="flex-1 p-4 sm:p-6 overflow-auto relative">
          {step === 'setup' && <SetupWizard settings={settings} onSave={s => { setSettings(s); setStep('master'); }} />}
          {step === 'master' && (
            <MasterDataEditor
              classes={classes} teachers={teachers} subjects={subjects} rooms={rooms}
              setClasses={setClasses} setTeachers={setTeachers} setSubjects={setSubjects} setRooms={setRooms}
            />
          )}
          {step === 'lessons' && (
            <LessonEditor lessons={lessons} setLessons={setLessons} classes={classes} teachers={teachers} subjects={subjects} rooms={rooms} />
          )}
          {step === 'constraints' && (
            <ConstraintsEditor teachers={teachers} setTeachers={setTeachers} settings={settings} />
          )}
          {step === 'timetable' && (
            <TimetableGrid
              settings={settings} classes={classes} teachers={teachers} subjects={subjects} rooms={rooms}
              lessons={lessons} placements={placements} setPlacements={setPlacements}
              onRunScheduler={handleRunScheduler} isRunning={isRunning}
            />
          )}
        </div>

        <AIAssistant
          isOpen={isAIOpen}
          onClose={() => setIsAIOpen(false)}
          settings={settings}
          classes={classes}
          teachers={teachers}
          subjects={subjects}
          lessons={lessons}
          placements={placements}
        />
      </main>
    </div>
  );
};

export default App;
