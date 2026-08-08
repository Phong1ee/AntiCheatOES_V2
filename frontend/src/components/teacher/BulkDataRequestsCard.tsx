import { useState } from 'react';
import { Download, Eye, FileSpreadsheet, FileText } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';

type TemplateKind = 'question' | 'user';

const templates = [
  { kind: 'question' as const, title: 'Question Bank Template', description: 'Use this format when preparing multiple questions for a subject.', type: 'DOCX', path: '/templates/question-bank-import-template.docx', Icon: FileText },
  { kind: 'user' as const, title: 'User Import Template', description: 'Use this spreadsheet when preparing multiple user accounts.', type: 'XLSX', path: '/templates/user-import-template.xlsx', Icon: FileSpreadsheet },
];

const questionPreview = `QUESTION BANK

SUBJECT
Subject ID: DS310
Subject Name: Fundamentals of Data Science
Description: Sample subject description.

CHAPTER: Introduction to Data Science
QUESTION 1
Type: Multiple Choice
Difficulty: Easy
Learning Objectives: LO A | LO B
Content: Replace this with your question text.
A. First option
B. Correct option
C. Third option
D. Fourth option
Answer: B`;

const userHeaders = ['school_id', 'full_name', 'email', 'role', 'phone', 'date_of_birth', 'initial_password'];

export function BulkDataRequestsCard() {
  const [preview, setPreview] = useState<TemplateKind | null>(null);
  const activeTemplate = templates.find((template) => template.kind === preview);

  return <>
    <Card className="rounded-2xl border-0 shadow-lg">
      <CardHeader><CardTitle className="flex items-center gap-2 text-gray-800"><Download className="size-5 text-teal-600" />Bulk Data Requests</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-5 text-gray-600">Need to add many questions or user accounts? Use the templates below to prepare your file, then send it to an administrator for import.</p>
        {templates.map(({ kind, title, description, type, path, Icon }) => <div key={type} className="rounded-xl bg-gray-50 p-3"><div className="flex items-start gap-2"><Icon className="mt-0.5 size-4 shrink-0 text-teal-600" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm text-gray-800">{title}</p><Badge variant="outline" className="bg-white text-[10px]">{type}</Badge></div><p className="mt-1 text-xs leading-4 text-gray-500">{description}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1"><button type="button" onClick={() => setPreview(kind)} aria-label={`Preview ${title}`} className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-teal-800"><Eye className="size-3.5" />Preview</button><a href={path} download aria-label={`Download ${title}`} className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800"><Download className="size-3.5" />Download</a></div></div></div></div>)}
      </CardContent>
    </Card>
    <Dialog open={preview !== null} onOpenChange={(open) => { if (!open) setPreview(null); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2">{preview === 'question' ? <FileText className="size-5 text-teal-600" /> : <FileSpreadsheet className="size-5 text-teal-600" />}{activeTemplate?.title} Preview</DialogTitle><DialogDescription>This preview shows the exact structure used by the downloadable template.</DialogDescription></DialogHeader>
        {preview === 'question' ? <pre className="max-h-[55vh] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">{questionPreview}</pre> : <div className="overflow-x-auto rounded-xl border"><table className="min-w-full text-left text-xs"><thead className="bg-teal-50 text-teal-900"><tr>{userHeaders.map((header) => <th key={header} className="whitespace-nowrap px-3 py-2.5 font-semibold">{header}</th>)}</tr></thead><tbody><tr className="text-gray-400">{userHeaders.map((header) => <td key={header} className="whitespace-nowrap border-t px-3 py-3">{header === 'phone' || header === 'date_of_birth' ? 'Optional' : 'Required'}</td>)}</tr></tbody></table></div>}
        <div className="flex justify-end"><a href={activeTemplate?.path} download className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"><Download className="size-4" />Download Template</a></div>
      </DialogContent>
    </Dialog>
  </>;
}
