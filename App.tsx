import React, { useEffect, useRef, useState } from 'react';
import {
  CalendarDays, Settings2, Users, ListChecks, Ban, Grid3x3, Sparkles, BarChart3,
  Download, Upload, Printer, FileSpreadsheet, FileCode2, GitMerge, Layers, FileQuestion, Users2, History, LayoutGrid,
  FlaskConical, FileUp,
} from 'lucide-react';
import { SetupWizard } from './components/SetupWizard';
import { MasterDataEditor } from './components/MasterDataEditor';
import { LessonEditor } from './components/LessonEditor';
import { ConstraintsEditor } from './components/ConstraintsEditor';
import { TimetableGrid } from './components/TimetableGrid';
import { AIAssistant } from './components/AIAssistant';
import { PrintSettingsDialog } from './components/PrintSettingsDialog';
import { MergeDataDialog } from './components/MergeDataDialog';
import { SummaryReport } from './components/SummaryReport';
import { BandTimetableTool } from './components/BandTimetableTool';
import { ExamTimetableEditor } from './components/ExamTimetableEditor';
import { MeetingEditor } from './components/MeetingEditor';
import { BackupPanel } from './components/BackupPanel';
import { TileView, TileTab } from './components/TileView';
import { ExcelImportDialog } from './components/ExcelImportDialog';
import { ImportResult } from './services/excelImportService';
import {
  AppStep, SchoolClass, Teacher, Subject, Room, Lesson, Placement, TimetableSettings,
  ProjectData, SchedulerOptions, DEFAULT_SCHEDULER_OPTIONS, PrintSettings, DEFAULT_PRINT_SETTINGS,
  Meeting, ExamSession,
} from './types';
import { runScheduler } from './services/scheduler';
import { exportCsv, exportHtml, saveProjectJson, loadProjectJson, mergeProjectData } from './services/exportService';
import { saveBackup } from './services/backupService';
import { buildMockProjectData } from './services/mockData';
import { DEFAULT_DAYS } from './utils';
import { useUndoableState } from './hooks/useUndoableState';

