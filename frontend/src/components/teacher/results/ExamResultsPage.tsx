import { useEffect, useState } from 'react';
import { Button } from '../../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { ResultsFilter, type ResultsFilterValue } from './ResultsFilter';
import { ExamInfoCard } from './ExamInfoCard';
import { ResultsTable } from './ResultsTable';
import { StudentDetailModal } from './StudentDetailModal';
import { QuestionStatistics } from './QuestionStatistics';
import { ExamListView } from './ExamListView';
import { ManualGradingModal } from './ManualGradingModal';
import { FileSpreadsheet, ArrowLeft, PenTool, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert';
import { toast } from 'sonner';
import { teacherResultsService } from '../../../services/teacher-results.service';
import type { ExamResultsOverview } from '../../../types/teacher-results';

export function ExamResultsPage() {
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedAttemptId, setSelectedAttemptId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('results');
  const [showManualGrading, setShowManualGrading] = useState(false);

  const [overview, setOverview] = useState<ExamResultsOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState<ResultsFilterValue>({ search: '', status: 'all' });

  const examId = selectedExamId ? Number(selectedExamId) : null;

  const loadOverview = () => {
    if (!examId) return;
    setOverviewLoading(true);
    setOverviewError(null);
    teacherResultsService
      .getOverview(examId)
      .then(setOverview)
      .catch((err) => setOverviewError(err instanceof Error ? err.message : 'Failed to load exam overview'))
      .finally(() => setOverviewLoading(false));
  };

  useEffect(() => {
    setOverview(null);
    if (examId) loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  const handleFilterChange = (value: ResultsFilterValue) => {
    setFilters(value);
  };

  const handleExportExcel = async () => {
    if (!examId || !overview) return;
    try {
      await teacherResultsService.exportExcel(examId, overview.examName);
      toast.success('Results exported to Excel');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export results');
    }
  };

  const handleRefreshGrades = () => {
    loadOverview();
    setRefreshKey((key) => key + 1);
    toast.success('Results refreshed');
  };

  const handleManualGrading = () => {
    setShowManualGrading(true);
  };

  const handleCloseManualGrading = () => {
    setShowManualGrading(false);
    loadOverview();
    setRefreshKey((key) => key + 1);
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
          {selectedExamId && overview && (
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
          ) : overviewLoading && !overview ? (
            <div className="text-center text-gray-500 py-12">Loading exam details...</div>
          ) : overviewError ? (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="size-4 text-red-600" />
              <AlertTitle className="text-red-800">Failed to load exam details</AlertTitle>
              <AlertDescription className="text-red-700">{overviewError}</AlertDescription>
            </Alert>
          ) : overview ? (
            // Exam Detail View
            <>
              {/* Grading Alert */}
              {overview.hasEssayQuestions && overview.pendingEssayCount > 0 && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertCircle className="size-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">
                    Essay Grading Incomplete
                  </AlertTitle>
                  <AlertDescription className="text-amber-700">
                    There are <strong>{overview.pendingEssayCount} essay question{overview.pendingEssayCount > 1 ? 's' : ''}</strong> still pending manual grading.
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
                examName={overview.examName}
                subject={overview.subject}
                startDate={overview.startDate ?? ''}
                endDate={overview.endDate ?? ''}
                totalQuestions={overview.totalQuestions}
                totalStudents={overview.totalStudents}
                submittedCount={overview.submittedCount}
                avgScore={overview.avgScore}
                highestScore={overview.highestScore}
                lowestScore={overview.lowestScore}
                hasEssayQuestions={overview.hasEssayQuestions}
                pendingEssayCount={overview.pendingEssayCount}
                totalEssayCount={overview.totalEssayCount}
                onRefreshGrades={handleRefreshGrades}
                onManualGrading={overview.hasEssayQuestions ? handleManualGrading : undefined}
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
                  <ResultsTable
                    examId={examId!}
                    examName={overview.examName}
                    refreshKey={refreshKey}
                    filters={filters}
                    onViewDetail={setSelectedAttemptId}
                  />
                </TabsContent>

                <TabsContent value="statistics" className="space-y-4 mt-6">
                  <QuestionStatistics examId={examId!} refreshKey={refreshKey} />
                </TabsContent>
              </Tabs>
            </>
          ) : null}
        </div>
      </div>

      {/* Student Detail Modal */}
      {selectedAttemptId !== null && examId && (
        <StudentDetailModal
          examId={examId}
          attemptId={selectedAttemptId}
          onClose={() => setSelectedAttemptId(null)}
        />
      )}

      {/* Manual Grading Modal */}
      {showManualGrading && examId && (
        <ManualGradingModal
          examId={examId}
          onClose={handleCloseManualGrading}
        />
      )}
    </div>
  );
}
