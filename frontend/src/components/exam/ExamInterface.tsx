import { useState, useEffect, useRef, useCallback } from 'react';
import { ExamTopBar } from './ExamTopBar';
import { QuestionArea } from './QuestionArea';
import { QuestionPanel } from './QuestionPanel';
import { SubmitConfirmDialog } from './SubmitConfirmDialog';
import { ExamSubmitted } from './ExamSubmitted';
import { WebcamMonitor } from './WebcamMonitor';
import { ViolationWarningDialog } from './ViolationWarningDialog';
import { ExamSettings, defaultExamSettings } from '../../types/examSettings';

const API_BASE_URL = 'http://localhost:8000';

interface Question {
  id: number;
  text: string;
  type: 'multiple-choice' | 'essay';
  options?: string[];
  answer?: string;
}

interface ExamInterfaceProps {
  examId: string;
  onExit: () => void;
  settings?: ExamSettings;
}

export function ExamInterface({
  examId,
  onExit,
  settings = defaultExamSettings,
}: ExamInterfaceProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examTitle, setExamTitle] = useState('Exam');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [warnings, setWarnings] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Lưu lại tổng thời gian ban đầu của bài thi (giây)
  const initialTimeRef = useRef<number>(0);

  // Anti-cheating states
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [copyPasteCount, setCopyPasteCount] = useState(0);
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0);
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [violationType, setViolationType] = useState<
    'copy-paste' | 'tab-switch' | 'fullscreen-exit' | 'final'
  >('copy-paste');
  const [isTerminated, setIsTerminated] = useState(false);
  const warningTimeoutRef = useRef<number | null>(null);

  // ====== FETCH EXAM & QUESTIONS FROM BACKEND ======
  useEffect(() => {
    const fetchExam = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const token = localStorage.getItem('token');

        const res = await fetch(`${API_BASE_URL}/api/exams/${examId}`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Failed to load exam');
        }

        const data = await res.json();

        setExamTitle(data.exam.title);

        // duration_minutes từ DB -> giây
        const dur = (data.exam.duration_minutes || 20) * 60;
        initialTimeRef.current = dur;
        setTimeRemaining(dur);

        setQuestions(data.questions);
      } catch (err: any) {
        console.error(err);
        setLoadError(err.message || 'Error loading exam');
      } finally {
        setLoading(false);
      }
    };

    fetchExam();
  }, [examId]);

  // ---------- HANDLE VIOLATIONS (ngưỡng = 2) ----------
  const handleViolation = useCallback(
    (type: 'copy-paste' | 'tab-switch' | 'fullscreen-exit') => {
      if (isSubmitted || isTerminated) return;

      const MAX_VIOLATIONS = 2; // ✅ ngưỡng chung cho mọi loại

      let newCount = 0;

      if (type === 'copy-paste') {
        newCount = copyPasteCount + 1;
        setCopyPasteCount(newCount);
      } else if (type === 'tab-switch') {
        newCount = tabSwitchCount + 1;
        setTabSwitchCount(newCount);
      } else if (type === 'fullscreen-exit') {
        newCount = fullscreenExitCount + 1;
        setFullscreenExitCount(newCount);
      }

      // tăng tổng warnings (để show ở ExamTopBar)
      setWarnings((prev) => prev + 1);

      setViolationType(type);

      if (newCount >= MAX_VIOLATIONS) {
        // ✅ đủ 2 lần -> final, terminate & auto out
        setViolationType('final');
        setShowViolationWarning(true);
        setIsTerminated(true);

        const timeoutId = window.setTimeout(async () => {
          if (document.fullscreenElement) {
            await document.exitFullscreen();
          }
          onExit();
        }, 3000);

        warningTimeoutRef.current = timeoutId;
      } else {
        // chỉ cảnh báo, vẫn cho làm tiếp
        setShowViolationWarning(true);
      }
    },
    [
      isSubmitted,
      isTerminated,
      copyPasteCount,
      tabSwitchCount,
      fullscreenExitCount,
      onExit,
    ]
  );

  const handleAutoSubmit = () => {
    // Auto submit khi hết giờ
    confirmSubmit();
  };

  // Timer
  useEffect(() => {
    if (!timeRemaining) return;
    const timer = window.setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [timeRemaining]);

  // Fullscreen detection
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);

      if (!isCurrentlyFullscreen && !isSubmitted && !isTerminated && settings.fullscreen) {
        handleViolation('fullscreen-exit');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isSubmitted, isTerminated, settings.fullscreen, handleViolation]);

  // ✅ Sau khi đóng warning của fullscreen-exit (nhưng chưa bị final),
  // tự vào lại fullscreen mode
  useEffect(() => {
    const reenterFullscreen = async () => {
      if (!settings.fullscreen || isSubmitted || isTerminated) return;
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        console.error('Failed to re-enter fullscreen:', err);
      }
    };

    if (
      !showViolationWarning &&                 // dialog vừa đóng
      !isSubmitted &&
      !isTerminated &&
      violationType === 'fullscreen-exit'      // chỉ cho case fullscreen-exit
    ) {
      reenterFullscreen();
    }
  }, [
    showViolationWarning,
    isSubmitted,
    isTerminated,
    violationType,
    settings.fullscreen,
  ]);

  // Auto-save answers (demo – hiện chỉ log)
  useEffect(() => {
    const autoSave = window.setInterval(() => {
      console.log('Auto-saving answers...', answers);
    }, 30000);
    return () => window.clearInterval(autoSave);
  }, [answers]);

  // Detect copy/paste attempts
  useEffect(() => {
    if (!settings.disableCopyPaste) return;

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      handleViolation('copy-paste');
      return false;
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      handleViolation('copy-paste');
      return false;
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      handleViolation('copy-paste');
      return false;
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      handleViolation('copy-paste');
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v' || e.key === 'x')) {
        e.preventDefault();
        handleViolation('copy-paste');
        return false;
      }

      if (
        e.key === 'F5' ||
        (e.ctrlKey && e.key === 'r') ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.shiftKey && e.key === 'J') ||
        (e.ctrlKey && e.key === 'u')
      ) {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('cut', handleCut);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [settings.disableCopyPaste, handleViolation]);

  // Detect tab switching and window blur
  useEffect(() => {
    if (settings.tabSwitchAction === 'none') return;

    const handleVisibilityChange = () => {
      if (document.hidden && !isSubmitted && !isTerminated) {
        handleViolation('tab-switch');
      }
    };

    const handleBlur = () => {
      if (!isSubmitted && !isTerminated) {
        handleViolation('tab-switch');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isSubmitted, isTerminated, settings.tabSwitchAction, handleViolation]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (warningTimeoutRef.current !== null) {
        window.clearTimeout(warningTimeoutRef.current);
      }
    };
  }, []);

  // Enter fullscreen on mount
  useEffect(() => {
    const enterFullscreen = async () => {
      if (!settings.fullscreen) return;
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        console.error('Failed to enter fullscreen:', err);
      }
    };

    enterFullscreen();
  }, [settings.fullscreen]);

  const handleAnswerChange = (questionId: number, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = () => {
    setShowSubmitDialog(true);
  };

  const confirmSubmit = async () => {
    setShowSubmitDialog(false);

    try {
      const token = localStorage.getItem('token');
      const answersPayload = Object.entries(answers).map(([qId, ans]) => ({
        questionId: Number(qId),
        answerText: ans,
      }));

      const total = initialTimeRef.current;
      const timeSpentSeconds =
        total > 0 ? Math.max(0, total - timeRemaining) : 0;

      const res = await fetch(`${API_BASE_URL}/api/exams/${examId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          answers: answersPayload,
          timeSpentSeconds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('Submit failed:', data);
      } else {
        console.log('Submit success:', data);
      }
    } catch (err) {
      console.error('Submit error:', err);
    }

    setIsSubmitted(true);
  };

  const handleExitSubmitted = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    onExit();
  };

  // ====== LOADING / ERROR / SUBMITTED STATES ======
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-gray-700">Loading exam...</p>
      </div>
    );
  }

  if (loadError || questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <p className="text-red-600 mb-4">
          {loadError || 'No questions found for this exam.'}
        </p>
        <button
          className="px-4 py-2 bg-teal-600 text-white rounded-lg"
          onClick={onExit}
        >
          Back
        </button>
      </div>
    );
  }

  if (isSubmitted) {
    return <ExamSubmitted onExit={handleExitSubmitted} />;
  }

  const answeredCount = Object.keys(answers).length;
  const unansweredQuestions = questions
    .filter((q) => !answers[q.id])
    .map((q) => q.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 flex flex-col">
      <ExamTopBar
        examTitle={examTitle}
        timeRemaining={timeRemaining}
        onSubmit={handleSubmit}
        warnings={warnings}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <QuestionArea
            question={questions[currentQuestion]}
            currentQuestion={currentQuestion}
            totalQuestions={questions.length}
            answer={answers[questions[currentQuestion].id]}
            onAnswerChange={handleAnswerChange}
            onPrevious={() =>
              setCurrentQuestion((prev) => Math.max(0, prev - 1))
            }
            onNext={() =>
              setCurrentQuestion((prev) =>
                Math.min(questions.length - 1, prev + 1)
              )
            }
          />
        </div>

        <QuestionPanel
          questions={questions}
          currentQuestion={currentQuestion}
          answers={answers}
          onQuestionSelect={setCurrentQuestion}
          answeredCount={answeredCount}
          unansweredQuestions={unansweredQuestions}
        />
      </div>

      <SubmitConfirmDialog
        open={showSubmitDialog}
        onOpenChange={setShowSubmitDialog}
        onConfirm={confirmSubmit}
        answeredCount={answeredCount}
        totalQuestions={questions.length}
      />

      {/* <WebcamMonitor /> */}

      <ViolationWarningDialog
        open={showViolationWarning}
        onOpenChange={setShowViolationWarning}
        violationType={violationType}
        violationCount={
          violationType === 'copy-paste'
            ? copyPasteCount
            : violationType === 'tab-switch'
            ? tabSwitchCount
            : violationType === 'fullscreen-exit'
            ? fullscreenExitCount
            : 0
        }
        threshold={2} // ✅ hiển thị đúng ngưỡng 2
      />
    </div>
  );
}
