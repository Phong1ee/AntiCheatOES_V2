import { useState } from 'react';
import { Header } from './dashboard/Header';
import { ExamCalendar } from './dashboard/ExamCalendar';
import { ExamList } from './dashboard/ExamList';
import { InfoSidebar } from './dashboard/InfoSidebar';
import { Footer } from './dashboard/Footer';
import { ExamInterface } from './exam/ExamInterface';
import { ExamResults } from './ExamResults';
import { ExamResultDetailsPage } from './exam-results/ExamResultDetailsPage';
import { ProfileSettings } from './ProfileSettings';
import { Preferences } from './Preferences';
import { useStudentDashboardData } from '../hooks/useStudentDashboardData';
import type { StudentExamListItem } from '../services/student-exam.service';
import type { AntiCheatRuntime } from '../anti-cheat/anti-cheat-runtime';

interface DashboardProps {
  onLogout: () => void;
}

export function Dashboard({ onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentExamId, setCurrentExamId] = useState<string | null>(null);
  const [examMediaStream, setExamMediaStream] = useState<MediaStream | null>(null);
  const [examAntiCheatRuntime, setExamAntiCheatRuntime] = useState<AntiCheatRuntime | null>(null);
  const [refreshViolationRecorded, setRefreshViolationRecorded] = useState(false);
  const [viewingAttemptId, setViewingAttemptId] = useState<number | null>(null);
  const [selectedResultExamId, setSelectedResultExamId] = useState<string | null>(null);
  const [myExamsAccessExamId, setMyExamsAccessExamId] = useState<string | null>(null);
  const [calendarAccessExamId, setCalendarAccessExamId] = useState<string | null>(null);
  const [calendarLaunchExam, setCalendarLaunchExam] = useState<StudentExamListItem | null>(null);
  const [calendarLaunchError, setCalendarLaunchError] = useState<string | null>(null);
  const dashboardData = useStudentDashboardData();

  const handleEnterExam = (examId: string, stream?: MediaStream, didRecordRefreshViolation = false, runtime?: AntiCheatRuntime) => {
    setCalendarLaunchExam(null);
    setCalendarLaunchError(null);
    setExamMediaStream(stream ?? null);
    setExamAntiCheatRuntime(runtime ?? null);
    setRefreshViolationRecorded(didRecordRefreshViolation);
    setCurrentExamId(examId);
  };

  const handleExitExam = () => {
    examAntiCheatRuntime?.stop();
    examMediaStream?.getTracks().forEach((track) => track.stop());
    setExamMediaStream(null);
    setExamAntiCheatRuntime(null);
    setRefreshViolationRecorded(false);
    setCurrentExamId(null);
    setActiveTab('my-exams');
    setCalendarLaunchExam(null);
    void dashboardData.retry();
  };

  const handleViewResultDetails = (attemptId: number, examId: number) => {
    setSelectedResultExamId(String(examId));
    setViewingAttemptId(attemptId);
  };

  const handleViewResultsFromMyExams = (examId: string) => {
    setSelectedResultExamId(examId);
    setActiveTab('results');
  };

  const handleCalendarExamAccess = (exam: StudentExamListItem) => {
    if (exam.status !== 'open') return;
    setCalendarLaunchError(null);
    const startsImmediately = exam.canResume
      ? !exam.antiCheatEnabled
      : !exam.requiresExamCode && !exam.antiCheatEnabled;
    setCalendarLaunchExam(startsImmediately ? exam : null);
    setCalendarAccessExamId(exam.id);
  };

  const handleMyExamsAccess = (exam: StudentExamListItem) => {
    if (exam.status !== 'open') return;
    setMyExamsAccessExamId(exam.id);
  };

  if (currentExamId) {
    return <ExamInterface
      examId={currentExamId}
      onExit={handleExitExam}
      mediaStream={examMediaStream ?? undefined}
      preloadedAntiCheatRuntime={examAntiCheatRuntime ?? undefined}
      refreshViolationRecorded={refreshViolationRecorded}
    />;
  }

  return <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 flex flex-col">
    <Header activeTab={activeTab} onTabChange={setActiveTab} onLogout={onLogout} />
    <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
      {activeTab === 'dashboard' && <>
        <ExamCalendar
          exams={dashboardData.exams}
          loading={dashboardData.examsLoading}
          loadError={dashboardData.examsError}
          serverTime={dashboardData.serverTime}
          onRetry={dashboardData.retry}
          onOpenExam={handleCalendarExamAccess}
          onViewResults={handleViewResultsFromMyExams}
        />
        <div className="hidden" aria-hidden="true"><ExamList
          onEnterExam={handleEnterExam}
          exams={dashboardData.exams}
          loading={dashboardData.examsLoading}
          loadError={dashboardData.examsError}
          onRetry={dashboardData.retry}
          autoOpenCodeExamId={calendarAccessExamId}
          onAutoOpenHandled={() => setCalendarAccessExamId(null)}
          onStartError={(message) => { setCalendarLaunchExam(null); setCalendarLaunchError(message); }}
        /></div>
        {calendarLaunchExam && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4" role="status" aria-live="polite"><div className="w-full max-w-sm rounded-2xl bg-white p-7 text-center shadow-2xl"><div className="mx-auto mb-4 size-9 animate-spin rounded-full border-4 border-teal-100 border-t-teal-600" /><h2 className="text-lg font-semibold text-slate-900">Preparing your exam</h2><p className="mt-2 text-sm text-slate-600">Starting {calendarLaunchExam.title} securely...</p></div></div>}
        {calendarLaunchError && <div className="fixed bottom-5 right-5 z-[60] max-w-sm rounded-xl border border-red-200 bg-white p-4 shadow-xl" role="alert"><p className="text-sm text-red-700">{calendarLaunchError}</p><button className="mt-2 text-sm font-medium text-teal-700" onClick={() => setCalendarLaunchError(null)}>Dismiss</button></div>}
      </>}

      {activeTab === 'my-exams' && <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><ExamList
          onEnterExam={handleEnterExam}
          onViewResults={handleViewResultsFromMyExams}
          exams={dashboardData.exams}
          loading={dashboardData.examsLoading}
          loadError={dashboardData.examsError}
          onRetry={dashboardData.retry}
          autoOpenCodeExamId={myExamsAccessExamId}
          onAutoOpenHandled={() => setMyExamsAccessExamId(null)}
        /></div>
        <div className="lg:col-span-1"><InfoSidebar
          results={dashboardData.results}
          loading={dashboardData.resultsLoading}
          loadError={dashboardData.resultsError}
          onRetry={dashboardData.retry}
          exams={dashboardData.exams}
          serverTime={dashboardData.serverTime}
          onRequestExamAccess={handleMyExamsAccess}
        /></div>
      </div>}

      {activeTab === 'results' && (viewingAttemptId !== null
        ? <ExamResultDetailsPage attemptId={viewingAttemptId} onBack={() => setViewingAttemptId(null)} />
        : <ExamResults onViewDetails={handleViewResultDetails} initialExamId={selectedResultExamId} />)}

      {activeTab === 'support' && <div className="max-w-5xl mx-auto text-center py-12">
        <h2 className="text-2xl text-gray-800 mb-2">Technical Support</h2>
        <p className="text-gray-600">This section is under development</p>
      </div>}
      {activeTab === 'profile' && <ProfileSettings />}
      {activeTab === 'preferences' && <Preferences />}
    </main>
    <Footer />
  </div>;
}
