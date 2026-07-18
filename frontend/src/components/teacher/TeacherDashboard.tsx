import { useState, useEffect } from 'react';
import { TeacherHeader } from './TeacherHeader';
import { TeacherExamList } from './TeacherExamList';
import { TeacherInfoSidebar } from './TeacherInfoSidebar';
import { ExamManagerPage } from './exam-manager/ExamManagerPage';
import { QuestionBankPage } from './question-bank/QuestionBankPage';
import { ExamResultsPage } from './results/ExamResultsPage';
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
    setActiveTab('exams');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 flex flex-col">
      <TeacherHeader activeTab={activeTab} onTabChange={setActiveTab} onLogout={onLogout} />

      {activeTab === 'exams' ? (
        <ExamManagerPage initialExamId={selectedExamId} />
      ) : activeTab === 'questions' ? (
        <QuestionBankPage />
      ) : activeTab === 'results' ? (
        <ExamResultsPage />
      ) : activeTab === 'profile' ? (
        <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
          <ProfileSettings />
        </main>
      ) : activeTab === 'preferences' ? (
        <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
          <Preferences />
        </main>
      ) : (
        <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content - Exam List */}
              <div className="lg:col-span-2">
                <TeacherExamList onExamClick={handleNavigateToExam} />
              </div>

              {/* Sidebar */}
              <div className="lg:col-span-1">
                <TeacherInfoSidebar onExamClick={handleNavigateToExam} />
              </div>
            </div>
          )}

          {activeTab === 'support' && (
            <div className="max-w-5xl mx-auto">
              <div className="text-center py-12">
                <h2 className="text-2xl text-gray-800 mb-2">Technical Support</h2>
                <p className="text-gray-600">This section is under development</p>
              </div>
            </div>
          )}
        </main>
      )}

      {activeTab !== 'exams' && activeTab !== 'questions' && activeTab !== 'results' && (
        <Footer />
      )}
    </div>
  );
}
