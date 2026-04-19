import { useState } from "react";
import { Login } from "./components/Login";
import { Register } from "./components/Register";
import { ForgotPassword } from "./components/ForgotPassword";
import { Dashboard } from "./components/Dashboard";
import { TeacherDashboard } from "./components/teacher/TeacherDashboard";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { Toaster } from "./components/ui/sonner";
import { UserRoleProvider } from "./contexts/UserRoleContext";

type Page =
  | "login"
  | "register"
  | "forgot-password"
  | "dashboard"
  | "teacher-dashboard"
  | "admin-dashboard";
type UserRole = "student" | "teacher" | "admin" | null;

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("login");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(null);

  const handleLogin = (role: UserRole = "student") => {
    setIsAuthenticated(true);
    setUserRole(role);
    if (role === "admin") {
      setCurrentPage("admin-dashboard");
    } else if (role === "teacher") {
      setCurrentPage("teacher-dashboard");
    } else {
      setCurrentPage("dashboard");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserRole(null);
    setCurrentPage("login");
  };

  return (
    <UserRoleProvider>
      {isAuthenticated && currentPage === "dashboard" && (
        <Dashboard onLogout={handleLogout} />
      )}

      {isAuthenticated &&
        currentPage === "teacher-dashboard" && (
          <>
            <TeacherDashboard onLogout={handleLogout} />
            <Toaster />
          </>
        )}

      {isAuthenticated && currentPage === "admin-dashboard" && (
        <>
          <AdminDashboard onLogout={handleLogout} />
          <Toaster />
        </>
      )}

      {!isAuthenticated && (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 flex items-center justify-center p-4">
          {currentPage === "login" && (
            <Login
              onNavigate={setCurrentPage}
              onLogin={handleLogin}
            />
          )}
          {currentPage === "register" && (
            <Register onNavigate={setCurrentPage} />
          )}
          {currentPage === "forgot-password" && (
            <ForgotPassword onNavigate={setCurrentPage} />
          )}
        </div>
      )}
    </UserRoleProvider>
  );
}