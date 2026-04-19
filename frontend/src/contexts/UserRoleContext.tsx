import { createContext, useContext, useState, ReactNode } from 'react';

type UserRole = 'admin' | 'teacher' | 'student';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface UserRoleContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>({
    id: '1',
    name: 'Admin User',
    email: 'admin@oes.edu',
    role: 'admin', // Default to admin for now
  });

  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';

  return (
    <UserRoleContext.Provider
      value={{
        user,
        setUser,
        isAdmin,
        isTeacher,
        isStudent,
      }}
    >
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole() {
  const context = useContext(UserRoleContext);
  if (context === undefined) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
}
