import { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Shield,
  Search,
  Edit,
  GraduationCap,
  BookOpen,
  UserCog,
  Plus,
  Trash2,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';

interface TeacherPermission {
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  departments: {
    name: string;
    subjects: string[];
  }[];
  lastUpdated: string;
}

interface Department {
  id: string;
  name: string;
  subjects: string[];
}

const mockDepartments: Department[] = [
  {
    id: '1',
    name: 'Computer Science',
    subjects: [
      'Database Systems',
      'Data Structures',
      'Algorithms',
      'Web Development',
      'Operating Systems',
    ],
  },
  {
    id: '2',
    name: 'Information Technology',
    subjects: [
      'Network Security',
      'Cloud Computing',
      'Mobile Development',
      'Software Engineering',
    ],
  },
  {
    id: '3',
    name: 'Business Administration',
    subjects: ['Marketing', 'Finance', 'Management', 'Economics'],
  },
  {
    id: '4',
    name: 'Mathematics',
    subjects: ['Calculus', 'Linear Algebra', 'Statistics', 'Discrete Math'],
  },
];

const mockTeachers = [
  {
    id: 'T001',
    name: 'Dr. John Smith',
    email: 'john.smith@university.edu',
  },
  {
    id: 'T002',
    name: 'Prof. Emily Johnson',
    email: 'emily.j@university.edu',
  },
  {
    id: 'T003',
    name: 'Dr. Michael Williams',
    email: 'michael.w@university.edu',
  },
  {
    id: 'T004',
    name: 'Prof. Sarah Davis',
    email: 'sarah.d@university.edu',
  },
  {
    id: 'T005',
    name: 'Dr. Robert Brown',
    email: 'robert.b@university.edu',
  },
];

const mockPermissions: TeacherPermission[] = [
  {
    teacherId: 'T001',
    teacherName: 'Dr. John Smith',
    teacherEmail: 'john.smith@university.edu',
    departments: [
      {
        name: 'Computer Science',
        subjects: ['Database Systems', 'Data Structures', 'Algorithms'],
      },
    ],
    lastUpdated: '2025-11-20',
  },
  {
    teacherId: 'T002',
    teacherName: 'Prof. Emily Johnson',
    teacherEmail: 'emily.j@university.edu',
    departments: [
      {
        name: 'Computer Science',
        subjects: ['Web Development', 'Operating Systems'],
      },
      {
        name: 'Information Technology',
        subjects: ['Mobile Development', 'Software Engineering'],
      },
    ],
    lastUpdated: '2025-11-18',
  },
  {
    teacherId: 'T004',
    teacherName: 'Prof. Sarah Davis',
    teacherEmail: 'sarah.d@university.edu',
    departments: [
      {
        name: 'Business Administration',
        subjects: ['Marketing', 'Finance', 'Management'],
      },
    ],
    lastUpdated: '2025-11-15',
  },
];

export function TeacherPermissionsPage() {
  const [permissions, setPermissions] = useState<TeacherPermission[]>(mockPermissions);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<TeacherPermission | null>(null);

  // Form states
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedDepartments, setSelectedDepartments] = useState<
    { name: string; subjects: string[] }[]
  >([]);
  const [tempDepartment, setTempDepartment] = useState('');
  const [tempSubjects, setTempSubjects] = useState<string[]>([]);

  const availableTeachers = mockTeachers.filter(
    (teacher) => !permissions.find((p) => p.teacherId === teacher.id)
  );

  const filteredPermissions = permissions.filter(
    (p) =>
      p.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.teacherEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate total subjects count
  const totalSubjectsCount = permissions.reduce(
    (acc, p) => acc + p.departments.reduce((sum, d) => sum + d.subjects.length, 0),
    0
  );

  const resetForm = () => {
    setSelectedTeacher('');
    setSelectedDepartments([]);
    setTempDepartment('');
    setTempSubjects([]);
  };

  const handleAddDepartment = () => {
    if (!tempDepartment || tempSubjects.length === 0) {
      toast.error('Please select a department and at least one subject');
      return;
    }

    if (selectedDepartments.find((d) => d.name === tempDepartment)) {
      toast.error('This department is already added');
      return;
    }

    setSelectedDepartments([
      ...selectedDepartments,
      { name: tempDepartment, subjects: tempSubjects },
    ]);
    setTempDepartment('');
    setTempSubjects([]);
    toast.success('Department added');
  };

  const handleRemoveDepartment = (deptName: string) => {
    setSelectedDepartments(selectedDepartments.filter((d) => d.name !== deptName));
  };

  const handleAssignPermission = () => {
    if (!selectedTeacher) {
      toast.error('Please select a teacher');
      return;
    }

    if (selectedDepartments.length === 0) {
      toast.error('Please add at least one department');
      return;
    }

    const teacher = mockTeachers.find((t) => t.id === selectedTeacher);
    if (!teacher) return;

    const newPermission: TeacherPermission = {
      teacherId: teacher.id,
      teacherName: teacher.name,
      teacherEmail: teacher.email,
      departments: selectedDepartments,
      lastUpdated: new Date().toISOString().split('T')[0],
    };

    setPermissions([...permissions, newPermission]);
    setShowAssignDialog(false);
    resetForm();
    toast.success('Question bank access granted successfully');
  };

  const handleUpdatePermission = () => {
    if (!selectedPermission) return;

    if (selectedDepartments.length === 0) {
      toast.error('Please add at least one department');
      return;
    }

    setPermissions(
      permissions.map((p) =>
        p.teacherId === selectedPermission.teacherId
          ? {
              ...p,
              departments: selectedDepartments,
              lastUpdated: new Date().toISOString().split('T')[0],
            }
          : p
      )
    );

    setShowEditDialog(false);
    setSelectedPermission(null);
    resetForm();
    toast.success('Access permissions updated successfully');
  };

  const handleDeletePermission = (teacherId: string) => {
    setPermissions(permissions.filter((p) => p.teacherId !== teacherId));
    toast.success('Access removed successfully');
  };

  const openEditDialog = (permission: TeacherPermission) => {
    setSelectedPermission(permission);
    setSelectedDepartments(permission.departments);
    setShowEditDialog(true);
  };

  const handleSubjectToggle = (subject: string) => {
    if (tempSubjects.includes(subject)) {
      setTempSubjects(tempSubjects.filter((s) => s !== subject));
    } else {
      setTempSubjects([...tempSubjects, subject]);
    }
  };

  const currentDepartment = mockDepartments.find((d) => d.name === tempDepartment);

  const stats = [
    {
      label: 'Teachers with Access',
      value: permissions.length,
      color: 'from-blue-500 to-cyan-600',
    },
    {
      label: 'Total Departments',
      value: mockDepartments.length,
      color: 'from-purple-500 to-pink-600',
    },
    {
      label: 'Subjects Assigned',
      value: totalSubjectsCount,
      color: 'from-green-500 to-emerald-600',
    },
    {
      label: 'Available Teachers',
      value: availableTeachers.length,
      color: 'from-amber-500 to-orange-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl text-gray-900 mb-2">Teacher Question Bank Access</h1>
          <p className="text-gray-600">
            Grant teachers view access to question banks by department and subject
          </p>
        </div>

        {/* Info Banner */}
        <Card className="p-4 bg-blue-50 border border-blue-200 mb-6">
          <div className="flex items-start gap-3">
            <Eye className="size-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-blue-900 font-medium mb-1">View-Only Access</p>
              <p className="text-sm text-blue-700">
                Teachers can view and reference questions from assigned subjects when creating
                exams. They cannot add, edit, or delete questions in the question bank.
              </p>
            </div>
          </div>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat) => (
            <Card key={stat.label} className="p-4 bg-white border border-gray-200 shadow-sm">
              <div className="text-2xl text-gray-900 mb-1">{stat.value}</div>
              <div className="text-sm text-gray-600">{stat.label}</div>
            </Card>
          ))}
        </div>

        {/* Search & Add Bar */}
        <Card className="p-4 bg-white border border-gray-200 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
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
              onClick={() => setShowAssignDialog(true)}
              className="bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700"
            >
              <Plus className="size-4 mr-2" />
              Grant Access
            </Button>
          </div>
        </Card>

        {/* Permissions List */}
        <div className="space-y-4">
          {filteredPermissions.map((permission) => (
            <Card
              key={permission.teacherId}
              className="p-6 bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  {/* Teacher Avatar */}
                  <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg shadow-md flex-shrink-0">
                    <UserCog className="size-6 text-white" />
                  </div>

                  {/* Teacher Info */}
                  <div className="flex-1">
                    <div className="mb-3">
                      <h3 className="text-lg text-gray-900">{permission.teacherName}</h3>
                      <p className="text-sm text-gray-600">{permission.teacherEmail}</p>
                    </div>

                    {/* Access Badge */}
                    <div className="mb-3">
                      <Badge className="bg-green-100 text-green-700 border-green-300">
                        <Eye className="size-3 mr-1" />
                        View Access
                      </Badge>
                    </div>

                    {/* Departments & Subjects */}
                    <div className="space-y-2">
                      {permission.departments.map((dept, idx) => (
                        <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <GraduationCap className="size-4 text-gray-600" />
                            <span className="text-sm font-medium text-gray-900">{dept.name}</span>
                            <Badge variant="outline" className="text-xs ml-auto">
                              {dept.subjects.length} subjects
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-1 ml-6">
                            {dept.subjects.map((subject, subIdx) => (
                              <Badge key={subIdx} variant="outline" className="text-xs">
                                <BookOpen className="size-3 mr-1" />
                                {subject}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 text-xs text-gray-500">
                      Last updated: {permission.lastUpdated}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => openEditDialog(permission)}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Edit className="size-4" />
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleDeletePermission(permission.teacherId)}
                    variant="outline"
                    size="sm"
                    className="gap-2 text-red-600 hover:text-red-700 hover:border-red-300"
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {filteredPermissions.length === 0 && (
            <Card className="p-12 text-center bg-white border border-gray-200">
              <Shield className="size-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500">No access permissions assigned yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Click "Grant Access" to allow teachers to view question banks
              </p>
            </Card>
          )}
        </div>

        {/* Assign Access Dialog */}
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Grant Question Bank Access</DialogTitle>
              <DialogDescription>
                Select which question banks a teacher can view when creating exams
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Select Teacher */}
              <div>
                <Label htmlFor="teacher">Select Teacher</Label>
                <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTeachers.length > 0 ? (
                      availableTeachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.name} ({teacher.email})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        All teachers have access assigned
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Add Departments & Subjects */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <Label className="mb-3 block">Department & Subject Access</Label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <Label htmlFor="department" className="text-xs text-gray-600">
                      Department
                    </Label>
                    <Select value={tempDepartment} onValueChange={setTempDepartment}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockDepartments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.name}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button
                      onClick={handleAddDepartment}
                      variant="outline"
                      className="w-full"
                      disabled={!tempDepartment || tempSubjects.length === 0}
                    >
                      <Plus className="size-4 mr-2" />
                      Add Department
                    </Button>
                  </div>
                </div>

                {/* Subject Checkboxes */}
                {currentDepartment && (
                  <div className="mb-3 p-3 bg-white rounded-lg border border-gray-200">
                    <Label className="text-xs text-gray-600 mb-2 block">
                      Select Subjects in {tempDepartment}:
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {currentDepartment.subjects.map((subject) => (
                        <div key={subject} className="flex items-center gap-2">
                          <Checkbox
                            id={`subject-${subject}`}
                            checked={tempSubjects.includes(subject)}
                            onCheckedChange={() => handleSubjectToggle(subject)}
                          />
                          <Label
                            htmlFor={`subject-${subject}`}
                            className="text-sm cursor-pointer"
                          >
                            {subject}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Departments Display */}
                {selectedDepartments.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-600">Granted Access:</Label>
                    {selectedDepartments.map((dept, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white rounded-lg border border-gray-200 flex items-start justify-between"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <GraduationCap className="size-4 text-gray-600" />
                            <span className="text-sm font-medium text-gray-900">
                              {dept.name}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {dept.subjects.length} subjects
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-1 ml-6">
                            {dept.subjects.map((subject, subIdx) => (
                              <Badge key={subIdx} variant="outline" className="text-xs">
                                {subject}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Button
                          onClick={() => handleRemoveDepartment(dept.name)}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Info Note */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Eye className="size-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-900 mb-1">View-Only Access</h4>
                    <p className="text-xs text-blue-700">
                      Teachers will be able to view questions from these subjects when creating
                      exams, but they cannot add, edit, or delete questions in the question bank.
                      Only admins can manage the question bank.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAssignPermission}
                className="bg-gradient-to-r from-red-500 to-orange-600"
                disabled={!selectedTeacher || selectedDepartments.length === 0}
              >
                <Eye className="size-4 mr-2" />
                Grant Access
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Access Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Question Bank Access</DialogTitle>
              <DialogDescription>
                Update question bank access for {selectedPermission?.teacherName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Add Departments & Subjects */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <Label className="mb-3 block">Department & Subject Access</Label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <Label htmlFor="edit-department" className="text-xs text-gray-600">
                      Department
                    </Label>
                    <Select value={tempDepartment} onValueChange={setTempDepartment}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockDepartments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.name}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button
                      onClick={handleAddDepartment}
                      variant="outline"
                      className="w-full"
                      disabled={!tempDepartment || tempSubjects.length === 0}
                    >
                      <Plus className="size-4 mr-2" />
                      Add Department
                    </Button>
                  </div>
                </div>

                {/* Subject Checkboxes */}
                {currentDepartment && (
                  <div className="mb-3 p-3 bg-white rounded-lg border border-gray-200">
                    <Label className="text-xs text-gray-600 mb-2 block">
                      Select Subjects in {tempDepartment}:
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {currentDepartment.subjects.map((subject) => (
                        <div key={subject} className="flex items-center gap-2">
                          <Checkbox
                            id={`edit-subject-${subject}`}
                            checked={tempSubjects.includes(subject)}
                            onCheckedChange={() => handleSubjectToggle(subject)}
                          />
                          <Label
                            htmlFor={`edit-subject-${subject}`}
                            className="text-sm cursor-pointer"
                          >
                            {subject}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Departments Display */}
                {selectedDepartments.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-600">Current Access:</Label>
                    {selectedDepartments.map((dept, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white rounded-lg border border-gray-200 flex items-start justify-between"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <GraduationCap className="size-4 text-gray-600" />
                            <span className="text-sm font-medium text-gray-900">
                              {dept.name}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {dept.subjects.length} subjects
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-1 ml-6">
                            {dept.subjects.map((subject, subIdx) => (
                              <Badge key={subIdx} variant="outline" className="text-xs">
                                {subject}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Button
                          onClick={() => handleRemoveDepartment(dept.name)}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Info Note */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Eye className="size-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-900 mb-1">View-Only Access</h4>
                    <p className="text-xs text-blue-700">
                      Teachers will be able to view questions from these subjects when creating
                      exams, but they cannot add, edit, or delete questions in the question bank.
                      Only admins can manage the question bank.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdatePermission}
                className="bg-gradient-to-r from-red-500 to-orange-600"
                disabled={selectedDepartments.length === 0}
              >
                Update Access
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
