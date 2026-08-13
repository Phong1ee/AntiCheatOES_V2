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
import { LoadingState } from '../common/LoadingState';

interface ExamResultsPageProps {
  initialExamId?: string | null;
}

export function ExamResultsPage({ initialExamId }: ExamResultsPageProps) {
  const [selectedExamId, setSelectedExamId] = useState<string | null>(initialExamId ?? null);
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

  useEffect(() => {
    if (initialExamId) setSelectedExamId(initialExamId);
  }, [initialExamId]);

  const handleFilterChange = (value: ResultsFilterValue) => {
    setFilters(value);
  };

  const handleExportExcel = async () => {
    if (!examId || !overview) return;
    try {
      const { jobId } = await teacherResultsService.requestExcelExport(examId);
      toast.success('Report export queued. Preparing your download...');
      for (let poll = 0; poll < 60; poll += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        const job = await teacherResultsService.getExcelExportJob(jobId);
        if (job.status === 'COMPLETED') {
          await teacherResultsService.downloadExcelExport(jobId, overview.examName);
          toast.success('Results exported to Excel');
          return;
        }
        if (job.status === 'FAILED') {
          throw new Error(job.error || 'Report export failed');
        }
      }
      toast.info('Report is still running. Please try the export again shortly.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to queue report export');
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
    <div className="h-[calc(100vh-80px)] flex flex-col overflow-hidden bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50">
      {/* Header — only shown when an exam is selected */}
      {selectedExamId && (
        <div className="px-6 pt-5 max-w-7xl mx-auto w-full">
          <div className="flex items-center justify-between gap-4">
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

            {overview && (
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
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {!selectedExamId ? (
            // Exam List View
            <ExamListView onSelectExam={setSelectedExamId} />
          ) : overviewLoading && !overview ? (
            <LoadingState label="Loading exam details..." />
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
                <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <div className="size-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="size-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-800">
                      {overview.pendingEssayCount} essay{overview.pendingEssayCount > 1 ? 's' : ''} pending manual grading
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Student scores may not be final until all essays are graded.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleManualGrading}
                    className="bg-amber-500 hover:bg-amber-600 text-white flex-shrink-0"
                  >
                    <PenTool className="size-3.5 mr-1.5" />
                    Grade now
                  </Button>
                </div>
              )}

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
                resultStrategy={overview.resultStrategy}
                onRefreshGrades={handleRefreshGrades}
                onManualGrading={overview.hasEssayQuestions ? handleManualGrading : undefined}
              />

              {/* Filters */}
              <ResultsFilter onFilterChange={handleFilterChange} />

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
