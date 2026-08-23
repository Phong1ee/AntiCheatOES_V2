import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import {
  GraduationCap,
  Mail,
  ArrowLeft,
  CheckCircle,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import { passwordResetService } from '../services/password-reset.service';

interface ForgotPasswordProps {
  onNavigate: (page: 'login' | 'register' | 'forgot-password') => void;
}

// Same rules as Register and Profile Settings. The server enforces them too -
// this copy only saves a round trip.
const passwordRules = [
  { key: 'minLength', label: 'Minimum 6 characters', test: (p: string) => p.length >= 6 },
  { key: 'uppercase', label: 'At least 1 uppercase letter (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'number', label: 'At least 1 number (0-9)', test: (p: string) => /[0-9]/.test(p) },
  { key: 'special', label: 'At least 1 special character (e.g. !@#$%)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 3 * 60;

type Step = 'email' | 'otp' | 'password' | 'done';

function formatCountdown(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Reads the API's error shape, which carries {message, issues} for a rejected
 *  password and a plain string everywhere else. */
function readError(error: unknown, fallback: string): { message: string; issues: string[] } {
  const detail = (error as { detail?: unknown })?.detail;
  if (detail && typeof detail === 'object') {
    const shaped = detail as { message?: string; issues?: string[] };
    return { message: shaped.message || fallback, issues: shaped.issues ?? [] };
  }
  return { message: (error as Error)?.message || fallback, issues: [] };
}

export function ForgotPassword({ onNavigate }: ForgotPasswordProps) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [issues, setIssues] = useState<string[]>([]);

  // The deadline, not a counter: a tick that the tab throttles while
  // backgrounded would otherwise drift away from when the code really dies.
  const [deadline, setDeadline] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(OTP_TTL_SECONDS);

  useEffect(() => {
    if (deadline === null) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  const expired = secondsLeft <= 0;

  const sendOtp = async () => {
    setIsLoading(true);
    setError('');
    setIssues([]);
    try {
      const message = await passwordResetService.requestOtp(email.trim());
      setNotice(message);
      setOtp('');
      setDeadline(Date.now() + OTP_TTL_SECONDS * 1000);
      setSecondsLeft(OTP_TTL_SECONDS);
      setStep('otp');
    } catch (err) {
      setError(readError(err, 'Unable to send the code. Please try again.').message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    void sendOtp();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expired) return;
    setIsLoading(true);
    setError('');
    try {
      const result = await passwordResetService.verifyOtp(email.trim(), otp);
      setResetToken(result.resetToken);
      setDeadline(null);
      setNotice('');
      setStep('password');
    } catch (err) {
      setError(readError(err, 'That code could not be verified.').message);
    } finally {
      setIsLoading(false);
    }
  };

  const passwordIssues = passwordRules.filter((rule) => !rule.test(newPassword)).map((rule) => rule.label);
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIssues([]);
    if (passwordIssues.length > 0) {
      setPasswordTouched(true);
      setError('The new password does not meet the requirements.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }
    setIsLoading(true);
    try {
      const message = await passwordResetService.resetPassword(resetToken, newPassword);
      setNotice(message);
      setStep('done');
    } catch (err) {
      const shaped = readError(err, 'The password could not be reset.');
      setError(shaped.message);
      setIssues(shaped.issues);
    } finally {
      setIsLoading(false);
    }
  };

  const header = (title: string, description: string, icon: React.ReactNode) => (
    <CardHeader className="space-y-1 text-center">
      <div className="flex justify-center mb-4">
        <div className="p-3 bg-gradient-to-br from-teal-500 to-blue-600 rounded-xl shadow-lg">{icon}</div>
      </div>
      <CardTitle className="text-2xl">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
  );

  const errorBanner = error && (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <AlertCircle className="size-4 mt-0.5 flex-shrink-0" />
      <div>
        <p>{error}</p>
        {issues.length > 0 && (
          <ul className="mt-1 list-disc pl-4">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const backToSignIn = (
    <Button type="button" variant="ghost" className="w-full" onClick={() => onNavigate('login')}>
      <ArrowLeft className="size-4 mr-2" />
      Back to Sign In
    </Button>
  );

  // ── Step 4: done ───────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <Card className="w-full max-w-md shadow-xl border-teal-100">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="size-8 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Password Reset</CardTitle>
          <CardDescription>{notice}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            className="w-full bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
            onClick={() => onNavigate('login')}
          >
            Go to Sign In
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // ── Step 3: new password ───────────────────────────────────────────────
  if (step === 'password') {
    return (
      <Card className="w-full max-w-md shadow-xl border-teal-100">
        {header('Set a New Password', 'Choose a password you have not used before', <Lock className="size-8 text-white" />)}
        <form onSubmit={handleResetPassword}>
          <CardContent className="space-y-4">
            {errorBanner}
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onBlur={() => setPasswordTouched(true)}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {(passwordTouched || newPassword.length > 0) && passwordIssues.length > 0 && (
              <ul className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
                {passwordIssues.map((issue) => (
                  <li key={issue}>• {issue}</li>
                ))}
              </ul>
            )}

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((visible) => !visible)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {mismatch && <p className="text-xs text-red-600">The two passwords do not match.</p>}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3 pt-6">
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
              disabled={isLoading || passwordIssues.length > 0 || mismatch || confirmPassword.length === 0}
            >
              {isLoading ? 'Saving...' : 'Reset Password'}
            </Button>
            {backToSignIn}
          </CardFooter>
        </form>
      </Card>
    );
  }

  // ── Step 2: the code ───────────────────────────────────────────────────
  if (step === 'otp') {
    return (
      <Card className="w-full max-w-md shadow-xl border-teal-100">
        {header('Enter Verification Code', `We sent a ${OTP_LENGTH}-digit code to ${email}`, <ShieldCheck className="size-8 text-white" />)}
        <form onSubmit={handleVerifyOtp}>
          <CardContent className="space-y-4">
            {notice && !error && (
              <p className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">{notice}</p>
            )}
            {errorBanner}

            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                autoFocus
                value={otp}
                // Digits only, so a pasted code with spaces or a stray letter
                // does not silently become a wrong attempt.
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                disabled={expired}
                className="text-center text-2xl tracking-[0.5em] font-mono"
              />
            </div>

            <div className="text-center text-sm">
              {expired ? (
                <span className="text-red-600">This code has expired.</span>
              ) : (
                <span className="text-gray-600">
                  Expires in <span className="font-mono font-medium text-gray-900">{formatCountdown(secondsLeft)}</span>
                </span>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3 pt-6">
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
              disabled={isLoading || expired || otp.length !== OTP_LENGTH}
            >
              {isLoading ? 'Verifying...' : 'Verify Code'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              // Only once the current code is dead: a resend before then would
              // invalidate a code the user may still be typing.
              disabled={isLoading || !expired}
              onClick={() => void sendOtp()}
            >
              {expired ? 'Resend Code' : `Resend available at 0:00`}
            </Button>
            {backToSignIn}
          </CardFooter>
        </form>
      </Card>
    );
  }

  // ── Step 1: the address ────────────────────────────────────────────────
  return (
    <Card className="w-full max-w-md shadow-xl border-teal-100">
      {header('Forgot Password?', "Enter your email and we'll send you a verification code", <GraduationCap className="size-8 text-white" />)}
      <form onSubmit={handleSendOtp}>
        <CardContent className="space-y-4">
          {errorBanner}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 size-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 text-sm text-cyan-800">
            <p>The code will be sent to the email address registered with your account and is valid for 3 minutes.</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3 pt-6">
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
            disabled={isLoading}
          >
            {isLoading ? 'Sending...' : 'Send Code'}
          </Button>
          {backToSignIn}
        </CardFooter>
      </form>
    </Card>
  );
}
