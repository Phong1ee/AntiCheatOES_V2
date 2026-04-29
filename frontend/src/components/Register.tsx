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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { GraduationCap, Mail, Lock, User, Eye, EyeOff } from "lucide-react";

interface RegisterProps {
  onNavigate: (page: "login" | "register" | "forgot-password") => void;
}

type Role = "student" | "teacher" | "admin";

interface RegisterResponse {
  message: string;
  token: string;
  user: {
    id: number;
    full_name: string;
    email: string;
    role: Role;
  };
}

const API_BASE_URL = "http://localhost:8000"; // backend Node.js

// ===== Password rules =====
const passwordRules = [
  {
    key: "minLength",
    label: "Minimum 6 characters",
    test: (p: string) => p.length >= 6,
  },
  {
    key: "uppercase",
    label: "At least 1 uppercase letter (A-Z)",
    test: (p: string) => /[A-Z]/.test(p),
  },
  {
    key: "number",
    label: "At least 1 number (0-9)",
    test: (p: string) => /[0-9]/.test(p),
  },
  {
    key: "special",
    label: "At least 1 special character (e.g. !@#$%)",
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
  },
];

function getPasswordIssues(pw: string) {
  return passwordRules.filter((r) => !r.test(pw)).map((r) => r.label);
}

export function Register({ onNavigate }: RegisterProps) {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "student" as Role,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordTouched, setPasswordTouched] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const passwordIssues = getPasswordIssues(formData.password);
  const showPasswordIssues = passwordTouched || formData.password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1) Validate password policy (client-side)
    const issues = getPasswordIssues(formData.password);
    if (issues.length > 0) {
      setPasswordTouched(true);
      setError("Password does not meet the requirements.");
      return;
    }

    // 2) Validate confirm password
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullname: formData.fullName,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        }),
      });

      const data: RegisterResponse | { message?: string; detail?: string } = await res.json();

      if (!res.ok) {
        setError((data as any).detail || "Can't register");
        setIsLoading(false);
        return;
      }

      console.log(data.message);
      onNavigate("login");
      setIsLoading(false);
    } catch (err) {
      console.error(err);
      setError("Can't connect to server");
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
        <CardTitle className="text-2xl">Create OES Account</CardTitle>
        <CardDescription>
          Sign up to use the online examination system
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* FULL NAME */}
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-3 size-4 text-gray-400" />
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={formData.fullName}
                onChange={(e) => handleChange("fullName", e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          {/* EMAIL */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 size-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          {/* ROLE */}
          <div className="space-y-2">
            <Label htmlFor="role">Select Role</Label>
            <Select value={formData.role} onValueChange={(value) => handleChange("role", value)}>
              <SelectTrigger id="role" className="w-full">
                <SelectValue placeholder="Choose your role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* PASSWORD */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 size-4 text-gray-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min 6 chars, 1 uppercase, 1 number, 1 special"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                onBlur={() => setPasswordTouched(true)}
                className="pl-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <Eye className="size-4" />
                ) : (
                  <EyeOff className="size-4" />
                )}
              </button>
            </div>

            {/* Password policy under input */}
            {showPasswordIssues && (
              <div className="space-y-1">
                {passwordRules.map((r) => {
                  const ok = r.test(formData.password);
                  return (
                    <p
                      key={r.key}
                      className={`text-xs flex items-center gap-2 ${
                        ok ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      <span>{ok ? "✅" : "❌"}</span>
                      <span>{r.label}</span>
                    </p>
                  );
                })}
              </div>
            )}
          </div>

          {/* CONFIRM PASSWORD */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 size-4 text-gray-400" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={(e) =>
                  handleChange("confirmPassword", e.target.value)
                }
                className="pl-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? (
                  <Eye className="size-4" />
                ) : (
                  <EyeOff className="size-4" />
                )}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </CardContent>

        <CardFooter className="flex flex-col space-y-4 pt-6">
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
            disabled={isLoading}
          >
            {isLoading ? "Creating account..." : "Create Account"}
          </Button>

          <div className="text-center text-sm text-gray-600">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => onNavigate("login")}
              className="text-teal-600 hover:text-teal-800 hover:underline"
            >
              Sign in
            </button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
