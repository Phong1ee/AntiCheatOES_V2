import { useCallback, useEffect, useMemo, useState } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Label } from '../ui/label';
import {
  Search,
  BookOpen,
  Users,
  GraduationCap,
  Plus,
  UserCheck,
  ChevronRight,
  Pencil,
  X,
  UserPlus,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { adminClassService } from '../../services/admin-class.service';
import { teacherPermissionService } from '../../services/teacher-permission.service';
import { normalizeSearchText } from '../../utils/search';
import type {
  AssignableTeacher,
  AvailableStudent,
  ClassDetail,
  ClassPerson,
  ClassSummary,
} from '../../types/admin-class';
import type { PermissionSubject } from '../../types/teacher-permission';

// ─── Presentation helpers ────────────────────────────────────────────────────

const colorMap: Record<string, { bg: string; text: string; light: string; dot: string }> = {
  teal:   { bg: 'bg-teal-500',   text: 'text-teal-700',   light: 'bg-teal-50',   dot: 'bg-teal-500' },
  blue:   { bg: 'bg-blue-500',   text: 'text-blue-700',   light: 'bg-blue-50',   dot: 'bg-blue-500' },
  purple: { bg: 'bg-purple-500', text: 'text-purple-700', light: 'bg-purple-50', dot: 'bg-purple-500' },
  orange: { bg: 'bg-orange-500', text: 'text-orange-700', light: 'bg-orange-50', dot: 'bg-orange-500' },
  rose:   { bg: 'bg-rose-500',   text: 'text-rose-700',   light: 'bg-rose-50',   dot: 'bg-rose-500' },
};

const palette = Object.keys(colorMap);

/** Stable colour per subject so a class keeps the same accent between loads. */
function subjectColor(subjectId: string): string {
  let hash = 0;
  for (let index = 0; index < subjectId.length; index += 1) {
    hash = (hash * 31 + subjectId.charCodeAt(index)) % 9973;
  }
  return palette[hash % palette.length];
}

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ name, color, size = 'md' }: { name: string; color?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'size-7 text-xs' : size === 'lg' ? 'size-12 text-base' : 'size-9 text-sm';
  const bg = color ? colorMap[color]?.bg ?? 'bg-gray-400' : 'bg-gray-400';
  return (
    <div className={`${sz} ${bg} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initialsOf(name)}
    </div>
  );
}

function StatusBadge({ status }: { status: 'active' | 'inactive' }) {
  return (
    <Badge
      variant="outline"
      className={`text-xs flex-shrink-0 ${
        status === 'active'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-gray-50 text-gray-500 border-gray-200'
      }`}
    >
      {status}
    </Badge>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function SubjectClassPage() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [sidebarSearch, setSidebarSearch] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('all');
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());

  const [studentSearch, setStudentSearch] = useState('');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showChangeTeacher, setShowChangeTeacher] = useState(false);
  const [pendingTeacherId, setPendingTeacherId] = useState('');
  const [teachers, setTeachers] = useState<AssignableTeacher[]>([]);
  const [available, setAvailable] = useState<AvailableStudent[]>([]);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [savingTeacher, setSavingTeacher] = useState(false);
  const [addSearch, setAddSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [subjectOptions, setSubjectOptions] = useState<PermissionSubject[]>([]);
  const [draftName, setDraftName] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftTeacher, setDraftTeacher] = useState('');
  const [creating, setCreating] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadClasses = useCallback(async () => {
    try {
      setListLoading(true);
      setListError(null);
      const items = await adminClassService.list();
      setClasses(items);
      setSelectedId((current) => (
        current !== null && items.some((item) => item.class_id === current) ? current : items[0]?.class_id ?? null
      ));
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Unable to load classes.');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const loadDetail = useCallback(async (classId: number) => {
    try {
      setDetailLoading(true);
      setDetail(await adminClassService.detail(classId));
    } catch (error) {
      setDetail(null);
      toast.error(error instanceof Error ? error.message : 'Unable to load the class.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId === null) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const teacherOptions = useMemo(() => {
    const unique = new Map<string, string>();
    classes.forEach((item) => {
      if (item.teacher) unique.set(item.teacher.school_id, item.teacher.full_name);
    });
    return [...unique.entries()].sort((left, right) => left[1].localeCompare(right[1]));
  }, [classes]);

  const filteredClasses = useMemo(() => {
    const term = normalizeSearchText(sidebarSearch.trim());
    return classes
      .filter((item) => filterTeacher === 'all' || item.teacher?.school_id === filterTeacher)
      .filter((item) => !term
        || normalizeSearchText(item.class_name).includes(term)
        || normalizeSearchText(item.subject_id).includes(term)
        || normalizeSearchText(item.subject_name ?? '').includes(term));
  }, [classes, filterTeacher, sidebarSearch]);

  /** Sidebar is a subject -> classes tree, so only one subject is in view at a time. */
  const subjectGroups = useMemo(() => {
    const groups = new Map<string, { subjectId: string; subjectName: string; items: ClassSummary[] }>();
    filteredClasses.forEach((item) => {
      const group = groups.get(item.subject_id) ?? {
        subjectId: item.subject_id,
        subjectName: item.subject_name ?? item.subject_id,
        items: [],
      };
      group.items.push(item);
      groups.set(item.subject_id, group);
    });
    return [...groups.values()].sort((left, right) => left.subjectName.localeCompare(right.subjectName));
  }, [filteredClasses]);

  // While searching every match should be visible without extra clicks.
  const searching = sidebarSearch.trim() !== '';
  const isSubjectOpen = (subjectId: string) => searching || expandedSubjects.has(subjectId);

  const toggleSubject = (subjectId: string) => {
    setExpandedSubjects((current) => {
      const next = new Set(current);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  };

  // Keep the selected class reachable: its subject is always expanded.
  const selectedSubjectId = classes.find((item) => item.class_id === selectedId)?.subject_id;
  useEffect(() => {
    if (!selectedSubjectId) return;
    setExpandedSubjects((current) => (
      current.has(selectedSubjectId) ? current : new Set(current).add(selectedSubjectId)
    ));
  }, [selectedSubjectId]);

  const filteredStudents = useMemo(() => {
    const term = normalizeSearchText(studentSearch.trim());
    return (detail?.students ?? []).filter((student) => !term
      || normalizeSearchText(student.full_name).includes(term)
      || normalizeSearchText(student.school_id).includes(term)
      || normalizeSearchText(student.email).includes(term));
  }, [detail, studentSearch]);

  const filteredAvailable = useMemo(() => {
    const term = normalizeSearchText(addSearch.trim());
    return available.filter((student) => !term
      || normalizeSearchText(student.full_name).includes(term)
      || normalizeSearchText(student.school_id).includes(term)
      || normalizeSearchText(student.email).includes(term));
  }, [available, addSearch]);

  const openChangeTeacher = async () => {
    if (!detail) return;
    setPendingTeacherId(detail.teacher?.school_id ?? '');
    setShowChangeTeacher(true);
    try {
      setDialogLoading(true);
      setTeachers(await adminClassService.teachers(detail.subject_id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load teachers.');
    } finally {
      setDialogLoading(false);
    }
  };

  const confirmChangeTeacher = async () => {
    if (!detail || !pendingTeacherId) return;
    try {
      setSavingTeacher(true);
      const result = await adminClassService.changeTeacher(detail.class_id, pendingTeacherId);
      setShowChangeTeacher(false);
      setPendingTeacherId('');
      await Promise.all([loadClasses(), loadDetail(detail.class_id)]);
      toast.success(result.granted_subject_permission
        ? `Teacher updated and granted ${detail.subject_id} question-bank access.`
        : 'Teacher updated successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to change the teacher.');
    } finally {
      setSavingTeacher(false);
    }
  };

  const openAddStudent = async () => {
    if (!detail) return;
    setAddSearch('');
    setShowAddStudent(true);
    try {
      setDialogLoading(true);
      setAvailable(await adminClassService.availableStudents(detail.class_id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load students.');
    } finally {
      setDialogLoading(false);
    }
  };

  const addStudent = async (student: ClassPerson) => {
    if (!detail) return;
    try {
      setBusyStudentId(student.school_id);
      await adminClassService.addStudents(detail.class_id, [student.school_id]);
      setAvailable((current) => current.filter((item) => item.school_id !== student.school_id));
      await Promise.all([loadClasses(), loadDetail(detail.class_id)]);
      toast.success(`${student.full_name} added to the class.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to add the student.');
    } finally {
      setBusyStudentId(null);
    }
  };

  const removeStudent = async (student: ClassPerson) => {
    if (!detail) return;
    try {
      setBusyStudentId(student.school_id);
      await adminClassService.removeStudent(detail.class_id, student.school_id);
      await Promise.all([loadClasses(), loadDetail(detail.class_id)]);
      toast.success('Student removed from the class.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to remove the student.');
    } finally {
      setBusyStudentId(null);
    }
  };

  const openCreate = async () => {
    setDraftName('');
    setDraftSubject('');
    setDraftTeacher('');
    setShowCreate(true);
    try {
      setDialogLoading(true);
      const [subjectList, teacherList] = await Promise.all([
        teacherPermissionService.subjects(),
        adminClassService.teachers(),
      ]);
      setSubjectOptions(subjectList);
      setTeachers(teacherList);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load subjects and teachers.');
    } finally {
      setDialogLoading(false);
    }
  };

  // Re-fetch so each teacher is flagged against the subject actually chosen.
  const chooseDraftSubject = async (subjectId: string) => {
    setDraftSubject(subjectId);
    try {
      setTeachers(await adminClassService.teachers(subjectId));
    } catch {
      // The unscoped list already loaded is still usable; the flag is advisory.
    }
  };

  const createClass = async () => {
    try {
      setCreating(true);
      const created = await adminClassService.create({
        class_name: draftName.trim(),
        subject_id: draftSubject,
        teacher_school_id: draftTeacher,
      });
      setShowCreate(false);
      await loadClasses();
      setSelectedId(created.class_id);
      toast.success(created.granted_subject_permission
        ? `${created.class_name} created and the teacher was granted ${created.subject_id} question-bank access.`
        : `${created.class_name} created.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create the class.');
    } finally {
      setCreating(false);
    }
  };

  const renameClass = async () => {
    if (!detail) return;
    try {
      setRenaming(true);
      await adminClassService.rename(detail.class_id, renameValue.trim());
      setShowRename(false);
      await Promise.all([loadClasses(), loadDetail(detail.class_id)]);
      toast.success('Class renamed.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to rename the class.');
    } finally {
      setRenaming(false);
    }
  };

  const deleteClass = async () => {
    if (!detail) return;
    try {
      setDeleting(true);
      await adminClassService.remove(detail.class_id);
      setConfirmDelete(false);
      setSelectedId(null);
      await loadClasses();
      toast.success('Class deleted.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete the class.');
    } finally {
      setDeleting(false);
    }
  };

  const detailColor = detail ? subjectColor(detail.subject_id) : 'teal';

  return (
    <div className="flex h-[calc(100vh-64px)]">

      {/* ── Left Sidebar ─────────────────────────────────── */}
      <aside className="w-72 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white overflow-hidden">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-800">Subject Classes</h2>
              <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{classes.length}</span>
            </div>
            <Button
              size="sm"
              className="h-7 gap-1 text-xs bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
              onClick={() => void openCreate()}
            >
              <Plus className="size-3" />
              New
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              placeholder="Search classes..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="pl-9 text-sm h-9"
            />
          </div>
          <Select value={filterTeacher} onValueChange={setFilterTeacher}>
            <SelectTrigger className="w-full text-xs h-8">
              <SelectValue placeholder="Teacher" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teachers</SelectItem>
              {teacherOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {listLoading ? (
            <div className="p-8 flex items-center justify-center gap-2 text-sm text-gray-400">
              <Loader2 className="size-4 animate-spin" />Loading classes...
            </div>
          ) : listError ? (
            <div className="p-6 text-center space-y-3">
              <p className="text-sm text-red-600">{listError}</p>
              <Button variant="outline" size="sm" onClick={() => void loadClasses()}>
                <RefreshCw className="mr-2 size-4" />Retry
              </Button>
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-sm text-gray-400">
                {classes.length === 0 ? 'No classes exist yet' : 'No classes match your filters'}
              </p>
              {classes.length === 0 && (
                <Button variant="outline" size="sm" onClick={() => void openCreate()}>
                  <Plus className="mr-2 size-4" />Create the first class
                </Button>
              )}
            </div>
          ) : (
            subjectGroups.map((group) => {
              const col = colorMap[subjectColor(group.subjectId)];
              const open = isSubjectOpen(group.subjectId);
              return (
                <div key={group.subjectId} className="border-b border-gray-100 last:border-0">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggleSubject(group.subjectId)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
                  >
                    <ChevronRight className={`size-4 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
                    <span className={`size-2.5 rounded-full flex-shrink-0 ${col.dot}`} />
                    <span className="flex-1 min-w-0">
                      <span className={`block text-xs font-mono font-bold ${col.text}`}>{group.subjectId}</span>
                      <span className="block text-xs text-gray-500 truncate">{group.subjectName}</span>
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5 flex-shrink-0">
                      {group.items.length}
                    </span>
                  </button>

                  {open && (
                    <div className="pb-1">
                      {group.items.map((item) => {
                        const isSelected = selectedId === item.class_id;
                        return (
                          <button
                            key={item.class_id}
                            onClick={() => { setSelectedId(item.class_id); setStudentSearch(''); }}
                            className={`w-full text-left pl-9 pr-3 py-2.5 transition-colors border-l-2
                              ${isSelected
                                ? 'bg-orange-50/60 border-l-orange-500'
                                : 'border-l-transparent hover:bg-gray-50/70'}`}
                          >
                            <p className={`text-sm truncate ${isSelected ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                              {item.class_name}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                              <span className="flex items-center gap-1 min-w-0">
                                <GraduationCap className="size-3 flex-shrink-0" />
                                <span className="truncate">{item.teacher?.full_name ?? 'Unassigned'}</span>
                              </span>
                              <span className="flex items-center gap-1 flex-shrink-0">
                                <Users className="size-3" />
                                {item.student_count}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Right Detail ─────────────────────────────────── */}
      {!detail ? (
        <div className="flex-1 flex items-center justify-center bg-gray-50/40">
          <div className="text-center">
            <div className="inline-flex p-5 bg-white rounded-2xl shadow-sm border border-gray-100 mb-4">
              {detailLoading ? <Loader2 className="size-10 text-gray-200 animate-spin" /> : <BookOpen className="size-10 text-gray-200" />}
            </div>
            <p className="text-sm text-gray-400">
              {detailLoading ? 'Loading class...' : 'Select a class to view its details'}
            </p>
          </div>
        </div>
      ) : (
        <main className="flex-1 overflow-y-auto bg-gray-50/40 p-6 space-y-6">
          {/* Page header */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-mono font-bold ${colorMap[detailColor].text} ${colorMap[detailColor].light} px-2 py-0.5 rounded-md`}>
                  {detail.subject_id}
                </span>
                <span className="text-xs text-gray-400 truncate">{detail.subject_name ?? '—'}</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">{detail.class_name}</h1>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 flex-shrink-0">
              <span className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                <Users className="size-4 text-blue-500" />
                {detail.student_count} students
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs"
                onClick={() => { setRenameValue(detail.class_name); setShowRename(true); }}
              >
                <Pencil className="size-3" />
                Rename
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs text-red-600 hover:text-red-700"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-3" />
                Delete
              </Button>
            </div>
          </div>

          {/* ── Teacher Card ── */}
          <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <GraduationCap className="size-4 text-orange-500" />
                <h2 className="text-sm font-semibold text-gray-800">Assigned Teacher</h2>
              </div>
              <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8" onClick={() => void openChangeTeacher()}>
                <Pencil className="size-3" />
                Change
              </Button>
            </div>
            <div className="p-5 space-y-4">
              {detail.teacher ? (
                <div className="flex items-center gap-4">
                  <Avatar name={detail.teacher.full_name} color={detailColor} size="lg" />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{detail.teacher.full_name}</p>
                    <p className="text-sm text-gray-400 mt-0.5">{detail.teacher.school_id} · {detail.teacher.email}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <UserCheck className={`size-3.5 ${detail.teacher.status === 'active' ? 'text-emerald-500' : 'text-gray-400'}`} />
                      <span className={`text-xs font-medium ${detail.teacher.status === 'active' ? 'text-emerald-600' : 'text-gray-500'}`}>
                        {detail.teacher.status === 'active' ? 'Active instructor' : 'Account inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No teacher assigned.</p>
              )}

              {/* Class ownership and question-bank access are separate gates. */}
              {detail.teacher && !detail.teacher_has_subject_permission && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle className="size-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">
                    This teacher can assign these students to {detail.subject_id} exams, but their
                    {' '}{detail.subject_id} question-bank access has since been revoked, so they cannot
                    import questions. Reassign the teacher here, or restore it under
                    {' '}<strong>Teacher Permissions</strong>.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* ── Student Roster ── */}
          <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-blue-500" />
                <h2 className="text-sm font-semibold text-gray-800">Student Roster</h2>
                <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                  {detail.students.length}
                </span>
              </div>
              <Button
                size="sm"
                className="text-xs gap-1.5 h-8 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
                onClick={() => void openAddStudent()}
              >
                <UserPlus className="size-3.5" />
                Add Student
              </Button>
            </div>

            <div className="px-5 py-3 border-b border-gray-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  placeholder="Search students..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="pl-9 text-sm h-9"
                />
              </div>
            </div>

            <div className="divide-y divide-gray-50">
              {filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">No students found</div>
              ) : (
                filteredStudents.map((student) => (
                  <div key={student.school_id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/60 group">
                    <Avatar name={student.full_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{student.full_name}</p>
                      <p className="text-xs text-gray-400 truncate">{student.school_id} · {student.email}</p>
                    </div>
                    <StatusBadge status={student.status} />
                    <button
                      onClick={() => void removeStudent(student)}
                      disabled={busyStudentId === student.school_id}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-red-50 transition-all disabled:opacity-40"
                      title="Remove from class"
                      aria-label={`Remove ${student.full_name} from class`}
                    >
                      {busyStudentId === student.school_id
                        ? <Loader2 className="size-3.5 text-gray-400 animate-spin" />
                        : <X className="size-3.5 text-red-400" />}
                    </button>
                  </div>
                ))
              )}
            </div>

            {filteredStudents.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/40 text-xs text-gray-400">
                Showing {filteredStudents.length} of {detail.students.length} students · removing a student
                here does not withdraw exam assignments already made
              </div>
            )}
          </section>
        </main>
      )}

      {/* ── Change Teacher Dialog ─────────────────────────── */}
      <Dialog open={showChangeTeacher} onOpenChange={setShowChangeTeacher}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Teacher</DialogTitle>
            <DialogDescription>
              Assign a different teacher to <strong>{detail?.class_name} — {detail?.subject_id}</strong>. This
              changes which students that teacher can assign to exams in this subject, and grants them
              {' '}{detail?.subject_id} question-bank access if they do not already have it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-2 max-h-80 overflow-y-auto">
            {dialogLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
                <Loader2 className="size-4 animate-spin" />Loading teachers...
              </div>
            ) : teachers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No teacher accounts available.</p>
            ) : (
              teachers.map((teacher) => (
                <button
                  key={teacher.school_id}
                  onClick={() => setPendingTeacherId(teacher.school_id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left
                    ${pendingTeacherId === teacher.school_id
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'}`}
                >
                  <Avatar name={teacher.full_name} color={pendingTeacherId === teacher.school_id ? detailColor : undefined} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{teacher.full_name}</p>
                    <p className="text-xs text-gray-400 truncate">{teacher.email}</p>
                    {teacher.has_subject_permission === false && (
                      <p className="text-xs text-teal-600 mt-0.5">
                        Will be granted {detail?.subject_id} question-bank access
                      </p>
                    )}
                  </div>
                  {pendingTeacherId === teacher.school_id && (
                    <div className="size-2 rounded-full bg-orange-500 flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowChangeTeacher(false)} disabled={savingTeacher}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
              onClick={() => void confirmChangeTeacher()}
              disabled={!pendingTeacherId || savingTeacher || pendingTeacherId === detail?.teacher?.school_id}
            >
              {savingTeacher && <Loader2 className="mr-2 size-4 animate-spin" />}
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create Class Dialog ───────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Class</DialogTitle>
            <DialogDescription>
              The subject and teacher chosen here decide which students that teacher can assign to exams.
              The teacher is granted question-bank access for the subject automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="new-class-name">Class name</Label>
              <Input
                id="new-class-name"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="e.g. CS301-A"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-class-subject">Subject</Label>
              <Select value={draftSubject} onValueChange={(value) => void chooseDraftSubject(value)}>
                <SelectTrigger id="new-class-subject">
                  <SelectValue placeholder={dialogLoading ? 'Loading...' : 'Select a subject'} />
                </SelectTrigger>
                <SelectContent>
                  {subjectOptions.map((subject) => (
                    <SelectItem key={subject.subject_id} value={subject.subject_id}>
                      {subject.subject_id} · {subject.subject_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-class-teacher">Teacher</Label>
              <Select value={draftTeacher} onValueChange={setDraftTeacher}>
                <SelectTrigger id="new-class-teacher">
                  <SelectValue placeholder={dialogLoading ? 'Loading...' : 'Select a teacher'} />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.school_id} value={teacher.school_id}>
                      {teacher.full_name}
                      {teacher.has_subject_permission === false && ' (access will be granted)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)} disabled={creating}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
              onClick={() => void createClass()}
              disabled={creating || !draftName.trim() || !draftSubject || !draftTeacher}
            >
              {creating && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Rename Class Dialog ───────────────────────────── */}
      <Dialog open={showRename} onOpenChange={setShowRename}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Class</DialogTitle>
            <DialogDescription>
              The subject stays {detail?.subject_id}. Move students instead of changing the subject.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            <Label htmlFor="rename-class">Class name</Label>
            <Input
              id="rename-class"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowRename(false)} disabled={renaming}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
              onClick={() => void renameClass()}
              disabled={renaming || !renameValue.trim() || renameValue.trim() === detail?.class_name}
            >
              {renaming && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Class Confirmation ─────────────────────── */}
      <AlertDialog open={confirmDelete} onOpenChange={(open) => { if (!deleting) setConfirmDelete(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {detail?.class_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the class and its {detail?.student_count ?? 0} enrolment
              {detail?.student_count === 1 ? '' : 's'}. Student accounts are kept, and exam assignments
              already made from this roster stay in place. Teachers will no longer be able to assign these
              students to {detail?.subject_id} exams through this class.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
              onClick={(event) => { event.preventDefault(); void deleteClass(); }}
            >
              {deleting ? 'Deleting...' : 'Delete class'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Add Student Dialog ────────────────────────────── */}
      <Dialog open={showAddStudent} onOpenChange={setShowAddStudent}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Students</DialogTitle>
            <DialogDescription>
              Enrol students into <strong>{detail?.class_name} — {detail?.subject_id}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              placeholder="Search students..."
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              className="pl-9 text-sm h-9"
            />
          </div>
          <div className="mt-2 space-y-2 max-h-80 overflow-y-auto">
            {dialogLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
                <Loader2 className="size-4 animate-spin" />Loading students...
              </div>
            ) : filteredAvailable.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                {available.length === 0 ? 'All students are already enrolled.' : 'No students match your search.'}
              </p>
            ) : (
              filteredAvailable.map((student) => {
                const blocked = student.conflict_class_name !== null;
                return (
                  <div
                    key={student.school_id}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      blocked
                        ? 'border-gray-100 bg-gray-50/60 opacity-70'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Avatar name={student.full_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{student.full_name}</p>
                      {blocked ? (
                        <p className="text-xs text-amber-700 truncate">
                          Already in {student.conflict_class_name}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 truncate">{student.school_id} · {student.email}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 gap-1 flex-shrink-0"
                      disabled={blocked || busyStudentId === student.school_id}
                      title={blocked
                        ? `A student can only attend one ${detail?.subject_id} class.`
                        : undefined}
                      onClick={() => void addStudent(student)}
                    >
                      {busyStudentId === student.school_id
                        ? <Loader2 className="size-3 animate-spin" />
                        : <Plus className="size-3" />}
                      Add
                    </Button>
                  </div>
                );
              })
            )}
          </div>
          <Button variant="outline" className="w-full mt-2" onClick={() => setShowAddStudent(false)}>
            Done
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
