import { Button } from '../ui/button';
import { Shield, Activity, Users, FileText, BookOpen, LogOut, UserCog } from 'lucide-react';

interface AdminHeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

export function AdminHeader({ activeTab, onTabChange, onLogout }: AdminHeaderProps) {
  const tabs = [
    { id: 'monitoring', label: 'System Health', icon: Activity },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'permissions', label: 'Teacher Permissions', icon: UserCog },
    { id: 'audit', label: 'Audit Log', icon: FileText },
    { id: 'questions', label: 'Question Bank', icon: BookOpen },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg">
              <Shield className="size-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl text-gray-900">Admin Dashboard</h1>
              <p className="text-xs text-gray-500">System Administration</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-red-500 to-orange-600 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="size-4" />
                  <span className="text-sm">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Logout Button */}
          <Button
            onClick={onLogout}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-3 flex gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg whitespace-nowrap text-sm transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-red-500 to-orange-600 text-white'
                    : 'text-gray-600 bg-gray-100'
                }`}
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}