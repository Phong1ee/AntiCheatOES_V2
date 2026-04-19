import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { User, Mail, Phone, Calendar, Camera, Save, Lock, Eye, EyeOff } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000';

interface ProfileData {
  fullName: string;
  email: string;
  phone: string;
  studentId: string;
  dateOfBirth: string; // yyyy-mm-dd
}

// ===== Password rules (same as Register) =====
const passwordRules = [
  { key: 'minLength', label: 'Minimum 6 characters', test: (p: string) => p.length >= 6 },
  { key: 'uppercase', label: 'At least 1 uppercase letter (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'number', label: 'At least 1 number (0-9)', test: (p: string) => /[0-9]/.test(p) },
  { key: 'special', label: 'At least 1 special character (e.g. !@#$%)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function getPasswordIssues(pw: string) {
  return passwordRules.filter((r) => !r.test(pw)).map((r) => r.label);
}

export function ProfileSettings() {
  const [profile, setProfile] = useState<ProfileData>({
    fullName: '',
    email: '',
    phone: '',
    studentId: '',
    dateOfBirth: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // 👇 3 state bật/tắt hiện mật khẩu
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [changingPassword, setChangingPassword] = useState(false);

  // 👇 state hiển thị message cho phần đổi password
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // 👇 state hiển thị message cho phần personal info
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // 👇 touched để show rules giống register
  const [newPasswordTouched, setNewPasswordTouched] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  // ==== Load profile từ API ====
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setProfileError(null);
        setProfileSuccess(null);

        const res = await fetch(`${API_BASE_URL}/api/profile/me`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error((data as any).message || 'Failed to load profile');
        }

        setProfile({
          fullName: data.fullName || '',
          email: data.email || '',
          phone: data.phone || '',
          studentId: data.studentId || '',
          dateOfBirth: data.dateOfBirth || '',
        });
      } catch (err: any) {
        console.error(err);
        setProfileError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchProfile();
    else setLoading(false);
  }, [token]);

  const handleProfileChange = (field: keyof ProfileData, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      setProfileError(null);
      setProfileSuccess(null);

      const res = await fetch(`${API_BASE_URL}/api/profile/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          fullName: profile.fullName,
          phone: profile.phone,
          dateOfBirth: profile.dateOfBirth || null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error((data as any).message || 'Failed to update profile');
      }

      setProfileSuccess('Personal information updated successfully.');
    } catch (err: any) {
      console.error(err);
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = () => {
    alert('Avatar upload feature coming soon!');
  };

  // ==== Đổi password ====
  const handlePasswordChange = (field: keyof typeof passwordForm, value: string) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
  };

  const newPasswordIssues = getPasswordIssues(passwordForm.newPassword);
  const showNewPasswordIssues = newPasswordTouched || passwordForm.newPassword.length > 0;

  const handleSubmitChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    // 1. Check đủ 3 field
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Please fill in all fields: Current, New, and Confirm password');
      return;
    }

    // 2. Validate new password policy (same as Register)
    const issues = getPasswordIssues(passwordForm.newPassword);
    if (issues.length > 0) {
      setNewPasswordTouched(true);
      setPasswordError('New password does not meet the requirements.');
      return;
    }

    // 3. Check new === confirm
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Password confirmation does not match password!');
      return;
    }

    try {
      setChangingPassword(true);

      const res = await fetch(`${API_BASE_URL}/api/profile/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // nếu backend trả issues => bật rules lên cho user thấy
        if ((data as any).issues?.length) setNewPasswordTouched(true);
        throw new Error((data as any).message || 'Password change failed.');
      }

      setPasswordSuccess('Password changed successfully.');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setNewPasswordTouched(false);
    } catch (err: any) {
      console.error(err);
      setPasswordError(err.message || 'Password change failed.');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <p className="text-gray-600">Loading profile...</p>
      </div>
    );
  }

  const initials =
    profile.fullName
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2) || 'U';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl text-gray-800">Profile Settings</h1>
        <p className="text-gray-600 mt-1">Manage your personal information and account details</p>
      </div>

      <Card className="shadow-lg rounded-2xl border-0">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative">
              <Avatar className="size-24">
                <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Student" />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <button
                onClick={handleAvatarChange}
                className="absolute bottom-0 right-0 p-2 bg-gradient-to-r from-teal-500 to-blue-600 rounded-full text-white hover:from-teal-600 hover:to-blue-700 shadow-lg transition-all"
              >
                <Camera className="size-4" />
              </button>
            </div>
            <div className="text-center sm:text-left">
              <h2 className="text-xl text-gray-800">{profile.fullName || 'Student'}</h2>
              <p className="text-gray-600">{profile.email}</p>
              {profile.studentId && (
                <p className="text-sm text-gray-500 mt-1">Student ID: {profile.studentId}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <User className="size-5 text-teal-600" />
            Personal Information
          </CardTitle>
          <CardDescription>Update your personal details and contact information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" value={profile.fullName} onChange={(e) => handleProfileChange('fullName', e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="size-4 text-teal-600" />
              Email Address
            </Label>
            <Input id="email" type="email" value={profile.email} disabled className="bg-gray-50" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="size-4 text-teal-600" />
              Phone Number
            </Label>
            <Input id="phone" type="tel" value={profile.phone} onChange={(e) => handleProfileChange('phone', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="studentId">Student ID</Label>
              <Input id="studentId" value={profile.studentId} disabled className="bg-gray-50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth" className="flex items-center gap-2">
                <Calendar className="size-4 text-teal-600" />
                Date of Birth
              </Label>
              <Input id="dateOfBirth" type="date" value={profile.dateOfBirth} onChange={(e) => handleProfileChange('dateOfBirth', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Lock className="size-5 text-teal-600" />
            Security
          </CardTitle>
          <CardDescription>Change your account password</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Current password */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordForm.currentPassword}
                  onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((v) => !v)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showCurrentPassword ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                  onBlur={() => setNewPasswordTouched(true)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </button>
              </div>

              {/* Rules giống Register */}
              {showNewPasswordIssues && (
                <div className="space-y-1">
                  {passwordRules.map((r) => {
                    const ok = r.test(passwordForm.newPassword);
                    return (
                      <p
                        key={r.key}
                        className={`text-xs flex items-center gap-2 ${ok ? 'text-green-600' : 'text-red-500'}`}
                      >
                        <span>{ok ? '✅' : '❌'}</span>
                        <span>{r.label}</span>
                      </p>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Confirm new password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </button>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSubmitChangePassword}
            disabled={changingPassword}
            className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
          >
            {changingPassword ? 'Changing Password...' : 'Change Password'}
          </Button>

          {passwordError && <p className="mt-2 text-sm text-red-500">{passwordError}</p>}
          {passwordSuccess && <p className="mt-2 text-sm text-emerald-600">{passwordSuccess}</p>}
        </CardContent>
      </Card>

      <div className="flex flex-col items-end gap-2">
        <div className="flex justify-end gap-3 w-full">
          <Button variant="outline">Cancel</Button>
          <Button
            onClick={handleSaveProfile}
            disabled={saving}
            className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
          >
            <Save className="size-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {profileError && <p className="text-sm text-red-500 text-right">{profileError}</p>}
        {profileSuccess && <p className="text-sm text-emerald-600 text-right">{profileSuccess}</p>}
      </div>
    </div>
  );
}
