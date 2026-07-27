import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Edit,
  Eye,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCog,
  X,
} from "lucide-react";
import { toast } from "sonner";
// import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { teacherPermissionService } from "../../services/teacher-permission.service";
import type {
  PermissionSubject,
  PermissionTeacher,
  TeacherPermissionAssignment,
} from "../../types/teacher-permission";

interface TeacherPermissions {
  teacher: PermissionTeacher;
  assignments: TeacherPermissionAssignment[];
}

export function TeacherPermissionsPage() {
  const [assignments, setAssignments] = useState<TeacherPermissionAssignment[]>(
    [],
  );
  const [teachers, setTeachers] = useState<PermissionTeacher[]>([]);
  const [subjects, setSubjects] = useState<PermissionSubject[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"grant" | "edit" | null>(null);
  const [selected, setSelected] = useState<TeacherPermissions | null>(null);
  const [teacherId, setTeacherId] = useState<number | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeacherPermissions | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const [items, teacherData, subjectData] = await Promise.all([
        teacherPermissionService.list(search),
        teacherPermissionService.teachers(),
        teacherPermissionService.subjects(),
      ]);

      setAssignments(items);
      setTeachers(teacherData);
      setSubjects(subjectData);
    } catch (cause) {
      setAssignments([]);
      setError(
        cause instanceof Error ? cause.message : "Unable to load permissions.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  const groups = useMemo(
    () =>
      Object.values(
        assignments
          .filter((item) => item.is_active)
          .reduce<Record<number, TeacherPermissions>>((result, item) => {
            result[item.teacher_id] ??= {
              teacher: {
                id: item.teacher_id,
                school_id: item.teacher_school_id,
                full_name: item.teacher_full_name,
                email: item.teacher_email,
              },
              assignments: [],
            };

            result[item.teacher_id].assignments.push(item);

            return result;
          }, {}),
      ),
    [assignments],
  );

  const availableTeachers = useMemo(
    () =>
      teachers.filter(
        (teacher) => !groups.some((group) => group.teacher.id === teacher.id),
      ),
    [groups, teachers],
  );

  const close = () => {
    if (saving) {
      return;
    }

    setModal(null);
    setSelected(null);
    setTeacherId(null);
    setSelectedSubjectIds([]);
  };

  const toggle = (id: string) => {
    setSelectedSubjectIds((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id],
    );
  };

  const openGrant = () => {
    setSelected(null);
    setTeacherId(null);
    setSelectedSubjectIds([]);
    setModal("grant");
  };

  const openEdit = (group: TeacherPermissions) => {
    setSelected(group);
    setTeacherId(null);
    setSelectedSubjectIds(group.assignments.map((item) => item.subject_id));
    setModal("edit");
  };

  const save = async () => {
    const id = modal === "grant" ? teacherId : selected?.teacher.id;

    if (!id || selectedSubjectIds.length === 0) {
      toast.error("Select a teacher and at least one subject.");
      return;
    }

    setSaving(true);

    try {
      await teacherPermissionService.updateTeacherPermissions(id, selectedSubjectIds);

      toast.success(
        modal === "grant"
          ? "Access granted successfully"
          : "Access updated successfully",
      );

      setModal(null);
      setSelected(null);
      setTeacherId(null);
      setSelectedSubjectIds([]);

      await load();
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Unable to save access.",
      );
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (item: TeacherPermissionAssignment) => {
    try {
      await teacherPermissionService.revoke(item.teacher_id, item.subject_id);

      toast.success("Access removed");

      await load();
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Unable to remove access.",
      );
    }
  };

  const removeAll = async () => {
    if (!removeTarget) return;
    setSaving(true); setRemoveError(null);
    try {
      await teacherPermissionService.removeAllAccess(removeTarget.teacher.id);
      toast.success("All access removed");
      setRemoveTarget(null);
      await load();
    } catch (cause) {
      setRemoveError(cause instanceof Error ? cause.message : "Unable to remove access.");
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <main className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6">
          <h1 className="mb-1 text-3xl text-gray-900">
            Teacher Question Bank Access
          </h1>

          <p className="text-sm text-gray-500">
            Grant teachers subject-scoped question bank and exam access
          </p>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            {
              label: "Teachers with Access",
              value: groups.length,
            },
            {
              label: "Total Subjects",
              value: subjects.length,
            },
            {
              label: "Available Teachers",
              value: availableTeachers.length,
            },
          ].map((stat) => (
            <Card
              key={stat.label}
              className="border border-gray-200 bg-white p-4 text-center shadow-sm"
            >
              <div className="text-2xl font-semibold text-gray-900">
                {stat.value}
              </div>

              <div className="text-xs text-gray-500">{stat.label}</div>
            </Card>
          ))}
        </div>

        <div className="mb-6 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />

            <Input
              placeholder="Search teachers..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-10"
            />
          </div>

          <Button
            onClick={openGrant}
            className="gap-2 bg-teal-600 text-white hover:bg-teal-700"
          >
            <Plus className="size-4" />
            Grant Access
          </Button>
        </div>

        {loading ? (
          <Card className="p-12 text-center">Loading permissions...</Card>
        ) : error ? (
          <Card className="p-12 text-center text-red-600">
            <p>{error}</p>

            <Button
              variant="outline"
              className="mt-3"
              onClick={() => void load()}
            >
              Try Again
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <Card
                key={group.teacher.id}
                className="border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-50">
                      <UserCog className="size-5 text-teal-600" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-gray-900">
                        {group.teacher.full_name}
                      </h3>

                      <p className="mb-3 truncate text-xs text-gray-500">
                        {group.teacher.email}
                      </p>

                      <div className="flex flex-wrap gap-1.5">
                        {group.assignments.map((item) => (
                          <span
                            key={item.subject_id}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-100 px-2 py-1 text-xs text-gray-700"
                          >
                            <BookOpen className="size-3 shrink-0" />

                            <span>{item.subject_name}</span>

                            <button
                              type="button"
                              onClick={() => void revoke(item)}
                              title={`Revoke access to ${item.subject_name}`}
                              aria-label={`Revoke access to ${item.subject_name}`}
                              className="ml-0.5 rounded-sm p-0.5 text-gray-500 transition hover:bg-gray-200 hover:text-gray-900"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => openEdit(group)}
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 text-xs"
                  >
                    <Edit className="size-3.5" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    onClick={() => { setRemoveError(null); setRemoveTarget(group); }}
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 border-red-200 text-xs text-red-600 hover:border-red-300 hover:text-red-700"
                  >
                    <Trash2 className="size-3.5" />
                    Remove Access
                  </Button>
                </div>
              </Card>
            ))}

            {groups.length === 0 && (
              <Card className="p-12 text-center">
                <Shield className="mx-auto mb-3 size-10 text-gray-300" />

                <p className="text-sm text-gray-500">
                  No access permissions assigned yet
                </p>
              </Card>
            )}
          </div>
        )}

        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex justify-between border-b px-6 pb-4 pt-6">
                <div>
                  <h2 className="text-lg font-semibold">
                    {modal === "grant"
                      ? "Grant Question Bank Access"
                      : "Edit Question Bank Access"}
                  </h2>

                  <p className="text-sm text-gray-400">
                    {selected?.teacher.full_name ??
                      "Select which subjects a teacher can access"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                  aria-label="Close dialog"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto px-6 py-5">
                {modal === "grant" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Teacher
                    </label>

                    <Select
                      value={teacherId !== null ? String(teacherId) : undefined}
                      onValueChange={(value: string) =>
                        setTeacherId(Number(value))
                      }
                      disabled={availableTeachers.length === 0 || saving}
                    >
                      <SelectTrigger className="h-12 w-full rounded-xl border-gray-200 bg-white px-4 text-sm shadow-sm transition hover:border-gray-300 focus:ring-2 focus:ring-teal-500/20">
                        <SelectValue placeholder="Choose a teacher..." />
                      </SelectTrigger>

                      <SelectContent
                        position="popper"
                        align="start"
                        sideOffset={4}
                        className="z-[70] max-h-60 w-[var(--radix-select-trigger-width)] min-w-0 rounded-xl border border-gray-200 bg-white shadow-lg"
                      >
                        {availableTeachers.map((teacher) => (
                          <SelectItem
                            key={teacher.id}
                            value={String(teacher.id)}
                            className="mx-2 my-1 w-auto cursor-pointer rounded-lg px-3 py-2.5 text-sm focus:bg-gray-100 focus:text-gray-900"
                          >
                            {teacher.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {availableTeachers.length === 0 && (
                      <p className="text-xs text-gray-500">
                        Every active teacher already has at least one subject
                        assignment.
                      </p>
                    )}
                  </div>
                )}

                <div className="max-h-56 overflow-y-auto rounded-lg border">
                  {subjects.map((subject) => (
                    <label
                      key={subject.subject_id}
                      className="flex items-center gap-3 border-b px-4 py-2.5 transition last:border-b-0 hover:bg-gray-50"
                    >
                      <Checkbox
                        checked={selectedSubjectIds.includes(
                          subject.subject_id,
                        )}
                        onCheckedChange={() => toggle(subject.subject_id)}
                        disabled={saving}
                      />

                      <BookOpen className="size-3.5 text-gray-400" />

                      <span className="text-sm">{subject.subject_name}</span>
                    </label>
                  ))}

                  {subjects.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                      No subjects available.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t px-6 py-4">
                <Button variant="outline" onClick={close} disabled={saving}>
                  Cancel
                </Button>

                <Button
                  onClick={() => void save()}
                  disabled={
                    saving ||
                    selectedSubjectIds.length === 0 ||
                    (modal === "grant" && teacherId === null)
                  }
                  className="bg-teal-600 text-white hover:bg-teal-700"
                >
                  {saving
                    ? "Saving..."
                    : modal === "grant"
                      ? "Grant Access"
                      : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        )}
        <AlertDialog open={removeTarget !== null} onOpenChange={(open) => { if (!open && !saving) { setRemoveTarget(null); setRemoveError(null); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove all access for {removeTarget?.teacher.full_name}?</AlertDialogTitle>
              <AlertDialogDescription>This teacher will immediately lose access to all assigned subjects. Existing questions, revisions, exams, and attempts will not be deleted.</AlertDialogDescription>
            </AlertDialogHeader>
            {removeError && <p className="text-sm text-red-600" role="alert">{removeError}</p>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={saving} onClick={(event) => { event.preventDefault(); void removeAll(); }} className="bg-red-600 hover:bg-red-700">
                {saving ? "Removing..." : "Remove Access"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
