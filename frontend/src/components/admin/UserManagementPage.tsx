import { useState } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  status: 'active' | 'suspended' | 'inactive';
  joinDate: string;
  lastLogin: string;
  examsCompleted?: number;
  examsCreated?: number;
}

const mockUsers: User[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john.doe@university.edu',
    role: 'student',
    status: 'active',
    joinDate: '2024-01-15',
    lastLogin: '2025-11-24 10:30',
    examsCompleted: 12,
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane.smith@university.edu',
    role: 'teacher',
    status: 'active',
    joinDate: '2023-08-20',
    lastLogin: '2025-11-24 09:15',
    examsCreated: 24,
  },
  {
    id: '3',
    name: 'Michael Johnson',
    email: 'michael.j@university.edu',
    role: 'student',
    status: 'active',
    joinDate: '2024-03-10',
    lastLogin: '2025-11-23 16:45',
    examsCompleted: 8,
  },
  {
    id: '4',
    name: 'Sarah Williams',
    email: 'sarah.w@university.edu',
    role: 'admin',
    status: 'active',
    joinDate: '2023-01-05',
    lastLogin: '2025-11-24 11:20',
  },
  {
    id: '5',
    name: 'Robert Brown',
    email: 'robert.b@university.edu',
    role: 'student',
    status: 'suspended',
    joinDate: '2024-02-28',
    lastLogin: '2025-11-20 14:30',
    examsCompleted: 5,
  },
  {
    id: '6',
    name: 'Emily Davis',
    email: 'emily.d@university.edu',
    role: 'teacher',
    status: 'active',
    joinDate: '2023-09-12',
    lastLogin: '2025-11-24 08:00',
    examsCreated: 18,
  },
];

export function UserManagementPage() {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formRole, setFormRole] = useState<'student' | 'teacher' | 'admin'>('student');
  const [formStatus, setFormStatus] = useState<'active' | 'suspended' | 'inactive'>('active');

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleAddUser = () => {
    const newUser: User = {
      id: `${Date.now()}`,
      name: formName,
      email: formEmail,
      role: formRole,
      status: formStatus,
      joinDate: new Date().toISOString().split('T')[0],
      lastLogin: 'Never',
      examsCompleted: formRole === 'student' ? 0 : undefined,
      examsCreated: formRole === 'teacher' ? 0 : undefined,
    };

    setUsers([...users, newUser]);
    setShowAddDialog(false);
    resetForm();
    toast.success('User added successfully');
  };

  const handleEditUser = () => {
    if (!selectedUser) return;

    setUsers(
      users.map((user) =>
        user.id === selectedUser.id
          ? { ...user, name: formName, email: formEmail, role: formRole, status: formStatus }
          : user
      )
    );

    setShowEditDialog(false);
    setSelectedUser(null);
    resetForm();
    toast.success('User updated successfully');
  };

  const handleDeleteUser = (userId: string) => {
    setUsers(users.filter((user) => user.id !== userId));
    toast.success('User deleted successfully');
  };

  const handleToggleSuspend = (userId: string) => {
    setUsers(
      users.map((user) =>
        user.id === userId
          ? { ...user, status: user.status === 'suspended' ? 'active' : 'suspended' }
          : user
      )
    );
    toast.success('User status updated');
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormStatus(user.status);
    setShowEditDialog(true);
  };

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setShowPassword(false);
    setFormRole('student');
    setFormStatus('active');
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
      suspended: 'bg-red-100 text-red-700 border-red-300',
      inactive: 'bg-gray-100 text-gray-700 border-gray-300',
    };
    return styles[status as keyof typeof styles] || styles.inactive;
  };

  const stats = [
    {
      label: 'Total Users',
      value: users.length,
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
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

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
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div>
                        <div className="text-sm text-gray-900">{user.name}</div>
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
                        {user.examsCompleted !== undefined && `${user.examsCompleted} exams`}
                        {user.examsCreated !== undefined && `${user.examsCreated} created`}
                      </div>
                      <div className="text-xs text-gray-500">Last: {user.lastLogin}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-700 flex items-center gap-1">
                        <Calendar className="size-3 text-gray-400" />
                        {user.joinDate}
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
                          <DropdownMenuItem onClick={() => handleToggleSuspend(user.id)}>
                            {user.status === 'suspended' ? (
                              <>
                                <Unlock className="size-4 mr-2" />
                                Activate
                              </>
                            ) : (
                              <>
                                <Lock className="size-4 mr-2" />
                                Suspend
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteUser(user.id)}
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

            {filteredUsers.length === 0 && (
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Role</label>
                    <select value={formRole} onChange={(e) => setFormRole(e.target.value as any)}
                      className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 appearance-none cursor-pointer">
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as any)}
                      className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 appearance-none cursor-pointer">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button onClick={() => { setShowAddDialog(false); resetForm(); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleAddUser} disabled={!formName || !formEmail || !formPassword}
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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
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
                  <label className="text-sm font-medium text-gray-700">Full Name</label>
                  <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-300" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Email Address</label>
                  <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-300" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Role</label>
                    <select value={formRole} onChange={(e) => setFormRole(e.target.value as any)}
                      className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 appearance-none cursor-pointer">
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as any)}
                      className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 appearance-none cursor-pointer">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button onClick={() => { setShowEditDialog(false); resetForm(); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleEditUser} disabled={!formName || !formEmail}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-teal-600 rounded-lg hover:from-teal-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                  <Save className="size-4" />Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
