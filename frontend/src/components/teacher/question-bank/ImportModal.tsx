import { useState } from 'react';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Alert, AlertDescription } from '../../ui/alert';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  File,
} from 'lucide-react';

interface ImportModalProps {
  onClose: () => void;
  onImport: () => void;
}

export function ImportModal({ onClose, onImport }: ImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState('');
  const [autoCreateTopics, setAutoCreateTopics] = useState(true);

  // Mock preview data
  const previewData = [
    {
      id: '1',
      question: 'What is normalization?',
      type: 'MCQ',
      difficulty: 'Medium',
      status: 'valid',
    },
    {
      id: '2',
      question: 'A primary key can be null',
      type: 'True/False',
      difficulty: 'Easy',
      status: 'valid',
    },
    {
      id: '3',
      question: 'Explain ACID properties',
      type: 'Essay',
      difficulty: '',
      status: 'warning',
      warning: 'Missing difficulty level',
    },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleContinue = () => {
    if (file) {
      setStep('preview');
    }
  };

  const handleImport = () => {
    onImport();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl text-gray-800">Import Questions</h2>
            <p className="text-sm text-gray-500 mt-1">
              {step === 'upload'
                ? 'Upload a CSV or Excel file with your questions'
                : 'Review and confirm your questions before importing'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' ? (
            <div className="space-y-6">
              {/* Download Template */}
              <Alert className="border-teal-200 bg-teal-50">
                <Download className="size-4 text-teal-600" />
                <AlertDescription className="text-teal-800">
                  <div className="flex items-center justify-between">
                    <span>Download our template to format your questions correctly</span>
                    <Button variant="outline" size="sm" className="ml-4">
                      <Download className="size-4 mr-2" />
                      Download Template
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>

              {/* File Upload */}
              <div className="space-y-2">
                <Label>Upload File</Label>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-teal-400 transition-colors cursor-pointer"
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <Upload className="size-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-1">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-sm text-gray-500">
                    CSV or Excel files (Max 5MB)
                  </p>
                  <input
                    id="file-input"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                {file && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <FileSpreadsheet className="size-5 text-teal-600" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-800">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFile(null)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Import Settings */}
              <div className="space-y-4">
                <h3 className="text-gray-800">Import Settings</h3>

                <div className="space-y-2">
                  <Label htmlFor="import-subject">Default Subject</Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger id="import-subject">
                      <SelectValue placeholder="Select default subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="database">Database Systems</SelectItem>
                      <SelectItem value="web">Web Development</SelectItem>
                      <SelectItem value="datastructures">Data Structures</SelectItem>
                      <SelectItem value="algorithms">Algorithms</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="auto-create"
                    checked={autoCreateTopics}
                    onChange={(e) => setAutoCreateTopics(e.target.checked)}
                    className="size-4 text-teal-600 rounded"
                  />
                  <Label htmlFor="auto-create" className="cursor-pointer">
                    Automatically create topics if they don't exist
                  </Label>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Preview Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                  <p className="text-sm text-green-600">Valid</p>
                  <p className="text-2xl text-green-700 mt-1">2</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-sm text-amber-600">Warnings</p>
                  <p className="text-2xl text-amber-700 mt-1">1</p>
                </div>
                <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                  <p className="text-sm text-red-600">Errors</p>
                  <p className="text-2xl text-red-700 mt-1">0</p>
                </div>
              </div>

              {/* Preview List */}
              <div className="space-y-3">
                <h3 className="text-gray-800">Preview Questions</h3>

                <div className="border border-gray-200 rounded-xl max-h-[400px] overflow-y-auto">
                  {previewData.map((item, index) => (
                    <div
                      key={item.id}
                      className="p-4 border-b border-gray-100 last:border-0"
                    >
                      <div className="flex items-start gap-3">
                        {item.status === 'valid' ? (
                          <CheckCircle className="size-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="size-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-sm text-gray-800 flex-1">
                              {index + 1}. {item.question}
                            </p>
                            <div className="flex gap-1 flex-shrink-0">
                              <Badge variant="outline" className="text-xs">
                                {item.type}
                              </Badge>
                              {item.difficulty && (
                                <Badge variant="outline" className="text-xs">
                                  {item.difficulty}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {item.warning && (
                            <p className="text-xs text-amber-600">{item.warning}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warnings */}
              {previewData.some((item) => item.status === 'warning') && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertCircle className="size-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    Some questions have warnings. You can still import them, but you may
                    want to review and fix them later.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          {step === 'upload' ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleContinue}
                disabled={!file || !subject}
                className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
              >
                Continue to Preview
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
              >
                Import Questions
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
