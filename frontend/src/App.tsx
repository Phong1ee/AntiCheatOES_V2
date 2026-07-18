import { useState, useEffect } from "react";
import { Login } from "./components/Login";
import { Register } from "./components/Register";
import { ForgotPassword } from "./components/ForgotPassword";
import { Dashboard } from "./components/Dashboard";
import { TeacherDashboard } from "./components/teacher/TeacherDashboard";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { Toaster } from "./components/ui/sonner";
import { UserRoleProvider } from "./contexts/UserRoleContext";
import { authService } from "./services/auth.service";
import { authStorage } from "./services/auth.storage";

type Page =
  | "login"
  | "register"
  | "forgot-password"
  | "dashboard"
  | "teacher-dashboard"
  | "admin-dashboard";

type UserRole = "student" | "teacher" | "admin" | null;

const SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 hours
// const SESSION_DURATION = 10 * 1000; // 10 seconds for testing

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("login");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearLocalSession = () => {
    setIsAuthenticated(false);
    setUserRole(null);
    setCurrentPage("login");

    authStorage.clearToken();
    localStorage.removeItem("role");
    localStorage.removeItem("loginTime");
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // The backend logout is stateless; local cleanup is still sufficient.
    } finally {
      clearLocalSession();
    }
  };

  // Restore session on app load
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedRole = localStorage.getItem("role");
    const loginTime = localStorage.getItem("loginTime");

    if (token && storedRole && loginTime) {
      const elapsed = Date.now() - Number(loginTime);

      if (elapsed >= SESSION_DURATION) {
        clearLocalSession();
      } else {
        setIsAuthenticated(true);
        setUserRole(storedRole as UserRole);

        switch (storedRole) {
          case "admin":
            setCurrentPage("admin-dashboard");
            break;
          case "teacher":
            setCurrentPage("teacher-dashboard");
            break;
          default:
            setCurrentPage("dashboard");
        }
      }
    }

    setIsLoading(false);
  }, []);

  // Auto logout after remaining session time
useEffect(() => {
  if (!isAuthenticated) return;

  let timeout: ReturnType<typeof setTimeout>;

  const logout = () => {
    alert("Your session has expired due to inactivity.");
    handleLogout();
  };

  const resetTimer = () => {
    clearTimeout(timeout);

    // Update the last activity time
    localStorage.setItem("loginTime", Date.now().toString());

    timeout = setTimeout(logout, SESSION_DURATION);
  };

  // User activities that reset the timer
  const events = [
    "mousemove",
    "mousedown",
    "keydown",
    "scroll",
    "touchstart",
    "click",
  ];

  events.forEach((event) =>
    window.addEventListener(event, resetTimer)
  );

  // Start timer immediately
  resetTimer();

  return () => {
    clearTimeout(timeout);

    events.forEach((event) =>
      window.removeEventListener(event, resetTimer)
    );
  };
}, [isAuthenticated]);

  useEffect(() => {
    const handleUnauthorized = () => clearLocalSession();
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  const handleLogin = (role: UserRole = "student") => {
    setIsAuthenticated(true);
    setUserRole(role);

    localStorage.setItem("role", role!);
    localStorage.setItem("loginTime", Date.now().toString());

    switch (role) {
      case "admin":
        setCurrentPage("admin-dashboard");
        break;
      case "teacher":
        setCurrentPage("teacher-dashboard");
        break;
      default:
        setCurrentPage("dashboard");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <UserRoleProvider>
      {isAuthenticated && currentPage === "dashboard" && (
        <Dashboard onLogout={handleLogout} />
      )}

      {isAuthenticated && currentPage === "teacher-dashboard" && (
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