const STEPS: { key: AppStep; label: string; icon: React.ReactNode }[] = [
  { key: 'setup', label: '基本設定', icon: <Settings2 size={20} /> },
  { key: 'master', label: 'マスタデータ', icon: <Users size={20} /> },
  { key: 'lessons', label: '授業設定', icon: <ListChecks size={20} /> },
  { key: 'constraints', label: '個別条件', icon: <Ban size={20} /> },
  { key: 'timetable', label: '時間割作成', icon: <Grid3x3 size={20} /> },
  { key: 'tiles', label: 'タイル表示', icon: <LayoutGrid size={20} /> },
  { key: 'summary', label: '集計', icon: <BarChart3 size={20} /> },
  { key: 'meetings', label: '会議設定', icon: <Users2 size={20} /> },
  { key: 'exam', label: '試験時間割', icon: <FileQuestion size={20} /> },
  { key: 'band', label: '帯時間割', icon: <Layers size={20} /> },
];

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('setup');
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [backupEnabled, setBackupEnabled] = useState(false);
  const [backupIntervalMinutes, setBackupIntervalMinutes] = useState(10);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<TimetableSettings>({
    schoolName: '',
    days: DEFAULT_DAYS,
    periodsPerDay: 6,
    periodsPerDayOverrides: { 0: 5 }, // 月曜だけ既定で5時限（6限なし）
    lunchAfterPeriod: 4,
  });
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const {
    value: placements, setValue: setPlacements, undo: undoPlacements, redo: redoPlacements,
    canUndo, canRedo, reset: resetPlacements,
  } = useUndoableState<Placement[]>([]);
  const [optionPresets, setOptionPresets] = useState<SchedulerOptions[]>([DEFAULT_SCHEDULER_OPTIONS('標準')]);
  const [activeOptionId, setActiveOptionId] = useState<string>(optionPresets[0].id);
  const [printSettings, setPrintSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [examSessions, setExamSessions] = useState<ExamSession[]>([]);
  const [bandPlacements, setBandPlacements] = useState<Placement[]>([]);
  const [bandWeekOffset, setBandWeekOffset] = useState(0);
  const [jumpFocus, setJumpFocus] = useState<{ viewBy: 'class' | 'teacher' | 'room'; entityId: string } | null>(null);
  // 自動駒入れ中に少しずつ駒が埋まっていく様子を見せるための一時的なプレビュー状態。
  // 一手戻し履歴には残さず、完了時に一度だけ本来の setPlacements で確定させる。
  const [previewPlacements, setPreviewPlacements] = useState<Placement[] | null>(null);
  const [tileFocusTab, setTileFocusTab] = useState<TileTab | null>(null);

  const activeOption = optionPresets.find(o => o.id === activeOptionId) ?? optionPresets[0];
  const displayPlacements = previewPlacements ?? placements;

  const handleRunScheduler = () => {
    setIsRunning(true);
    setTimeout(() => {
      const result = runScheduler(
        { settings, classes, teachers, subjects, rooms, lessons, options: activeOption, meetings },
        placements,
      );
      const prevIds = new Set(placements.map(p => p.id));
      const kept = result.placements.filter(p => prevIds.has(p.id));
      const newOnes = result.placements
        .filter(p => !prevIds.has(p.id))
        .sort((a, b) => a.day - b.day || a.period - b.period);

      const finish = () => {
        setPlacements(result.placements);
        setPreviewPlacements(null);
        setIsRunning(false);
        setStep('tiles');
        setTileFocusTab('matrix');
      };

      if (newOnes.length === 0) {
        finish();
        return;
      }

      // コマが少しずつ配置されていく様子を視覚的に見せる（およそ30ステップで反映）
      const totalSteps = 30;
      const batchSize = Math.max(1, Math.ceil(newOnes.length / totalSteps));
      setPreviewPlacements(kept);
      let revealed = 0;
      const revealStep = () => {
        revealed += batchSize;
        if (revealed >= newOnes.length) {
          finish();
          return;
        }
        setPreviewPlacements([...kept, ...newOnes.slice(0, revealed)]);
        window.setTimeout(revealStep, 40);
      };
      window.setTimeout(revealStep, 40);
    }, 50);
  };

  const handleChangeMaxAttempts = (maxAttempts: number) => {
    setOptionPresets(prev => prev.map(o => (o.id === activeOptionId ? { ...o, maxAttempts } : o)));
  };

  const currentData = (): ProjectData => ({
    settings, classes, teachers, subjects, rooms, lessons, placements, optionPresets, activeOptionId,
    meetings, examSessions, bandPlacements, bandWeekOffset,
  });

  const applyProjectData = (data: ProjectData) => {
    setSettings(data.settings);
    setClasses(data.classes);
    setTeachers(data.teachers);
    setSubjects(data.subjects);
    setRooms(data.rooms);
    setLessons(data.lessons);
    resetPlacements(data.placements);
    if (data.optionPresets?.length) {
      setOptionPresets(data.optionPresets);
      setActiveOptionId(data.activeOptionId ?? data.optionPresets[0].id);
    }
    setMeetings(data.meetings ?? []);
    setExamSessions(data.examSessions ?? []);
    setBandPlacements(data.bandPlacements ?? []);
    setBandWeekOffset(data.bandWeekOffset ?? 0);
  };

  const handleLoad = async (file: File) => {
    const data = await loadProjectJson(file);
    applyProjectData(data);
  };

  const handleLoadMockData = () => {
    const hasExistingData = classes.length > 0 || teachers.length > 0 || subjects.length > 0 || lessons.length > 0;
    if (hasExistingData && !window.confirm('サンプルデータを読み込むと、現在のデータは上書きされます。よろしいですか？')) return;
    applyProjectData(buildMockProjectData());
    setStep('timetable');
  };

  const handleExcelImport = (result: ImportResult) => {
    setClasses(result.classes);
    setTeachers(result.teachers);
    setSubjects(result.subjects);
    setLessons(result.lessons);
    resetPlacements([]);
    setStep('lessons');
  };

  const handleMerge = (incoming: ProjectData) => {
    const merged = mergeProjectData(currentData(), incoming);
    setClasses(merged.classes);
    setTeachers(merged.teachers);
    setSubjects(merged.subjects);
    setRooms(merged.rooms);
    setLessons(merged.lessons);
  };

  // 自動バックアップ機能: 有効時は指定した間隔でローカルストレージへ自動保存する。
  // タイマー自体は間隔設定が変わるまで張り直さず、tick 時点の最新データを ref から読む。
  const currentDataRef = useRef<ProjectData>();
  currentDataRef.current = currentData();

  useEffect(() => {
    if (!backupEnabled) return;
    const id = setInterval(() => {
      if (currentDataRef.current) saveBackup(currentDataRef.current);
    }, Math.max(1, backupIntervalMinutes) * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backupEnabled, backupIntervalMinutes]);

  return (
    <div className="flex h-screen bg-gray-100 text-gray-800 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-20 bg-white border-r border-gray-200 flex-col items-center py-6 space-y-6 z-20 shadow-sm hidden sm:flex no-print overflow-y-auto">
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
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 no-print">
          <div className="flex items-center space-x-4 overflow-hidden">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 whitespace-nowrap flex items-baseline gap-2">
              <span>{settings.schoolName || 'イデア学園'} の AI時間割</span>
              <span
                className="text-xs font-normal text-gray-400 select-none"
                title={`アプリバージョン ${__APP_VERSION__}`}
              >
                v{__APP_VERSION__}
              </span>
            </h1>
            <div className="hidden lg:flex items-center bg-gray-100 rounded-lg p-1 space-x-1 overflow-x-auto">
              {STEPS.map(s => (
                <button
                  key={s.key}
                  onClick={() => setStep(s.key)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition whitespace-nowrap ${
                    step === s.key ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-1 flex-shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleLoad(f); e.target.value = ''; }}
            />
            <button
              onClick={handleLoadMockData}
              title="サンプルデータを読み込む"
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
            >
              <FlaskConical size={18} />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              title="ファイルを開く"
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
            >
              <Upload size={18} />
            </button>
            <button
              onClick={() => setIsMergeOpen(true)}
              title="データ結合（統合連結）"
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
            >
              <GitMerge size={18} />
            </button>
            <button
              onClick={() => setIsExcelImportOpen(true)}
              title="Excelから読み込む（統合版簡単設定）"
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
            >
              <FileUp size={18} />
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
              onClick={() => exportHtml(currentData())}
              title="HTML出力（ビューワー用）"
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
            >
              <FileCode2 size={18} />
            </button>
            <button
              onClick={() => setIsPrintOpen(true)}
              title="印刷"
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
            >
              <Printer size={18} />
            </button>
            <button
              onClick={() => setIsBackupOpen(true)}
              title="自動バックアップ"
              className={`p-2 rounded-lg transition ${backupEnabled ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-indigo-600 hover:bg-gray-100'}`}
            >
              <History size={18} />
            </button>
          </div>
        </header>

        {/* View Area */}
        <div className="flex-1 p-4 sm:p-6 overflow-auto relative print-hide-when-all">
          {step === 'setup' && (
            <SetupWizard settings={settings} onSave={s => { setSettings(s); setStep('master'); }} onLoadMockData={handleLoadMockData} />
          )}
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
            <ConstraintsEditor
              teachers={teachers} setTeachers={setTeachers}
              classes={classes} setClasses={setClasses}
              subjects={subjects} setSubjects={setSubjects}
              rooms={rooms} setRooms={setRooms}
              settings={settings}
              optionPresets={optionPresets} setOptionPresets={setOptionPresets}
              activeOptionId={activeOptionId} setActiveOptionId={setActiveOptionId}
            />
          )}
          {step === 'timetable' && (
            <TimetableGrid
              settings={settings} classes={classes} teachers={teachers} subjects={subjects} rooms={rooms}
              lessons={lessons} placements={displayPlacements} setPlacements={setPlacements}
              onRunScheduler={handleRunScheduler} isRunning={isRunning} activeOption={activeOption}
              onChangeMaxAttempts={handleChangeMaxAttempts}
              meetings={meetings}
              onUndo={undoPlacements} onRedo={redoPlacements} canUndo={canUndo} canRedo={canRedo}
              initialFocus={jumpFocus} onFocusHandled={() => setJumpFocus(null)}
            />
          )}
          {step === 'tiles' && (
            <TileView
              settings={settings} classes={classes} teachers={teachers} rooms={rooms} subjects={subjects}
              lessons={lessons} placements={displayPlacements}
              onOpenEntity={(viewBy, entityId) => { setJumpFocus({ viewBy, entityId }); setStep('timetable'); }}
              onRunScheduler={handleRunScheduler} isRunning={isRunning} activeOption={activeOption}
              onChangeMaxAttempts={handleChangeMaxAttempts}
              focusTab={tileFocusTab} onFocusTabHandled={() => setTileFocusTab(null)}
            />
          )}
          {step === 'summary' && <SummaryReport data={currentData()} />}
          {step === 'meetings' && (
            <MeetingEditor meetings={meetings} setMeetings={setMeetings} teachers={teachers} rooms={rooms} settings={settings} />
          )}
          {step === 'exam' && (
            <ExamTimetableEditor
              settings={settings} setSettings={setSettings} classes={classes} subjects={subjects}
              examSessions={examSessions} setExamSessions={setExamSessions}
            />
          )}
          {step === 'band' && (
            <BandTimetableTool
              settings={settings} setSettings={setSettings}
              classes={classes} teachers={teachers} subjects={subjects} rooms={rooms} lessons={lessons}
              bandPlacements={bandPlacements} setBandPlacements={setBandPlacements}
              bandWeekOffset={bandWeekOffset} setBandWeekOffset={setBandWeekOffset}
              activeOption={activeOption}
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

      <PrintSettingsDialog
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        data={currentData()}
        printSettings={printSettings}
        setPrintSettings={setPrintSettings}
      />
      <MergeDataDialog isOpen={isMergeOpen} onClose={() => setIsMergeOpen(false)} onMerge={handleMerge} />
      <ExcelImportDialog isOpen={isExcelImportOpen} onClose={() => setIsExcelImportOpen(false)} onApply={handleExcelImport} />
      <BackupPanel
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        currentData={currentData}
        onRestore={applyProjectData}
        enabled={backupEnabled}
        setEnabled={setBackupEnabled}
        intervalMinutes={backupIntervalMinutes}
        setIntervalMinutes={setBackupIntervalMinutes}
      />
    </div>
  );
};

export default App;
