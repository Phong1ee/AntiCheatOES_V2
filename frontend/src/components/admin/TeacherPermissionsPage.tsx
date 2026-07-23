import { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import {
  Shield,
  Search,
  Edit,
  BookOpen,
  UserCog,
  Plus,
  Trash2,
  Eye,
  X,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';

interface TeacherPermission {
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  subjects: string[];
  lastUpdated: string;
}

const ALL_SUBJECTS = [
  { id: 's1', name: 'Database Systems', color: 'teal' },
  { id: 's2', name: 'Data Structures', color: 'blue' },
  { id: 's3', name: 'Algorithms', color: 'indigo' },
  { id: 's4', name: 'Web Development', color: 'purple' },
  { id: 's5', name: 'Operating Systems', color: 'orange' },
  { id: 's6', name: 'Network Security', color: 'red' },
  { id: 's7', name: 'Cloud Computing', color: 'sky' },
  { id: 's8', name: 'Mobile Development', color: 'green' },
  { id: 's9', name: 'Software Engineering', color: 'yellow' },
  { id: 's10', name: 'Marketing', color: 'pink' },
  { id: 's11', name: 'Finance', color: 'emerald' },
  { id: 's12', name: 'Calculus', color: 'violet' },
  { id: 's13', name: 'Linear Algebra', color: 'cyan' },
  { id: 's14', name: 'Statistics', color: 'rose' },
];

const mockTeachers = [
  { id: 'T001', name: 'Dr. John Smith', email: 'john.smith@university.edu' },
  { id: 'T002', name: 'Prof. Emily Johnson', email: 'emily.j@university.edu' },
  { id: 'T003', name: 'Dr. Michael Williams', email: 'michael.w@university.edu' },
  { id: 'T004', name: 'Prof. Sarah Davis', email: 'sarah.d@university.edu' },
  { id: 'T005', name: 'Dr. Robert Brown', email: 'robert.b@university.edu' },
];

const mockPermissions: TeacherPermission[] = [
  {
    teacherId: 'T001',
    teacherName: 'Dr. John Smith',
    teacherEmail: 'john.smith@university.edu',
    subjects: ['Database Systems', 'Data Structures', 'Algorithms'],
    lastUpdated: '2025-11-20',
  },
  {
    teacherId: 'T002',
    teacherName: 'Prof. Emily Johnson',
    teacherEmail: 'emily.j@university.edu',
    subjects: ['Web Development', 'Operating Systems', 'Mobile Development', 'Software Engineering'],
    lastUpdated: '2025-11-18',
  },
  {
    teacherId: 'T004',
    teacherName: 'Prof. Sarah Davis',
    teacherEmail: 'sarah.d@university.edu',
    subjects: ['Marketing', 'Finance'],
    lastUpdated: '2025-11-15',
  },
];

export function TeacherPermissionsPage() {
  const [permissions, setPermissions] = useState<TeacherPermission[]>(mockPermissions);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<TeacherPermission | null>(null);

  // Form states
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [subjectSearch, setSubjectSearch] = useState('');

  const availableTeachers = mockTeachers.filter(
    (t) => !permissions.find((p) => p.teacherId === t.id)
  );

  const filteredPermissions = permissions.filter(
    (p) =>
      p.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.teacherEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSubjects = ALL_SUBJECTS.filter((s) =>
    s.name.toLowerCase().includes(subjectSearch.toLowerCase())
  );

  const resetForm = () => {
    setSelectedTeacherId('');
    setSelectedSubjects([]);
    setSubjectSearch('');
  };

  const toggleSubject = (name: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
  };

  const handleGrant = () => {
    if (!selectedTeacherId) {
      toast.error('Please select a teacher');
      return;
    }
    if (selectedSubjects.length === 0) {
      toast.error('Please select at least one subject');
      return;
    }
    const teacher = mockTeachers.find((t) => t.id === selectedTeacherId);
    if (!teacher) return;
    setPermissions([
      ...permissions,
      {
        teacherId: teacher.id,
        teacherName: teacher.name,
        teacherEmail: teacher.email,
        subjects: selectedSubjects,
        lastUpdated: new Date().toISOString().split('T')[0],
      },
    ]);
    setShowGrantModal(false);
    resetForm();
    toast.success(`Access granted to ${teacher.name}`);
  };

  const handleUpdate = () => {
    if (!selectedPermission) return;
    if (selectedSubjects.length === 0) {
      toast.error('Please select at least one subject');
      return;
    }
    setPermissions(
      permissions.map((p) =>
        p.teacherId === selectedPermission.teacherId
          ? { ...p, subjects: selectedSubjects, lastUpdated: new Date().toISOString().split('T')[0] }
          : p
      )
    );
    setShowEditModal(false);
    setSelectedPermission(null);
    resetForm();
    toast.success('Access updated successfully');
  };

  const openEdit = (permission: TeacherPermission) => {
    setSelectedPermission(permission);
    setSelectedSubjects(permission.subjects);
    setSubjectSearch('');
    setShowEditModal(true);
  };

  const handleDelete = (teacherId: string) => {
    setPermissions(permissions.filter((p) => p.teacherId !== teacherId));
    toast.success('Access removed');
  };

  const SubjectPicker = () => (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
        <input
          type="text"
          placeholder="Search subjects..."
          value={subjectSearch}
          onChange={(e) => setSubjectSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
        />
      </div>
      <div className="border border-gray-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto bg-white">
        {filteredSubjects.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No subjects found</p>
        ) : (
          filteredSubjects.map((subject) => (
            <label
              key={subject.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
            >
              <Checkbox
                checked={selectedSubjects.includes(subject.name)}
                onCheckedChange={() => toggleSubject(subject.name)}
              />
              <BookOpen className="size-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-700">{subject.name}</span>
            </label>
          ))
        )}
      </div>
      {selectedSubjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selectedSubjects.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200 rounded-full"
            >
              {s}
              <button onClick={() => toggleSubject(s)} className="hover:text-teal-900 ml-0.5">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl text-gray-900 mb-1">Teacher Question Bank Access</h1>
          <p className="text-sm text-gray-500">Grant teachers view-only access to question banks by subject</p>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6">
          <Eye className="size-4.5 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-700">
            <span className="font-medium text-blue-900">View-Only Access — </span>
            Teachers can reference questions from assigned subjects when creating exams. They cannot add, edit, or delete questions in the question bank.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Teachers with Access', value: permissions.length },
            { label: 'Total Subjects', value: ALL_SUBJECTS.length },
            { label: 'Available Teachers', value: availableTeachers.length },
          ].map((stat) => (
            <Card key={stat.label} className="p-4 bg-white border border-gray-200 shadow-sm text-center">
              <div className="text-2xl font-semibold text-gray-900 mb-0.5">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </Card>
          ))}
        </div>

        {/* Search & Add */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              placeholder="Search teachers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            onClick={() => { resetForm(); setShowGrantModal(true); }}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
          >
            <Plus className="size-4" />
            Grant Access
          </Button>
        </div>

        {/* Permissions List */}
        <div className="space-y-3">
          {filteredPermissions.map((permission) => (
            <Card key={permission.teacherId} className="p-5 bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2.5 bg-teal-50 rounded-xl flex-shrink-0">
                    <UserCog className="size-5 text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-semibold text-gray-900">{permission.teacherName}</h3>
                      <Badge className="bg-green-50 text-green-700 border border-green-200 text-xs">
                        <Eye className="size-3 mr-1" />View Access
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{permission.teacherEmail}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {permission.subjects.map((subject) => (
                        <span key={subject} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-md border border-gray-200">
                          <BookOpen className="size-3 text-gray-400" />
                          {subject}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Updated {permission.lastUpdated}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button onClick={() => openEdit(permission)} variant="outline" size="sm" className="gap-1.5 text-xs">
                    <Edit className="size-3.5" />Edit
                  </Button>
                  <Button onClick={() => handleDelete(permission.teacherId)} variant="outline" size="sm"
                    className="gap-1.5 text-xs text-red-600 hover:text-red-700 hover:border-red-300">
                    <Trash2 className="size-3.5" />Remove
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {filteredPermissions.length === 0 && (
            <Card className="p-12 text-center bg-white border border-gray-200">
              <Shield className="size-10 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 text-sm">No access permissions assigned yet</p>
              <p className="text-xs text-gray-400 mt-1">Click "Grant Access" to allow teachers to view question banks</p>
            </Card>
          )}
        </div>

        {/* Grant Access Modal */}
        {showGrantModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowGrantModal(false); resetForm(); } }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
              <div className="px-6 pt-6 pb-4 flex items-start justify-between border-b border-gray-100 flex-shrink-0">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Grant Question Bank Access</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Select which subjects a teacher can view</p>
                </div>
                <button onClick={() => { setShowGrantModal(false); resetForm(); }} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                  <X className="size-4" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
                {/* Select Teacher */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Select Teacher</label>
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 appearance-none cursor-pointer"
                  >
                    <option value="">Choose a teacher...</option>
                    {availableTeachers.length > 0
                      ? availableTeachers.map((t) => (
                          <option key={t.id} value={t.id}>{t.name} — {t.email}</option>
                        ))
                      : <option disabled>All teachers already have access</option>
                    }
                  </select>
                </div>

                {/* Subject Access */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Subject Access
                    {selectedSubjects.length > 0 && (
                      <span className="ml-2 text-xs text-teal-600 font-normal">{selectedSubjects.length} selected</span>
                    )}
                  </label>
                  <SubjectPicker />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0">
                <button onClick={() => { setShowGrantModal(false); resetForm(); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleGrant} disabled={!selectedTeacherId || selectedSubjects.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <Eye className="size-4" />Grant Access
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Access Modal */}
        {showEditModal && selectedPermission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowEditModal(false); resetForm(); } }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
              <div className="px-6 pt-6 pb-4 flex items-start justify-between border-b border-gray-100 flex-shrink-0">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Edit Question Bank Access</h2>
                  <p className="text-sm text-gray-400 mt-0.5">{selectedPermission.teacherName}</p>
                </div>
                <button onClick={() => { setShowEditModal(false); resetForm(); }} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                  <X className="size-4" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Subject Access
                    {selectedSubjects.length > 0 && (
                      <span className="ml-2 text-xs text-teal-600 font-normal">{selectedSubjects.length} selected</span>
                    )}
                  </label>
                  <SubjectPicker />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0">
                <button onClick={() => { setShowEditModal(false); resetForm(); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleUpdate} disabled={selectedSubjects.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
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
