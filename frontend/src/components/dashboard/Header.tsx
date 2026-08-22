import { useEffect, useMemo, useState } from 'react';
import { GraduationCap, LogOut, ChevronDown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useMyAvatar } from '../../hooks/useMyAvatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

const navigation = [
  { id: 'dashboard', label: 'Exam Calendar' },
  { id: 'my-exams', label: 'My Exams' },
  { id: 'results', label: 'Exam Results' },
];

// --- decode JWT payload (no extra lib) ---
function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  const first = parts[0][0] || 'U';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function getStoredFullName(): string {
  if (typeof window === 'undefined') return 'User';
  try {
    const storedUser = JSON.parse(localStorage.getItem('user') ?? '{}') as {
      full_name?: unknown;
      fullname?: unknown;
      fullName?: unknown;
    };
    const storedName = storedUser.full_name ?? storedUser.fullname ?? storedUser.fullName
      ?? localStorage.getItem('full_name') ?? localStorage.getItem('fullname');
    if (typeof storedName === 'string' && storedName.trim()) return storedName.trim();
  } catch {
    // A malformed legacy storage value must not prevent the navigation from rendering.
  }

  const token = localStorage.getItem('token');
  const nameFromToken = token ? decodeJwtPayload(token)?.full_name : null;
  return typeof nameFromToken === 'string' && nameFromToken.trim() ? nameFromToken.trim() : 'User';
}

export function Header({ activeTab, onTabChange, onLogout }: HeaderProps) {
  const [fullName, setFullName] = useState<string>(getStoredFullName);
  // Shared with Profile Settings, so an upload there lands here immediately.
  const { url: avatarUrl } = useMyAvatar();

  useEffect(() => {
    const refreshName = () => setFullName(getStoredFullName());
    window.addEventListener('storage', refreshName);
    return () => window.removeEventListener('storage', refreshName);
  }, []);

  const initials = useMemo(() => getInitials(fullName), [fullName]);
  const avatarSeed = encodeURIComponent(fullName || 'User');

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-sm shadow-md">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-teal-500 to-blue-600 rounded-xl shadow-lg">
              <GraduationCap className="size-6 text-white" />
            </div>
            <span className="font-semibold text-xl text-gray-800">OES</span>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`px-4 py-2 rounded-lg transition-all ${
                  activeTab === item.id
                    ? 'bg-teal-100 text-teal-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors">
                  <Avatar className="size-8">
                    <AvatarImage src={avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-sm text-gray-700">{fullName}</span>
                  <ChevronDown className="size-4 text-gray-500" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onTabChange('profile')}>
                  Profile Settings
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
      </div>
    </header>
  );
}
