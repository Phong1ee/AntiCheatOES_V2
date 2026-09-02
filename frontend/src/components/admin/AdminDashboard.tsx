import { useState } from 'react';
import { AdminHeader } from './AdminHeader';
import { SystemHealthPage } from './SystemHealthPage';
import { UserManagementPage } from './UserManagementPage';
import { TeacherPermissionsPage } from './TeacherPermissionsPage';
import { AuditLogPage } from './AuditLogPage';
import { AdminQuestionBankPage } from './AdminQuestionBankPage';
import { SubjectClassPage } from './SubjectClassPage';
import { AdminBulkDataRequestsPage } from './AdminBulkDataRequestsPage';
import { Footer } from '../dashboard/Footer';

interface AdminDashboardProps {
  onLogout: () => void;
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState('monitoring');
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 flex flex-col">
      <AdminHeader activeTab={activeTab} onTabChange={setActiveTab} onLogout={onLogout} />

      {activeTab === 'monitoring' && <SystemHealthPage />}
      {activeTab === 'users' && <UserManagementPage />}
      {activeTab === 'permissions' && <TeacherPermissionsPage />}
      {activeTab === 'classes' && <SubjectClassPage />}
      {activeTab === 'audit' && <AuditLogPage />}
      {activeTab === 'questions' && <AdminQuestionBankPage />}
      {activeTab === 'bulk-requests' && <AdminBulkDataRequestsPage />}
      <Footer />
    </div>
  );
}
