import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Search, Users } from 'lucide-react';
import { toast } from 'sonner';

import { teacherExamService } from '../../../../services/teacher-exam.service';
import type { AssignmentOptions } from '../../../../types/teacher-exam';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../ui/alert-dialog';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Checkbox } from '../../../ui/checkbox';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';

interface AssignmentTabProps {
  examId: string | null;
}

export function AssignmentTab({ examId }: AssignmentTabProps) {
  const [data, setData] = useState<AssignmentOptions | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [originalIds, setOriginalIds] = useState<Set<string>>(new Set());
  const [classFilter, setClassFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemoval, setConfirmRemoval] = useState(false);

  const load = useCallback(async () => {
    if (!examId || examId.startsWith('new-')) {
      setData(null);
      setSelectedIds(new Set());
      setOriginalIds(new Set());
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await teacherExamService.getAssignmentOptions(Number(examId));
      const assigned = new Set(
        response.students.filter((student) => student.assigned).map((student) => student.school_id),
      );
      setData(response);
      setSelectedIds(assigned);
      setOriginalIds(new Set(assigned));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load assignment options.');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    setClassFilter('all');
    setSearch('');
    void load();
  }, [load]);

  const visibleStudents = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return (data?.students ?? []).filter((student) => {
      const matchesClass = classFilter === 'all' || student.class_ids.includes(Number(classFilter));
      const matchesSearch = !normalized
        || student.full_name.toLowerCase().includes(normalized)
        || student.school_id.toLowerCase().includes(normalized)
        || student.email.toLowerCase().includes(normalized);
      return matchesClass && matchesSearch;
    });
  }, [classFilter, data, search]);

  const visibleSelectedCount = visibleStudents.filter((student) => selectedIds.has(student.school_id)).length;
  const allVisibleSelected = visibleStudents.length > 0 && visibleSelectedCount === visibleStudents.length;
  const selectAllState = allVisibleSelected ? true : visibleSelectedCount > 0 ? 'indeterminate' : false;
  const removedCount = [...originalIds].filter((id) => !selectedIds.has(id)).length;
  const dirty = selectedIds.size !== originalIds.size
    || [...selectedIds].some((id) => !originalIds.has(id));

  const toggleStudent = (schoolId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(schoolId)) next.delete(schoolId);
      else next.add(schoolId);
      return next;
    });
  };

  const toggleVisible = (checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      visibleStudents.forEach((student) => {
        if (checked) next.add(student.school_id);
        else next.delete(student.school_id);
      });
      return next;
    });
  };

  const save = async () => {
    if (!examId) return;
    try {
      setSaving(true);
      const result = await teacherExamService.saveAssignments(Number(examId), [...selectedIds]);
      toast.success(
        `Assignments saved: ${result.added_count} added, ${result.removed_count} removed, ${result.final_count} total.`,
      );
      setConfirmRemoval(false);
      await load();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Unable to save assignments.');
    } finally {
      setSaving(false);
    }
  };

  if (!examId || examId.startsWith('new-')) {
    return <div className="rounded-xl border bg-white p-8 text-center text-gray-500">Save the exam before assigning students.</div>;
  }

  return (
    <Card className="mx-auto max-w-5xl border-0 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="size-5 text-teal-600" />Assign Students</CardTitle>
        <CardDescription>
          Class selection is a bulk action over current membership. Future class members are not assigned automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !data ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-gray-600"><Loader2 className="size-5 animate-spin" />Loading classes and students...</div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-center text-red-700">
            <p>{error}</p>
            <Button variant="outline" className="mt-3" onClick={() => void load()}><RefreshCw className="mr-2 size-4" />Retry</Button>
          </div>
        ) : !data?.classes.length ? (
          <div className="rounded-lg border p-8 text-center text-gray-500">No classes are assigned to your teacher account.</div>
        ) : !data.students.length ? (
          <div className="rounded-lg border p-8 text-center text-gray-500">Your classes currently have no students.</div>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, school ID, or email" className="pl-10" />
              </div>
              <Select
                value={classFilter}
                onValueChange={(value) => {
                  setClassFilter(value);
                  if (value !== 'all') {
                    const classId = Number(value);
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      data.students
                        .filter((student) => student.class_ids.includes(classId))
                        .forEach((student) => next.add(student.school_id));
                      return next;
                    });
                  }
                }}
              >
                <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {data.classes.map((courseClass) => (
                    <SelectItem key={courseClass.class_id} value={String(courseClass.class_id)}>
                      {courseClass.class_name} ({courseClass.student_count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-visible"
                  checked={selectAllState}
                  onCheckedChange={(checked) => toggleVisible(checked === true)}
                />
                <Label htmlFor="select-visible">Select all visible ({visibleStudents.length})</Label>
              </div>
              <div className="flex gap-2 text-sm">
                <Badge variant="outline">{selectedIds.size} selected</Badge>
                <Badge variant="outline">{originalIds.size} assigned</Badge>
                {dirty && <Badge className="bg-amber-100 text-amber-700">Unsaved changes</Badge>}
              </div>
            </div>

            <div className="max-h-[430px] overflow-y-auto rounded-xl border">
              {visibleStudents.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No students match the current filters.</div>
              ) : visibleStudents.map((student) => (
                <label key={student.school_id} className="flex cursor-pointer items-start gap-3 border-b p-4 last:border-0 hover:bg-gray-50">
                  <Checkbox checked={selectedIds.has(student.school_id)} onCheckedChange={() => toggleStudent(student.school_id)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{student.full_name}</span>
                      <Badge variant="outline">{student.school_id}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{student.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {student.class_names.map((name) => <Badge key={name} variant="secondary">{name}</Badge>)}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end">
              <Button
                disabled={!dirty || saving}
                onClick={() => removedCount > 0 ? setConfirmRemoval(true) : void save()}
                className="bg-gradient-to-r from-teal-500 to-blue-600"
              >
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save Assignments
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <AlertDialog open={confirmRemoval} onOpenChange={setConfirmRemoval}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removedCount} existing assignment{removedCount === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>
              Students with an existing attempt cannot be removed; the server will reject the synchronization without partial changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={(event) => { event.preventDefault(); void save(); }}>
              Confirm and Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
