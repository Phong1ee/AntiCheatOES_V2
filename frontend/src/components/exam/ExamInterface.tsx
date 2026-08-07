<<<<<<< Updated upstream
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
  type: 'multiple-choice' | 'true-false' | 'essay';
  options?: string[];
  answer?: string;
}

interface ApiQuestionOption {
  id: number;
  text: string;
}

interface ApiQuestion {
  id: number;
  text: string;
  type: 'multiple-choice' | 'true-false' | 'essay';
  options?: ApiQuestionOption[];
  answer?: string;
}
=======
import { useCallback, useEffect, useRef, useState } from "react";
import { ExamTopBar } from "./ExamTopBar";
import { QuestionArea } from "./QuestionArea";
import { QuestionPanel } from "./QuestionPanel";
import { SubmitConfirmDialog } from "./SubmitConfirmDialog";
import { ExamSubmitted } from "./ExamSubmitted";
import { ViolationWarningDialog } from "./ViolationWarningDialog";
import { WebcamMonitor } from "./WebcamMonitor";
import { studentExamService, type AntiCheatEventResult } from "../../services/student-exam.service";
import { useAntiCheatMonitoring } from "../../hooks/useAntiCheatMonitoring";
import { useMediaManager } from "../../hooks/useMediaManager";
import { useVisionProctoring } from "../../hooks/useVisionProctoring";
import { useAudioProctoring } from "../../hooks/useAudioProctoring";
import { recordProctoringMetric, startMainThreadMetrics } from "../../utils/proctoring-debug-metrics";
import type { StudentAnswer, StudentAnswers, StudentExamSettings, StudentQuestion } from "../../types/student-exam";
>>>>>>> Stashed changes

interface ExamInterfaceProps {
  examId: string;
  onExit: () => void;
<<<<<<< Updated upstream
  settings?: ExamSettings;
}

export function ExamInterface({
  examId,
  onExit,
  settings = defaultExamSettings,
}: ExamInterfaceProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examTitle, setExamTitle] = useState('Exam');
=======
  mediaStream?: MediaStream;
  audioContext?: AudioContext;
}

const attemptKey = "current_exam_attempt";
const draftKey = (attemptId: number) => `exam_attempt_draft_${attemptId}`;

const isAnswered = (answer: StudentAnswer | undefined) =>
  Boolean(answer && ("selectedOptionId" in answer || answer.answerText.trim()));

export function ExamInterface({ examId, onExit, mediaStream, audioContext }: ExamInterfaceProps) {
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [answers, setAnswers] = useState<StudentAnswers>({});
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [examTitle, setExamTitle] = useState("Exam");
>>>>>>> Stashed changes
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [warnings, setWarnings] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Lưu lại tổng thời gian ban đầu của bài thi (giây)
  const initialTimeRef = useRef<number>(0);

  // Anti-cheating states
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [copyPasteCount, setCopyPasteCount] = useState(0);
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0);
  const [showViolationWarning, setShowViolationWarning] = useState(false);
<<<<<<< Updated upstream
  const [violationType, setViolationType] = useState<
    'copy-paste' | 'tab-switch' | 'fullscreen-exit' | 'final'
  >('copy-paste');
  const [isTerminated, setIsTerminated] = useState(false);
  const warningTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const rawAttempt = localStorage.getItem('current_exam_attempt');
    if (!rawAttempt) return;
=======
  const [eventCountsTowardLimit, setEventCountsTowardLimit] = useState(true);
  const [fullscreenLocked, setFullscreenLocked] = useState(false);
  const [settings, setSettings] = useState<StudentExamSettings>({ autoSubmitOnExpire: true, sequentialNavigation: false, antiCheatEnabled: false, violationLimit: 5 });
  const [isSavingNext, setIsSavingNext] = useState(false);
  const [monitoringRetry, setMonitoringRetry] = useState(0);
  const [monitoringRetryCount, setMonitoringRetryCount] = useState(0);

  const answersRef = useRef<StudentAnswers>({});
  const persistedAnsweredRef = useRef(new Set<number>());
  const dirtyRef = useRef(new Set<number>());
  const sequenceRef = useRef(new Map<number, number>());
  const essayTimersRef = useRef(new Map<number, number>());
  const expiresAtRef = useRef(0);
  const serverOffsetRef = useRef(0);
  const serverOffsetInitializedRef = useRef(false);
  const autoSubmitRef = useRef(false);
  const hadPositiveTimerRef = useRef(false);
  const fullscreenArmedRef = useRef(false);
  const intentionalFullscreenExitRef = useRef(false);
  const nextInFlightRef = useRef(false);
