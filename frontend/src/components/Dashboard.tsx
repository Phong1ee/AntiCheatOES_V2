import { useState } from 'react';
import { Header } from './dashboard/Header';
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

interface DashboardProps {
  onLogout: () => void;
}

export function Dashboard({ onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentExamId, setCurrentExamId] = useState<string | null>(null);
  const [viewingAttemptId, setViewingAttemptId] = useState<number | null>(null);
  const [selectedResultExamId, setSelectedResultExamId] = useState<string | null>(null);
  const [accessExamId, setAccessExamId] = useState<string | null>(null);
  const dashboardData = useStudentDashboardData();

  const handleEnterExam = (examId: string) => {
    setCurrentExamId(examId);
  };

  const handleExitExam = () => {
    setCurrentExamId(null);
  };

  // ✅ dùng cho nút "View" trong trang Exam Results
  const handleViewResultDetails = (attemptId: number, examId: number) => {
    setSelectedResultExamId(String(examId));
    setViewingAttemptId(attemptId);
  };

  const handleBackToResults = () => {
    setViewingAttemptId(null);
  };

  // ✅ dùng cho nút "View Results" ở My Exams / Dashboard
  // chỉ cần chuyển tab sang "results"
  const handleViewResultsFromMyExams = (examId: string) => {
    // nếu sau này cần filter theo examId thì có thể lưu lại ở đây
    setSelectedResultExamId(examId);
    setActiveTab('results');
  };
  const handleRequestExamAccess = (exam: StudentExamListItem) => { if (exam.status === 'open') { setAccessExamId(exam.id); setActiveTab('my-exams'); } };

  if (currentExamId) {
    return (
      <ExamInterface
        examId={currentExamId}
        onExit={handleExitExam}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 flex flex-col">
      <Header activeTab={activeTab} onTabChange={setActiveTab} onLogout={onLogout} />
      
      <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ExamList
                onEnterExam={handleEnterExam}
                // 🔁 View Results ở phần dashboard -> sang tab Exam Results
                onViewResults={handleViewResultsFromMyExams}
                exams={dashboardData.exams}
                loading={dashboardData.examsLoading}
                loadError={dashboardData.examsError}
                onRetry={dashboardData.retry}
              />
            </div>
            <div className="lg:col-span-1">
              <InfoSidebar
                results={dashboardData.results}
                loading={dashboardData.resultsLoading}
                loadError={dashboardData.resultsError}
                onRetry={dashboardData.retry}
                exams={dashboardData.exams}
                serverTime={dashboardData.serverTime}
                onRequestExamAccess={handleRequestExamAccess}
              />
            </div>
          </div>
        )}

        {activeTab === 'my-exams' && (
          <div className="max-w-5xl mx-auto">
            <ExamList
              onEnterExam={handleEnterExam}
              // 🔁 View Results ở tab My Exams cũng giống vậy
              onViewResults={handleViewResultsFromMyExams}
              exams={dashboardData.exams}
              loading={dashboardData.examsLoading}
              loadError={dashboardData.examsError}
              onRetry={dashboardData.retry}
              autoOpenCodeExamId={accessExamId}
            />
          </div>
        )}

        {activeTab === 'results' && (
          // Ở trang Exam Results, nút View sẽ mở trang chi tiết 1 attempt
          viewingAttemptId !== null
            ? <ExamResultDetailsPage attemptId={viewingAttemptId} onBack={handleBackToResults} />
            : <ExamResults onViewDetails={handleViewResultDetails} initialExamId={selectedResultExamId} />
        )}

        {activeTab === 'support' && (
          <div className="max-w-5xl mx-auto">
            <div className="text-center py-12">
              <h2 className="text-2xl text-gray-800 mb-2">Technical Support</h2>
              <p className="text-gray-600">This section is under development</p>
            </div>
          </div>
        )}

        {activeTab === 'profile' && <ProfileSettings />}

        {activeTab === 'preferences' && <Preferences />}
      </main>

      <Footer />
    </div>
  );
}
