import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { GraduationCap, Mail, ArrowLeft, CheckCircle } from 'lucide-react';

interface ForgotPasswordProps {
  onNavigate: (page: 'login' | 'register' | 'forgot-password') => void;
}

export function ForgotPassword({ onNavigate }: ForgotPasswordProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate sending reset email
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
    }, 1500);
  };

  if (isSubmitted) {
    return (
      <Card className="w-full max-w-md shadow-xl border-teal-100">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="size-8 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Check Your Email</CardTitle>
          <CardDescription>
            We've sent password reset instructions to your email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-sm text-teal-800">
            <p className="mb-2">Email sent to: <span className="font-medium">{email}</span></p>
            <p>Please check your inbox (or spam folder) and follow the instructions to reset your password.</p>
          </div>
          <div className="text-center text-sm text-gray-600">
            Didn't receive the email?{' '}
            <button
              type="button"
              onClick={() => {
                setIsSubmitted(false);
                setEmail('');
              }}
              className="text-teal-600 hover:text-teal-800 hover:underline"
            >
              Resend
            </button>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onNavigate('login')}
          >
            <ArrowLeft className="size-4 mr-2" />
            Back to Sign In
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-xl border-teal-100">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-gradient-to-br from-teal-500 to-blue-600 rounded-xl shadow-lg">
            <GraduationCap className="size-8 text-white" />
          </div>
        </div>
        <CardTitle className="text-2xl">Forgot Password?</CardTitle>
        <CardDescription>
          Enter your email and we'll send you instructions to reset your password
        </CardDescription>
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
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 text-sm text-cyan-800 mb-2">
            <p>Note: The recovery email will be sent to the email address registered with your account.</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3">
          <Button type="submit" className="w-full bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700" disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send Recovery Email'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => onNavigate('login')}
          >
            <ArrowLeft className="size-4 mr-2" />
            Back to Sign In
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}