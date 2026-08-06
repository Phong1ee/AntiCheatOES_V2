import { useState, useEffect } from 'react';
import { TeacherHeader } from './TeacherHeader';
import { TeacherExamList } from './TeacherExamList';
import { TeacherInfoSidebar } from './TeacherInfoSidebar';
import { ExamManagerPage } from './exam-manager/ExamManagerPage';
import { QuestionBankPage } from './question-bank/QuestionBankPage';
import { ExamResultsPage } from './results/ExamResultsPage';
import { AntiCheatMonitor } from './anti-cheat/AntiCheatMonitor';
import { Footer } from '../dashboard/Footer';
import { useUserRole } from '../../contexts/UserRoleContext';
import { ProfileSettings } from '../ProfileSettings';
import { Preferences } from '../Preferences';

interface TeacherDashboardProps {
  onLogout: () => void;
}

export function TeacherDashboard({ onLogout }: TeacherDashboardProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [examManagerTab, setExamManagerTab] = useState<'general' | 'settings'>('general');
  const [resultsExamId, setResultsExamId] = useState<string | null>(null);
  const { setUser } = useUserRole();

  // Set user role on mount
  useEffect(() => {
    setUser({
      id: '1',
      name: 'Dr. Sarah Johnson',
      email: 'sarah.johnson@oes.edu',
      role: 'teacher',
    });
  }, [setUser]);

  // Scroll to top when tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  const handleNavigateToExam = (examId: string) => {
    setSelectedExamId(examId);
    setExamManagerTab('general');
    setActiveTab('exams');
  };

  const handleNavigateToSettings = (examId: string) => {
    setSelectedExamId(examId);
    setExamManagerTab('settings');
    setActiveTab('exams');
  };

  const handleNavigateToResults = (examId: string) => {
    setResultsExamId(examId);
    setActiveTab('results');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 flex flex-col">
      <TeacherHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={onLogout}
      />

      {activeTab === 'exams' ? (
        <ExamManagerPage
          initialExamId={selectedExamId}
          initialTab={examManagerTab}
        />
      ) : activeTab === 'questions' ? (
        <QuestionBankPage />
      ) : activeTab === 'results' ? (
        <ExamResultsPage initialExamId={resultsExamId} />
      ) : activeTab === 'anticheat' ? (
        <AntiCheatMonitor />
      ) : activeTab === 'profile' ? (
        <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
          <ProfileSettings />
        </main>
      ) : activeTab === 'preferences' ? (
        <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
          <Preferences />
        </main>
      ) : (
        <main className="h-[calc(100vh-80px)] overflow-hidden container mx-auto max-w-7xl px-4 py-8">
          {activeTab === 'dashboard' && (
            <div className="grid h-full grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content - Exam List */}
              <div className="lg:col-span-2 h-full overflow-hidden">
                <TeacherExamList
                  onExamClick={handleNavigateToExam}
                  onNavigateToSettings={handleNavigateToSettings}
                  onNavigateToResults={handleNavigateToResults}
                />
              </div>

              {/* Sidebar */}
              <div className="lg:col-span-1 h-full overflow-y-auto pr-1">
                <TeacherInfoSidebar onExamClick={handleNavigateToExam} />
              </div>
            </div>
          )}
        </main>
      )}

      {activeTab !== 'exams' &&
        activeTab !== 'questions' &&
        activeTab !== 'results' &&
        activeTab !== 'anticheat' &&
        activeTab !== 'dashboard' && <Footer />}
    </div>
  );
}