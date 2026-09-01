import { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Users,
  Search,
  Filter,
  MoreVertical,
  UserPlus,
  Edit,
  Trash2,
  Lock,
  Unlock,
  Mail,
  Calendar,
  Eye,
  EyeOff,
  X,
  Save,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminUserService } from '../../services/admin-user.service';
import type { AdminManagedUser, AdminManagedUserRole } from '../../types/admin-user';
import { ConfirmUserActionDialog, type PendingUserAction } from './ConfirmUserActionDialog';
import { AdminUserImportModal } from './AdminUserImportModal';

interface StoredCurrentUser {
  id: number;
  role: AdminManagedUserRole;
}

function getStoredCurrentUser(): StoredCurrentUser | null {
  try {
    const rawUser = localStorage.getItem('user');
    if (!rawUser) return null;
    const user = JSON.parse(rawUser) as StoredCurrentUser;
    return typeof user.id === 'number' ? user : null;
  } catch {
    return null;
  }
}

export function UserManagementPage() {
  const [users, setUsers] = useState<AdminManagedUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<AdminManagedUserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'locked'>('all');
  const [joinedFromDate, setJoinedFromDate] = useState('');
  const [joinedToDate, setJoinedToDate] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminManagedUser | null>(null);
  const [currentUser] = useState<StoredCurrentUser | null>(getStoredCurrentUser);
  const [pendingAction, setPendingAction] = useState<PendingUserAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  // Form states
  const [formSchoolId, setFormSchoolId] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formDateOfBirth, setFormDateOfBirth] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // The admin's own change-password form. It had no reveal control of its
  // own and relied on the browser's, which the app now hides because every
  // other password field draws its own.
  const [showOwnPassword, setShowOwnPassword] = useState(false);
  const [formRole, setFormRole] = useState<AdminManagedUserRole>('student');

  const loadUsers = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await adminUserService.list({
        search: searchQuery.trim() || undefined,
        role: roleFilter === 'all' ? undefined : roleFilter,
        locked: statusFilter === 'all' ? undefined : statusFilter === 'locked',
        joined_from: joinedFromDate || undefined,
        joined_to: joinedToDate || undefined,
      });
      setUsers(response.items);
      setTotalUsers(response.total);
    } catch (error) {
      setUsers([]);
      setTotalUsers(0);
      setLoadError(error instanceof Error ? error.message : 'Unable to load users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadUsers(); }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchQuery, roleFilter, statusFilter, joinedFromDate, joinedToDate];

  const handleAddUser = async () => {
    setIsSubmitting(true);
    try {
      await adminUserService.create({
        school_id: formSchoolId,
        full_name: formName,
        email: formEmail,
        password: formPassword,
        role: formRole,
        phone: formPhone.trim() || null,
        date_of_birth: formDateOfBirth || null,
      });
      setShowAddDialog(false);
      resetForm();
      toast.success('User added successfully');
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to add user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const isCurrentAdmin = selectedUser.id === currentUser?.id && selectedUser.role === 'admin';
      await adminUserService.update(selectedUser.id, {
        ...(isCurrentAdmin ? {} : { school_id: formSchoolId, role: formRole }),
        full_name: formName,
        email: formEmail,
        phone: formPhone.trim() || null,
      });
      setShowEditDialog(false);
      setSelectedUser(null);
      resetForm();
      toast.success('User updated successfully');
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestUserAction = (type: NonNullable<PendingUserAction>['type'], user: AdminManagedUser) => {
    if (user.id === currentUser?.id && (type === 'lock' || type === 'delete')) return;
    setActionError(null);
    setPendingAction({ type, user });
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    setIsActionSubmitting(true);
    setActionError(null);
    try {
      if (pendingAction.type === 'lock') await adminUserService.lock(pendingAction.user.id);
      if (pendingAction.type === 'unlock') await adminUserService.unlock(pendingAction.user.id);
      if (pendingAction.type === 'delete') await adminUserService.remove(pendingAction.user.id);
      toast.success(
        pendingAction.type === 'delete'
          ? 'User deleted successfully'
          : pendingAction.type === 'lock'
            ? 'User locked successfully'
            : 'User unlocked successfully',
      );
      setPendingAction(null);
      await loadUsers();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update user status.');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const closePendingAction = () => {
    if (isActionSubmitting) return;
    setPendingAction(null);
    setActionError(null);
  };

  const handleChangeOwnPassword = async () => {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
      toast.error('All password fields are required.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('Password confirmation does not match');
      return;
    }
    setIsSubmitting(true);
    try {
      await adminUserService.changeOwnPassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmNewPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      toast.success('Password changed. Please sign in again.');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('role');
      localStorage.removeItem('loginTime');
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to change password.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (user: AdminManagedUser) => {
    setSelectedUser(user);
    setFormSchoolId(user.school_id);
    setFormName(user.full_name);
    setFormEmail(user.email);
    setFormPhone(user.phone ?? '');
    setFormRole(user.role);
    setShowEditDialog(true);
  };

  const resetForm = () => {
    setFormSchoolId('');
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormPhone('');
    setFormDateOfBirth('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setShowPassword(false);
    setFormRole('student');
  };

  const getRoleBadge = (role: string) => {
    const styles = {
      student: 'bg-blue-100 text-blue-700 border-blue-300',
      teacher: 'bg-purple-100 text-purple-700 border-purple-300',
      admin: 'bg-red-100 text-red-700 border-red-300',
    };
    return styles[role as keyof typeof styles] || styles.student;
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-700 border-green-300',
      locked: 'bg-red-100 text-red-700 border-red-300',
      deleted: 'bg-gray-100 text-gray-700 border-gray-300',
    };
    return styles[status as keyof typeof styles] || styles.active;
  };

  const handleRoleChange = (value: string) => setFormRole(value as AdminManagedUserRole);

  const stats = [
    {
      label: 'Total Users',
      value: totalUsers,
      color: 'from-blue-500 to-cyan-600',
    },
    {
      label: 'Students',
      value: users.filter((u) => u.role === 'student').length,
      color: 'from-teal-500 to-blue-600',
    },
    {
      label: 'Teachers',
      value: users.filter((u) => u.role === 'teacher').length,
      color: 'from-purple-500 to-pink-600',
    },
    {
      label: 'Active',
      value: users.filter((u) => u.status === 'active').length,
      color: 'from-green-500 to-emerald-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl text-gray-900 mb-2">User Management</h1>
          <p className="text-gray-600">Manage system users, roles, and permissions</p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat) => (
            <Card key={stat.label} className="p-4 bg-white border border-gray-200 shadow-sm">
              <div className="text-2xl text-gray-900 mb-1">{stat.value}</div>
              <div className="text-sm text-gray-600">{stat.label}</div>
            </Card>
          ))}
        </div>

        {/* Actions Bar */}
        <Card className="p-4 bg-white border border-gray-200 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Role Filter */}
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="size-4 mr-2" />
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="locked">Locked</SelectItem>
              </SelectContent>
            </Select>

            {/* Joined Date Range */}
            <div className="flex items-center gap-1">
              <Calendar className="size-4 text-gray-400" />
              <input
                type="date"
                value={joinedFromDate}
                onChange={(e) => setJoinedFromDate(e.target.value)}
                className="px-2 py-2 border border-gray-200 rounded-md text-xs bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                title="From date"
              />
              <span className="text-gray-300">—</span>
              <input
                type="date"
                value={joinedToDate}
                onChange={(e) => setJoinedToDate(e.target.value)}
                className="px-2 py-2 border border-gray-200 rounded-md text-xs bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                title="To date"
              />
            </div>

            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <FileSpreadsheet className="size-4 mr-2" />
              Import Users
            </Button>

            {/* Add User Button */}
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700"
            >
              <UserPlus className="size-4 mr-2" />
              Add User
            </Button>
          </div>
        </Card>

        {/* Users Table */}
        <Card className="bg-white border border-gray-200 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-4 text-sm text-gray-700">User</th>
                  <th className="text-left p-4 text-sm text-gray-700">Role</th>
                  <th className="text-left p-4 text-sm text-gray-700">Status</th>
                  <th className="text-left p-4 text-sm text-gray-700">Activity</th>
                  <th className="text-left p-4 text-sm text-gray-700">Joined</th>
                  <th className="text-right p-4 text-sm text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div>
                        <div className="flex items-center gap-2 text-sm text-gray-900">
                          {user.full_name}
                          {user.id === currentUser?.id && (
                            <Badge className="border-teal-300 bg-teal-50 text-teal-700">You</Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                          <Mail className="size-3" />
                          {user.email}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge className={getRoleBadge(user.role)}>{user.role}</Badge>
                    </td>
                    <td className="p-4">
                      <Badge className={getStatusBadge(user.status)}>{user.status}</Badge>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-700">
                        {user.school_id}
                      </div>
                      <div className="text-xs text-gray-500">{user.is_locked ? 'Account locked' : 'Account active'}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-700 flex items-center gap-1">
                        <Calendar className="size-3 text-gray-400" />
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(user)}>
                            <Edit className="size-4 mr-2" />
                            Edit User
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={user.id === currentUser?.id}
                            title={user.id === currentUser?.id ? 'You cannot lock your own account' : undefined}
                            onClick={() => requestUserAction(user.is_locked ? 'unlock' : 'lock', user)}
                          >
                            {user.is_locked ? (
                              <>
                                <Unlock className="size-4 mr-2" />
                                Unlock
                              </>
                            ) : (
                              <>
                                <Lock className="size-4 mr-2" />
                                Lock
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={user.id === currentUser?.id}
                            title={user.id === currentUser?.id ? 'You cannot delete your own account' : undefined}
                            onClick={() => requestUserAction('delete', user)}
                            className="text-red-600"
                          >
                            <Trash2 className="size-4 mr-2" />
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {isLoading && (
              <div className="text-center py-12 text-gray-500">Loading users...</div>
            )}
            {!isLoading && loadError && (
              <div className="text-center py-12 text-red-600">
                <p>{loadError}</p>
                <Button variant="outline" className="mt-3" onClick={() => void loadUsers()}>Try Again</Button>
              </div>
            )}
            {!isLoading && !loadError && users.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Users className="size-12 mx-auto mb-3 text-gray-400" />
                <p>No users found</p>
              </div>
            )}
          </div>
        </Card>

        {/* Add User Modal */}
        {showAddDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowAddDialog(false); resetForm(); } }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
              <div className="px-6 pt-6 pb-4 flex items-start justify-between border-b border-gray-100">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Add New User</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Create a new user account in the system</p>
                </div>
                <button onClick={() => { setShowAddDialog(false); resetForm(); }} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                  <X className="size-4" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">School ID</label>
                  <input type="text" placeholder="S000001" value={formSchoolId} onChange={(e) => setFormSchoolId(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-300 placeholder:text-gray-400" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Full Name</label>
                  <input type="text" placeholder="John Doe" value={formName} onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-300 placeholder:text-gray-400" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Email Address</label>
                  <input type="email" placeholder="john.doe@university.edu" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-300 placeholder:text-gray-400" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Password</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} placeholder="Set initial password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full px-3 py-2.5 pr-10 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-300 placeholder:text-gray-400" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Phone</label>
                    <input type="tel" placeholder="Optional phone number" value={formPhone} onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-300 placeholder:text-gray-400" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Date of Birth</label>
                    <input type="date" value={formDateOfBirth} onChange={(e) => setFormDateOfBirth(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-300" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Role</label>
                    <select value={formRole} onChange={(e) => handleRoleChange(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 appearance-none cursor-pointer">
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button onClick={() => { setShowAddDialog(false); resetForm(); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={() => void handleAddUser()} disabled={isSubmitting || !formSchoolId || !formName || !formEmail || !formPassword}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-teal-600 rounded-lg hover:from-teal-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                  <UserPlus className="size-4" />Add User
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowEditDialog(false); resetForm(); } }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col">
              <div className="px-6 pt-6 pb-4 flex items-start justify-between border-b border-gray-100">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Edit User</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Update user account information</p>
                </div>
                <button onClick={() => { setShowEditDialog(false); resetForm(); }} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                  <X className="size-4" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">School ID</label>
                  <input type="text" value={formSchoolId} onChange={(e) => setFormSchoolId(e.target.value)}
                    disabled={selectedUser?.id === currentUser?.id && selectedUser?.role === 'admin'}
                    className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-300 disabled:cursor-not-allowed disabled:opacity-60" />
                  {selectedUser?.id === currentUser?.id && selectedUser?.role === 'admin' && (
                    <p className="text-xs text-gray-500">School ID cannot be changed for the current account</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Full Name</label>
                  <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-300" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Email Address</label>
                  <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-300" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Phone</label>
                  <input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="Optional phone number"
                    className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-300" />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Role</label>
                    <select value={formRole} onChange={(e) => handleRoleChange(e.target.value)}
                      disabled={selectedUser?.id === currentUser?.id && selectedUser?.role === 'admin'}
                      className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60">
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
                    {selectedUser?.id === currentUser?.id && selectedUser?.role === 'admin' && (
                      <p className="text-xs text-gray-500">You cannot change the role of your current admin account</p>
                    )}
                  </div>
                </div>
                {selectedUser?.id === currentUser?.id && selectedUser?.role === 'admin' && (
                  <div className="space-y-3 border-t border-gray-100 pt-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Change Password</h3>
                      <p className="text-xs text-gray-500">Use at least 8 characters. You will be signed out after a successful change.</p>
                    </div>
                    <div className="relative">
                      <input type={showOwnPassword ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current Password"
                        className="w-full px-3 py-2.5 pr-10 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300" />
                      <button type="button" onClick={() => setShowOwnPassword((v) => !v)}
                        aria-label={showOwnPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showOwnPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <div className="relative">
                      <input type={showOwnPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New Password"
                        className="w-full px-3 py-2.5 pr-10 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300" />
                    </div>
                    <div className="relative">
                      <input type={showOwnPassword ? 'text' : 'password'} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="Confirm New Password"
                        className="w-full px-3 py-2.5 pr-10 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300" />
                    </div>
                    <button type="button" onClick={() => void handleChangeOwnPassword()} disabled={isSubmitting}
                      className="w-full px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50">
                      Change Password
                    </button>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button onClick={() => { setShowEditDialog(false); resetForm(); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={() => void handleEditUser()} disabled={isSubmitting || !formSchoolId || !formName || !formEmail}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-teal-600 rounded-lg hover:from-teal-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                  <Save className="size-4" />Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <ConfirmUserActionDialog
        action={pendingAction}
        loading={isActionSubmitting}
        error={actionError}
        onConfirm={confirmPendingAction}
        onCancel={closePendingAction}
      />
      <AdminUserImportModal
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImported={loadUsers}
      />
    </div>
  );
}