>>>>>>> Stashed changes

    try {
<<<<<<< Updated upstream
      const parsed = JSON.parse(rawAttempt);
      if (String(parsed.examId) === String(examId) && parsed.attemptId) {
        setAttemptId(Number(parsed.attemptId));
=======
      await document.exitFullscreen();
    } finally {
      window.setTimeout(() => { intentionalFullscreenExitRef.current = false; }, 0);
    }
  }, []);

  const handleNormalExit = useCallback(() => {
    void exitFullscreenIntentionally().finally(onExit);
  }, [exitFullscreenIntentionally, onExit]);

  const exitAfterTermination = useCallback(() => {
    void exitFullscreenIntentionally().finally(onExit);
  }, [exitFullscreenIntentionally, onExit]);

  const persistDraft = useCallback((id: number, nextAnswers: StudentAnswers) => {
    localStorage.setItem(draftKey(id), JSON.stringify(nextAnswers));
  }, []);

  const stopAutoSave = useCallback((message?: string) => {
    essayTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    essayTimersRef.current.clear();
    dirtyRef.current.clear();
    setTimerReady(false);
    if (message) setSubmitError(message);
  }, []);

  const handleAntiCheatEvent = useCallback((event: AntiCheatEventResult, eventType: string) => {
    recordProctoringMetric("event-api", event.duplicate ? "duplicate" : "accepted", { eventType, countsTowardLimit: event.countsTowardLimit, violationCount: event.violationCount });
    setViolationType(eventType); setViolationCount(event.violationCount); setViolationLimit(event.violationLimit); setRemainingViolations(event.remainingViolations); setEventCountsTowardLimit(event.countsTowardLimit); setShowViolationWarning(true);
    if (event.terminated) {
      setAttemptStatus("terminated"); setIsTerminated(true); stopAutoSave();
      localStorage.removeItem(attemptKey);
      if (attemptId) localStorage.removeItem(draftKey(attemptId));
      // Keep the termination dialog visible. The Student must explicitly
      // acknowledge it instead of being returned to Dashboard automatically.
    }
  }, [attemptId, exitAfterTermination, stopAutoSave]);

  useEffect(() => startMainThreadMetrics(), []);

  const sendMediaIncident = useCallback((eventType: "CAMERA_NOT_AVAILABLE" | "CAMERA_TRACK_MUTED" | "CAMERA_TRACK_ENDED" | "CAMERA_PERMISSION_DENIED" | "MIC_NOT_AVAILABLE" | "MIC_TRACK_MUTED" | "MIC_TRACK_ENDED" | "NO_FACE_DETECTED" | "FACE_QUALITY_LOW" | "FACE_POSITION_INVALID" | "UPPER_BODY_NOT_VISIBLE" | "MULTIPLE_FACES_DETECTED" | "PHONE_DETECTED" | "GAZE_AWAY_SUSTAINED" | "HEAD_POSE_OUT_OF_RANGE" | "REPEATED_HEAD_MOVEMENT" | "AUDIO_ACTIVITY_DETECTED" | "SPEECH_ACTIVITY_DETECTED" | "AUDIO_SIGNAL_DEGRADED", source: "camera" | "microphone", details: string, metadata: Record<string, string | number>) => {
    if (!attemptId) return;
    void studentExamService.recordAntiCheatEvent(examId, attemptId, eventType, source, details, metadata)
      .then((event) => handleAntiCheatEvent(event, eventType))
      .catch(() => { /* A session failure is surfaced by the existing heartbeat/save gates. */ });
  }, [attemptId, examId, handleAntiCheatEvent]);

  const media = useMediaManager({
    active: antiCheatEnabled && attemptStatus === "in_progress" && Boolean(attemptId),
    initialStream: mediaStream,
    onIncident: sendMediaIncident,
  });
  const mediaStop = media.stop;
  const vision = useVisionProctoring({
    active: antiCheatEnabled && attemptStatus === "in_progress" && Boolean(attemptId),
    stream: media.stream,
    mediaHealthy: media.cameraLive && media.microphoneLive,
    recoveryActive: media.recoveryRequired,
    restartToken: monitoringRetry,
    onDetection: (eventType, details, metadata) => sendMediaIncident(eventType, "camera", details, metadata),
  });
  const audio = useAudioProctoring({ active: antiCheatEnabled && attemptStatus === "in_progress" && Boolean(attemptId), stream: media.stream, audioContext, healthy: media.microphoneLive && !media.recoveryRequired, restartToken: monitoringRetry, onDetection: (eventType, details, metadata) => sendMediaIncident(eventType, "microphone", details, metadata) });

  const saveQuestion = useCallback(async (questionId: number, force = false): Promise<boolean> => {
    if (!attemptId || attemptStatus !== "in_progress" || !navigator.onLine) return false;
    if (!dirtyRef.current.has(questionId) && !force) return true;
    const answer = answersRef.current[questionId];
    if (!answer) return false;
    const sequence = (sequenceRef.current.get(questionId) ?? 0) + 1;
    sequenceRef.current.set(questionId, sequence);
    setSaveStatus("Saving");
    try {
      const result = await studentExamService.saveAnswer(examId, attemptId, questionId, answer);
      if (sequenceRef.current.get(questionId) === sequence) {
        dirtyRef.current.delete(questionId);
        if (isAnswered(answer)) persistedAnsweredRef.current.add(questionId);
        else persistedAnsweredRef.current.delete(questionId);
        setSaveStatus(dirtyRef.current.size ? "Saving" : "Saved");
        return true;
>>>>>>> Stashed changes
      }
    } catch (err) {
      console.error('Failed to parse current exam attempt:', err);
    }
  }, [examId]);

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
          throw new Error(data.detail || data.message || 'Failed to load exam');
        }

        const data = await res.json();

        setExamTitle(data.exam.title);

        // duration_minutes từ DB -> giây
        const dur = (data.exam.duration_minutes || 20) * 60;
        initialTimeRef.current = dur;
        setTimeRemaining(dur);

        const normalizedQuestions: Question[] = (data.questions || []).map((question: ApiQuestion) => ({
          id: question.id,
          text: question.text,
          type: question.type,
          answer: question.answer,
          options: (question.options || []).map((option) => option.text),
        }));

        setQuestions(normalizedQuestions);
      } catch (err: any) {
        console.error(err);
        setLoadError(err.message || 'Error loading exam');
      } finally {
        setLoading(false);
      }
