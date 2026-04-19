import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { GraduationCap, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { authAPI } from "../services/api";

interface LoginProps {
  onNavigate: (page: "login" | "register" | "forgot-password") => void;
  onLogin: (role?: "student" | "teacher" | "admin") => void;
}

type Role = "student" | "teacher" | "admin";

export function Login({ onNavigate, onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await authAPI.login({ email, password });

      if (!response.success) {
        setError(response.message || "Login failed");
        setIsLoading(false);
        return;
      }

      // Save token and user info to localStorage
      if (response.token) {
        localStorage.setItem("token", response.token);
      }
      if (response.user) {
        localStorage.setItem("user", JSON.stringify(response.user));
      }

      // Call callback with user role
      onLogin((response.user?.role as Role) || "student");
      setIsLoading(false);
    } catch (err) {
      console.error("Login error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to connect to server"
      );
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-xl border-teal-100">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-gradient-to-br from-teal-500 to-blue-600 rounded-xl shadow-lg">
            <GraduationCap className="size-8 text-white" />
          </div>
        </div>
        <CardTitle className="text-2xl">Sign In to OES</CardTitle>
        <CardDescription>
          Sign in to access the online examination system
        </CardDescription>
        <div className="mt-3 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
          <p className="font-medium text-gray-600 mb-1">Demo note:</p>
          <p>Use the account you registered in the system.</p>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 size-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 size-4 text-gray-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  // đang SHOW password → icon mắt mở
                  <Eye className="size-4" />
                ) : (
                  // đang HIDE password (mặc định) → icon mắt đóng
                  <EyeOff className="size-4" />
                )}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={() => onNavigate("forgot-password")}
              className="text-sm text-teal-600 hover:text-teal-800 hover:underline"
            >
              Forgot password?
            </button>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
          <div className="text-center text-sm text-gray-600">
            Don't have an account?{" "}
            <button
              type="button"
              onClick={() => onNavigate("register")}
              className="text-teal-600 hover:text-teal-800 hover:underline"
            >
              Register now
            </button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
