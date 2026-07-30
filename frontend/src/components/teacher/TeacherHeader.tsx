import { useEffect, useState } from 'react';
import {
  GraduationCap,
  LogOut,
  ChevronDown,
  LayoutDashboard,
  ClipboardList,
  BookOpen,
  BarChart2,
  HeadphonesIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface TeacherHeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'exams', label: 'Exams', icon: ClipboardList },
  { id: 'questions', label: 'Question Bank', icon: BookOpen },
  { id: 'results', label: 'Results', icon: BarChart2 },
  { id: 'support', label: 'Support', icon: HeadphonesIcon },
];

function getStoredTeacherName(): string {
  try {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      const fullName = parsedUser?.full_name || parsedUser?.fullname || parsedUser?.fullName;
      if (typeof fullName === 'string' && fullName.trim()) {
        return fullName;
      }
    }
  } catch {
    // Ignore parsing errors and fall back to the simple storage key.
  }

  return localStorage.getItem('full_name') || localStorage.getItem('fullname') || 'Teacher';
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'T';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function TeacherHeader({ activeTab, onTabChange, onLogout }: TeacherHeaderProps) {
  const [teacherName, setTeacherName] = useState<string>(getStoredTeacherName);

  useEffect(() => {
    setTeacherName(getStoredTeacherName());
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full bg-gradient-to-r from-teal-600 via-teal-500 to-blue-600 shadow-lg">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
              <GraduationCap className="size-7 text-white" />
            </div>
            <div className="leading-tight">
              <span className="text-white text-xl font-semibold">OES</span>
              <span className="block text-teal-100 text-xs leading-none mt-0.5">Teacher Portal</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-base transition-all ${
                    isActive
                      ? 'bg-white text-teal-700 shadow-sm font-medium'
                      : 'text-white/80 hover:text-white hover:bg-white/15'
                  }`}
                >
                  <Icon className="size-4.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 hover:bg-white/15 rounded-xl px-3 py-2 transition-colors">
                <Avatar className="size-9 ring-2 ring-white/40 bg-white">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(teacherName)}`} />
                  <AvatarFallback className="bg-white text-teal-700 text-sm">
                    {getInitials(teacherName)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:block text-base text-white">{teacherName}</span>
                <ChevronDown className="size-4 text-white/70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Teacher Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onTabChange('profile')}>
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onTabChange('preferences')}>
                Preferences
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-red-600">
                <LogOut className="size-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
