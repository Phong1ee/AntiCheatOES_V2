import { useState } from 'react';
import { Button } from '../../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { ResultsFilter } from './ResultsFilter';
import { ExamInfoCard } from './ExamInfoCard';
import { ResultsTable } from './ResultsTable';
import { StudentDetailModal } from './StudentDetailModal';
import { QuestionStatistics } from './QuestionStatistics';
import { ExamListView } from './ExamListView';
import { ManualGradingModal } from './ManualGradingModal';
import { FileSpreadsheet, FileText, Download, ArrowLeft, PenTool, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert';
import { toast } from 'sonner';

export function ExamResultsPage() {
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('results');
  const [showManualGrading, setShowManualGrading] = useState(false);

  const handleFilterChange = (filters: any) => {
    console.log('Filters applied:', filters);
    // Apply filters to results
  };

  const handleExportExcel = () => {
    toast.success('Exporting results to Excel...');
    // Implement Excel export logic
  };

  const handleExportPDF = () => {
    toast.success('Exporting results to PDF...');
    // Implement PDF export logic
  };

  const handleRefreshGrades = () => {
    toast.loading('Refreshing grades...');
    // Simulate regrade process
    setTimeout(() => {
      toast.dismiss();
      toast.success('Grades have been updated successfully!');
    }, 2000);
  };

  const handleManualGrading = () => {
    setShowManualGrading(true);
  };

  // Mock exam data
  const examData = {
    examName: 'Database Systems Midterm Exam',
    subject: 'Database Systems',
    startDate: '2025-11-14T09:00:00',
    endDate: '2025-11-14T12:00:00',
    totalQuestions: 20,
    totalStudents: 25,
    submittedCount: 23,
    avgScore: 82.5,
    highestScore: 98,
    lowestScore: 45,
    hasEssayQuestions: true,
    pendingEssayCount: 8,
    totalEssayCount: 23,
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Title and Back Button */}
          <div className="flex items-center gap-4">
            {selectedExamId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedExamId(null);
                  setActiveTab('results');
                }}
                className="hover:bg-gray-100"
              >
                <ArrowLeft className="size-4 mr-2" />
                Back to Exams
              </Button>
            )}
            <div>
              <h1 className="text-2xl text-gray-800">
                {selectedExamId ? 'Exam Details' : 'Exam Results & Analytics'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {selectedExamId
                  ? 'View detailed results and export comprehensive reports'
                  : 'Select an exam to view detailed results and analytics'}
              </p>
            </div>
          </div>

          {/* Right: Export Actions (only show when exam is selected) */}
          {selectedExamId && (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="hover:bg-green-50 hover:border-green-300"
              >
                <FileSpreadsheet className="size-4 mr-2 text-green-600" />
                Export Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                className="hover:bg-red-50 hover:border-red-300"
              >
                <FileText className="size-4 mr-2 text-red-600" />
                Export PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshGrades}
                className="hover:bg-blue-50 hover:border-blue-300"
              >
                <Download className="size-4 mr-2 text-blue-600" />
                Refresh Grades
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualGrading}
                className="hover:bg-purple-50 hover:border-purple-300"
              >
                <PenTool className="size-4 mr-2 text-purple-600" />
                Grade Essay Questions
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {!selectedExamId ? (
            // Exam List View
            <ExamListView onSelectExam={setSelectedExamId} />
          ) : (
            // Exam Detail View
            <>
              {/* Grading Alert */}
              {examData.hasEssayQuestions && examData.pendingEssayCount > 0 && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertCircle className="size-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">
                    Essay Grading Incomplete
                  </AlertTitle>
                  <AlertDescription className="text-amber-700">
                    There are <strong>{examData.pendingEssayCount} essay question{examData.pendingEssayCount > 1 ? 's' : ''}</strong> still pending manual grading. 
                    Student scores may not be final until all essays are graded.
                    <Button
                      variant="link"
                      size="sm"
                      onClick={handleManualGrading}
                      className="text-amber-800 underline p-0 h-auto ml-2"
                    >
                      Grade now
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Filters */}
              <ResultsFilter onFilterChange={handleFilterChange} />

              {/* Exam Info Card */}
              <ExamInfoCard
                {...examData}
                onRefreshGrades={handleRefreshGrades}
                onManualGrading={handleManualGrading}
              />

              {/* Tabs for Results and Statistics */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-white shadow-md rounded-xl border-0 p-1">
                  <TabsTrigger
                    value="results"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-500 data-[state=active]:to-blue-600 data-[state=active]:text-white rounded-lg"
                  >
                    Student Results
                  </TabsTrigger>
                  <TabsTrigger
                    value="statistics"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-500 data-[state=active]:to-blue-600 data-[state=active]:text-white rounded-lg"
                  >
                    Question Statistics
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="results" className="space-y-4 mt-6">
                  <ResultsTable onViewDetail={setSelectedStudentId} />
                </TabsContent>

                <TabsContent value="statistics" className="space-y-4 mt-6">
                  <QuestionStatistics />
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>

      {/* Student Detail Modal */}
      {selectedStudentId && (
        <StudentDetailModal
          studentId={selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
        />
      )}

      {/* Manual Grading Modal */}
      {showManualGrading && selectedExamId && (
        <ManualGradingModal
          examId={selectedExamId}
          onClose={() => setShowManualGrading(false)}
        />
      )}
    </div>
  );
}