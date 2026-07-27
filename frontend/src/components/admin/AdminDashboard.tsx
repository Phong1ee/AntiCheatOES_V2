import { useState } from 'react';
import { AdminHeader } from './AdminHeader';
import { SystemHealthPage } from './SystemHealthPage';
import { UserManagementPage } from './UserManagementPage';
import { TeacherPermissionsPage } from './TeacherPermissionsPage';
import { AuditLogPage } from './AuditLogPage';
import { AdminQuestionBankPage } from './AdminQuestionBankPage';

interface AdminDashboardProps {
  onLogout: () => void;
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState('monitoring');
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <AdminHeader activeTab={activeTab} onTabChange={setActiveTab} onLogout={onLogout} />

      {activeTab === 'monitoring' && <SystemHealthPage />}
      {activeTab === 'users' && <UserManagementPage />}
      {activeTab === 'permissions' && <TeacherPermissionsPage />}
      {activeTab === 'audit' && <AuditLogPage />}
      {activeTab === 'questions' && <AdminQuestionBankPage />}
    </div>
  );
}