<<<<<<< Updated upstream
=======
      return false;
    }
  }, [attemptId, attemptStatus, examId, stopAutoSave]);

  const flushDirty = useCallback(async () => {
    await Promise.all([...dirtyRef.current].map(saveQuestion));
  }, [saveQuestion]);

  useEffect(() => {
    if (!attemptId || attemptStatus !== "in_progress") return undefined;
    const heartbeat = window.setInterval(() => {
      void studentExamService.heartbeat(examId, attemptId).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Attempt session is invalid. Resume from My Exams.";
        stopAutoSave(message);
      });
    }, 25_000);
    return () => window.clearInterval(heartbeat);
  }, [attemptId, attemptStatus, examId, stopAutoSave]);

  const submit = useCallback(async (automatic = false) => {
    if (!attemptId || attemptStatus !== "in_progress" || isSubmitted) return;
    setSubmitError(null);
    await flushDirty();
    try {
      const result = await studentExamService.submit(examId, attemptId, answersRef.current);
      localStorage.removeItem(attemptKey);
      localStorage.removeItem(draftKey(attemptId));
      setAttemptStatus("submitted");
      stopAutoSave();
      setShowEssayGradingNote(result.resultVisibility !== "hidden" && result.essayPending);
      setIsSubmitted(true);
      mediaStop();
      void exitFullscreenIntentionally();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : automatic ? "Auto-submit failed" : "Submit failed");
    }
  }, [attemptId, attemptStatus, examId, exitFullscreenIntentionally, flushDirty, isSubmitted, mediaStop, stopAutoSave]);

  useEffect(() => {
    if (["submitted", "terminated", "expired"].includes(attemptStatus)) mediaStop();
  }, [attemptStatus, mediaStop]);

  useEffect(() => {
    const raw = localStorage.getItem(attemptKey);
    if (!raw) { setLoadError("No active attempt was selected. Resume it from My Exams."); setLoading(false); return; }
    try {
      const hint = JSON.parse(raw) as { examId?: string | number; attemptId?: number };
      if (String(hint.examId) !== String(examId) || !hint.attemptId) throw new Error();
      const load = async () => {
        // A navigation entry describes the Dashboard page load too. Only the
        // explicit Resume flow may turn a pending page refresh into a violation.
        const restored = await studentExamService.restore(examId, hint.attemptId!);
        setAttemptId(restored.attempt.attemptId); setAttemptStatus(restored.attempt.status); setExamTitle(restored.exam.title); setQuestions(restored.questions);
        const saved = restored.questions.reduce<StudentAnswers>((all, question) => question.savedAnswer ? { ...all, [question.id]: question.savedAnswer } : all, {});
        persistedAnsweredRef.current = new Set(
          restored.questions.filter((question) => isAnswered(saved[question.id])).map((question) => question.id),
        );
        const local = localStorage.getItem(draftKey(restored.attempt.attemptId));
        const draft = local ? JSON.parse(local) as StudentAnswers : {};
        answersRef.current = { ...saved, ...draft }; setAnswers(answersRef.current);
        setSettings(restored.settings); setAntiCheatEnabled(restored.antiCheatEnabled); setViolationCount(restored.violationCount); setViolationLimit(restored.violationLimit); setRemainingViolations(restored.antiCheatEnabled ? Math.max(restored.violationLimit - restored.violationCount, 0) : null);
        if (restored.settings.sequentialNavigation) {
          const firstUnanswered = restored.questions.findIndex((question) => !isAnswered(saved[question.id]));
          setCurrentQuestion(firstUnanswered === -1 ? Math.max(0, restored.questions.length - 1) : firstUnanswered);
        }
        fullscreenArmedRef.current = Boolean(document.fullscreenElement);
        setFullscreenLocked(restored.antiCheatEnabled && !document.fullscreenElement);
        const serverTime = Date.parse(restored.serverTime);
        const expiresAt = Date.parse(restored.expiresAt);
        if (!Number.isFinite(serverTime) || !Number.isFinite(expiresAt) || expiresAt <= 0) throw new Error("Invalid server timer response");
        serverOffsetRef.current = serverTime - Date.now();
        serverOffsetInitializedRef.current = true;
        expiresAtRef.current = expiresAt;
        setTimeRemaining(restored.remainingSeconds);
        autoSubmitRef.current = false;
        hadPositiveTimerRef.current = restored.remainingSeconds > 0;
        setTimerReady(restored.attempt.status === "in_progress");
        if (restored.attempt.status !== "in_progress") stopAutoSave("Attempt is no longer in progress");
      };
      load().catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "Failed to restore attempt")).finally(() => setLoading(false));
    } catch { setLoadError("Invalid active attempt. Resume it from My Exams."); setLoading(false); }
  }, [examId, stopAutoSave]);

  useEffect(() => {
    if (!timerReady || loading || attemptId === null || attemptStatus !== "in_progress" || !serverOffsetInitializedRef.current || !Number.isFinite(expiresAtRef.current) || expiresAtRef.current <= 0) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((expiresAtRef.current - (Date.now() + serverOffsetRef.current)) / 1000));
      setTimeRemaining(remaining);
      if (remaining > 0) hadPositiveTimerRef.current = true;
      if (remaining === 0 && hadPositiveTimerRef.current && !autoSubmitRef.current) { autoSubmitRef.current = true; void submit(true); }
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
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
=======
  useAntiCheatMonitoring({
    active: antiCheatEnabled && attemptStatus === "in_progress" && Boolean(attemptId), examId, attemptId,
    onFullscreenLost: () => setFullscreenLocked(true), onEvent: handleAntiCheatEvent,
  });
>>>>>>> Stashed changes

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

<<<<<<< Updated upstream
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
    setSubmitError(null);

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
          attemptId,
          answers: answersPayload,
          timeSpentSeconds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('Submit failed:', data);
        setSubmitError(data.detail || data.message || 'Submit failed');
        return;
      } else {
        console.log('Submit success:', data);
      }
    } catch (err) {
      console.error('Submit error:', err);
      setSubmitError('Submit failed');
      return;
    }

    localStorage.removeItem('current_exam_attempt');
    setIsSubmitted(true);
  };

  const handleExitSubmitted = async () => {
    localStorage.removeItem('current_exam_attempt');
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

      {submitError && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 shadow-lg">
          {submitError}
        </div>
      )}

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
=======
  const answeredCount = questions.filter((question) => isAnswered(answers[question.id])).length;
  const unansweredQuestions = questions.filter((question) => !isAnswered(answers[question.id])).map((question) => question.id);
  const current = questions[currentQuestion];
  const currentAnswerIsValid = isAnswered(answers[current.id]);
  return <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 flex flex-col">
    <ExamTopBar examTitle={examTitle} timeRemaining={timeRemaining} onSubmit={() => setShowSubmitDialog(true)} antiCheatEnabled={antiCheatEnabled} violationCount={violationCount} violationLimit={violationLimit} />
    {media.stream && <WebcamMonitor stream={media.stream} cameraLive={media.cameraLive} microphoneLive={media.microphoneLive} monitoringStatus={media.recoveryRequired ? "recovery" : vision.overallStatus === "unavailable" || audio.status === "unavailable" ? "security-error" : media.cameraLive && media.microphoneLive && vision.overallStatus === "monitoring" && audio.status === "monitoring" ? "monitoring" : "starting"} visionStatus={vision.overallStatus} audioStatus={audio.status} />}
    <div className="flex-1 flex overflow-hidden"><div className="flex-1 overflow-y-auto p-6"><QuestionArea question={current} currentQuestion={currentQuestion} totalQuestions={questions.length} answer={answers[current.id]} onAnswerChange={handleAnswerChange} onPrevious={() => setCurrentQuestion((value) => Math.max(0, value - 1))} onNext={() => void handleNextQuestion()} sequentialNavigation={settings.sequentialNavigation} currentAnswerIsValid={currentAnswerIsValid} isSavingNext={isSavingNext} /></div>
      <QuestionPanel questions={questions} currentQuestion={currentQuestion} answers={answers} isOnline={isOnline} saveStatus={saveStatus} onQuestionSelect={setCurrentQuestion} answeredCount={answeredCount} unansweredQuestions={unansweredQuestions} sequentialNavigation={settings.sequentialNavigation} /></div>
    <SubmitConfirmDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog} onConfirm={() => { setShowSubmitDialog(false); void submit(); }} answeredCount={answeredCount} totalQuestions={questions.length} />
    {submitError && <div className="fixed bottom-4 right-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 shadow-lg">{submitError}</div>}
    {antiCheatEnabled && media.recoveryRequired && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6"><div className="max-w-md rounded-2xl bg-white p-7 text-center shadow-2xl"><h2 className="text-xl font-semibold text-slate-900">Camera and microphone recovery required</h2><p className="mt-3 text-sm leading-6 text-slate-600">Your attempt and answers remain open. Restore both live devices to continue monitoring.</p>{media.recoveryError && <p className="mt-3 text-sm text-red-600">{media.recoveryError}</p>}<button className="mt-6 rounded-lg bg-teal-600 px-5 py-3 font-medium text-white hover:bg-teal-700 disabled:opacity-60" onClick={() => void media.restore()} disabled={media.recovering}>{media.recovering ? "Restoring..." : "Restore Camera & Microphone"}</button></div></div>}
    {antiCheatEnabled && !media.recoveryRequired && (vision.overallStatus === "unavailable" || audio.status === "unavailable") && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6"><div className="max-w-md rounded-2xl bg-white p-7 text-center shadow-2xl"><h2 className="text-xl font-semibold text-slate-900">Security monitoring could not start</h2><p className="mt-3 text-sm leading-6 text-slate-600">{vision.overallStatus === "unavailable" ? "Vision monitoring could not start." : "Audio monitoring could not start."} Please retry the security check. Your attempt, answers, and timer remain unchanged.</p><div className="mt-6 flex justify-center gap-3"><button className="rounded-lg bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700" onClick={() => { if (monitoringRetryCount >= 3) { handleNormalExit(); return; } setMonitoringRetryCount((count) => count + 1); setMonitoringRetry((token) => token + 1); }}>{monitoringRetryCount >= 3 ? "Return to Dashboard" : "Retry Monitoring"}</button><button className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50" onClick={handleNormalExit}>Return to Dashboard</button></div></div></div>}
    <ViolationWarningDialog open={showViolationWarning} onOpenChange={setShowViolationWarning} eventType={violationType} violationCount={violationCount} violationLimit={violationLimit} remainingViolations={remainingViolations} terminated={isTerminated} countsTowardLimit={eventCountsTowardLimit} onReturnToFullscreen={violationType === "FULLSCREEN_EXIT" && !isTerminated ? () => void returnToFullscreen() : undefined} onTerminatedExit={exitAfterTermination} />
  </div>;
>>>>>>> Stashed changes
}
