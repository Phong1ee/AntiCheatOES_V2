import { useState } from 'react';
import { BookOpenCheck, CheckCircle2, Download, Eye, FileText } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';

type TemplateKind = 'question';

const templates = [
  { kind: 'question' as const, title: 'Question Bank Template', description: 'Use this format when preparing multiple questions for a subject.', type: 'DOCX', path: '/templates/question-bank-import-template.docx', Icon: FileText },
];

const templateSections = [
  ['1', 'Subject information', 'Enter the Subject ID, Subject Name, and an optional description once at the start of the document.'],
  ['2', 'Chapter and learning objectives', 'Group questions under a Chapter. Add one or more learning objectives using their codes, separated by |.'],
  ['3', 'Question details', 'For each question, provide its type, difficulty, content, answer options where applicable, and the correct answer.'],
] as const;

const questionPreview = `QUESTION BANK IMPORT TEMPLATE

SUBJECT
Subject ID: DS310
Subject Name: Fundamentals of Data Science
Description: Core concepts and methods for data-driven decision making.

CHAPTER: Introduction to Data Science
Learning Objectives: LO1.1 | LO1.2

QUESTION 1
Type: Multiple Choice
Difficulty: Easy
Content: Which statement best describes data science?
A. A method for designing computer hardware
B. An interdisciplinary field that extracts knowledge from data
C. A database used only for financial records
D. A programming language for visual design
Answer: B

QUESTION 2
Type: True/False
Difficulty: Medium
Content: Data cleaning is an important step before analysis.
Answer: True

QUESTION 3
Type: Essay
Difficulty: Hard
Content: Explain two ways data quality can affect the reliability of an analysis.
Suggested Answer: Incomplete, inconsistent, or inaccurate data can lead to biased results and incorrect conclusions.`;

export function BulkDataRequestsCard() {
  const [preview, setPreview] = useState<TemplateKind | null>(null);
  const activeTemplate = templates.find((template) => template.kind === preview);

  return <>
    <Card className="rounded-2xl border-0 shadow-lg">
      <CardHeader><CardTitle className="flex items-center gap-2 text-gray-800"><Download className="size-5 text-teal-600" />Bulk Data Requests</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-5 text-gray-600">Need to add many questions? Use this template to prepare your file, then send it to an administrator for import.</p>
        {templates.map(({ kind, title, description, type, path, Icon }) => <div key={type} className="rounded-xl bg-gray-50 p-3"><div className="flex items-start gap-2"><Icon className="mt-0.5 size-4 shrink-0 text-teal-600" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm text-gray-800">{title}</p><Badge variant="outline" className="bg-white text-[10px]">{type}</Badge></div><p className="mt-1 text-xs leading-4 text-gray-500">{description}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1"><button type="button" onClick={() => setPreview(kind)} aria-label={`Preview ${title}`} className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-teal-800"><Eye className="size-3.5" />Preview</button><a href={path} download aria-label={`Download ${title}`} className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800"><Download className="size-3.5" />Download</a></div></div></div></div>)}
      </CardContent>
    </Card>
    <Dialog open={preview !== null} onOpenChange={(open) => { if (!open) setPreview(null); }}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="size-5 text-teal-600" />{activeTemplate?.title} Preview</DialogTitle><DialogDescription>This preview shows the exact structure used by the downloadable template.</DialogDescription></DialogHeader>
        <div className="grid gap-4 md:grid-cols-[0.9fr_1.4fr]">
          <aside className="space-y-3 rounded-xl border border-teal-100 bg-teal-50/60 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-teal-900"><BookOpenCheck className="size-4" />How to complete it</div>
            <ol className="space-y-3">
              {templateSections.map(([number, title, description]) => <li key={number} className="flex gap-2.5"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white">{number}</span><div><p className="text-xs font-semibold text-gray-800">{title}</p><p className="mt-0.5 text-xs leading-4 text-gray-600">{description}</p></div></li>)}
            </ol>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-4 text-amber-900"><p className="font-semibold">Before sending</p><p className="mt-1">Keep the field labels unchanged and ensure every MCQ or True/False question has one correct answer.</p></div>
          </aside>
          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
            <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-medium text-slate-300"><FileText className="size-3.5 text-teal-400" />Example completed document</div>
            <pre className="max-h-[52vh] overflow-auto p-4 text-xs leading-5 text-slate-100">{questionPreview}</pre>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"><div className="flex items-center gap-2 text-xs text-gray-600"><CheckCircle2 className="size-4 text-teal-600" />DOCX template includes MCQ, True/False, and Essay examples.</div><a href={activeTemplate?.path} download className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"><Download className="size-4" />Download Template</a></div>
      </DialogContent>
    </Dialog>
  </>;
}
