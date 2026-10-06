import { QuestionPage } from "./QuestionPage";
import { questionPages, pageIndexForQuestion } from "./question-pages";
import { useCallback, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { ExamTopBar } from "./ExamTopBar";
import { QuestionArea } from "./QuestionArea";
import { QuestionPanel } from "./QuestionPanel";
import { SubmitConfirmDialog } from "./SubmitConfirmDialog";
import { ExamSubmitted } from "./ExamSubmitted";
import { ViolationWarningDialog } from "./ViolationWarningDialog";
import { WebcamMonitor } from "./WebcamMonitor";
import { studentExamService } from "../../services/student-exam.service";
import { attemptSessionStorage } from "../../services/attempt-session.storage";
import { useAntiCheatMonitoring } from "../../hooks/useAntiCheatMonitoring";
import { useIncidentReporter } from "../../anti-cheat/incident-reporter";
import { useAIAntiCheat } from "../../anti-cheat/use-ai-anti-cheat";
import { isBrowserMonitoringActive } from "../../anti-cheat/anti-cheat-lifecycle";
import type { AntiCheatRuntime } from "../../anti-cheat/anti-cheat-runtime";
import { defaultAntiCheatMeasures, isMonitoringGroupEnabled } from '../../anti-cheat/measure-policy';
import { requestFullscreenOrThrow } from "../../utils/fullscreen";
import type { StudentAnswer, StudentAnswers, StudentExamSettings, StudentQuestion } from "../../types/student-exam";

interface ExamInterfaceProps {
  examId: string;
  onExit: () => void;
  mediaStream?: MediaStream;
  preloadedAntiCheatRuntime?: AntiCheatRuntime;
  refreshViolationRecorded?: boolean;
}

const attemptKey = "current_exam_attempt";
const draftKey = (attemptId: number) => `exam_attempt_draft_${attemptId}`;
const markedQuestionsKey = (attemptId: number) => `exam_attempt_marked_questions_${attemptId}`;

const isAnswered = (answer: StudentAnswer | undefined) =>
  Boolean(answer && ("selectedOptionId" in answer || answer.answerText.trim()));

export function ExamInterface({ examId, onExit, mediaStream, preloadedAntiCheatRuntime, refreshViolationRecorded = false }: ExamInterfaceProps) {
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [answers, setAnswers] = useState<StudentAnswers>({});
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [examTitle, setExamTitle] = useState("Exam");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [saveStatus, setSaveStatus] = useState("Ready");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showEssayGradingNote, setShowEssayGradingNote] = useState(false);
  const [attemptStatus, setAttemptStatus] = useState("initializing");
  const [timerReady, setTimerReady] = useState(false);
  const [isTerminated, setIsTerminated] = useState(false);
  const [isTeacherLocked, setIsTeacherLocked] = useState(false);
  const [teacherTerminationReason, setTeacherTerminationReason] = useState<string | null>(null);
  const [violationType, setViolationType] = useState<string>("");
  // The aggregate count is useful telemetry, but only the event-type count is
  // compared with a measure's threshold and can end an attempt.
  const [violationCount, setViolationCount] = useState(0);
  const [measureViolationCount, setMeasureViolationCount] = useState(0);
  const [measureThreshold, setMeasureThreshold] = useState(5);
  const [remainingViolations, setRemainingViolations] = useState<number | null>(null);
  const [antiCheatEnabled, setAntiCheatEnabled] = useState(false);
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [fullscreenLocked, setFullscreenLocked] = useState(false);
  const [settings, setSettings] = useState<StudentExamSettings>({ autoSubmitOnExpire: true, sequentialNavigation: false, antiCheatEnabled: false, violationLimit: 5, antiCheatMeasures: defaultAntiCheatMeasures() });
  const [isSavingNext, setIsSavingNext] = useState(false);
  const [markedQuestionIds, setMarkedQuestionIds] = useState<number[]>([]);

  const answersRef = useRef<StudentAnswers>({});
  const persistedAnsweredRef = useRef(new Set<number>());
  const dirtyRef = useRef(new Set<number>());
  const sequenceRef = useRef(new Map<number, number>());
  const revisionRef = useRef(new Map<number, number>());
  const essayTimersRef = useRef(new Map<number, number>());
  const expiresAtRef = useRef(0);
  const serverOffsetRef = useRef(0);
  const serverOffsetInitializedRef = useRef(false);
  const autoSubmitRef = useRef(false);
  const hadPositiveTimerRef = useRef(false);
  const fullscreenArmedRef = useRef(false);
  const intentionalFullscreenExitRef = useRef(false);
  const nextInFlightRef = useRef(false);
  const terminatedRedirectRef = useRef<number | null>(null);
  const refreshWarningShownRef = useRef(false);
  const examEndingRef = useRef(false);

  // Both flags matter: examEnding covers submit/termination, and the exit ref
  // covers a deliberate exit, which is cleared a tick after fullscreenchange.
  const shouldIgnoreAntiCheatEvents = useCallback(
    () => examEndingRef.current || intentionalFullscreenExitRef.current,
    [],
  );

  const exitFullscreenIntentionally = useCallback(async () => {
    if (!document.fullscreenElement) return;
    intentionalFullscreenExitRef.current = true;
    try {
      await document.exitFullscreen();
    } finally {
      window.setTimeout(() => { intentionalFullscreenExitRef.current = false; }, 0);
    }
  }, []);

  const handleNormalExit = useCallback(() => {
    void exitFullscreenIntentionally().finally(onExit);
  }, [exitFullscreenIntentionally, onExit]);

  const exitAfterTermination = useCallback(() => {
    if (terminatedRedirectRef.current) window.clearTimeout(terminatedRedirectRef.current);
    terminatedRedirectRef.current = null;
    void exitFullscreenIntentionally().finally(onExit);
  }, [exitFullscreenIntentionally, onExit]);

  useEffect(() => () => {
    if (terminatedRedirectRef.current) window.clearTimeout(terminatedRedirectRef.current);
  }, []);

  useEffect(() => {
    if (attemptId && !loading) localStorage.setItem(`attempt-page:${attemptId}`, String(currentQuestion));
  }, [attemptId, currentQuestion, loading]);

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

  const handleTeacherLock = useCallback((message = "This attempt was locked by your teacher.") => {
    // Keep the secure session alive. The same heartbeat that reported the lock
    // keeps polling, allowing an unlock to resume this exact attempt.
    examEndingRef.current = true;
    setIsTeacherLocked(true);
    setShowSubmitDialog(false);
    stopAutoSave(message);
  }, [stopAutoSave]);

  const handleTeacherUnlock = useCallback(() => {
    examEndingRef.current = false;
    setIsTeacherLocked(false);
    setSubmitError(null);
    setSaveStatus("Ready");
    setTimerReady(true);
  }, []);

  const handleTeacherTermination = useCallback((reason?: string | null) => {
    examEndingRef.current = true;
    setAttemptStatus("terminated");
    setIsTerminated(true);
    setIsTeacherLocked(false);
    setTeacherTerminationReason((reason ?? "").replace(/^teacher_terminated:\s*/i, "") || null);
    setShowSubmitDialog(false);
    setSubmitError(null);
    stopAutoSave();
    localStorage.removeItem(attemptKey);
    if (attemptId) {
      localStorage.removeItem(draftKey(attemptId));
      localStorage.removeItem(markedQuestionsKey(attemptId));
    }
    mediaStream?.getTracks().forEach((track) => track.stop());
    void exitFullscreenIntentionally();
    setShowViolationWarning(true);
  }, [attemptId, exitFullscreenIntentionally, mediaStream, stopAutoSave]);

  const checkForTeacherTermination = useCallback(async () => {
    if (!attemptId) return false;
    const state = await studentExamService.heartbeat(examId, attemptId);
    if (state.attemptStatus === "terminated" && state.terminationSource === "teacher") {
      handleTeacherTermination(state.terminationReason);
      return true;
    }
    // A locked attempt receives a 403 heartbeat response. Therefore a later
    // successful in-progress heartbeat is authoritative proof it was unlocked.
    if (isTeacherLocked && state.attemptStatus === "in_progress") handleTeacherUnlock();
    return false;
  }, [attemptId, examId, handleTeacherTermination, handleTeacherUnlock, isTeacherLocked]);

  const saveQuestion = useCallback(async (questionId: number, force = false): Promise<boolean> => {
    if (!attemptId || attemptStatus !== "in_progress" || !navigator.onLine) return false;
    if (!dirtyRef.current.has(questionId) && !force) return true;
    const answer = answersRef.current[questionId];
    if (!answer) return false;
    const sequence = (sequenceRef.current.get(questionId) ?? 0) + 1;
    sequenceRef.current.set(questionId, sequence);
    const revision = (revisionRef.current.get(questionId) ?? 0) + 1;
    revisionRef.current.set(questionId, revision);
    setSaveStatus("Saving");
    try {
      const result = await studentExamService.saveAnswer(examId, attemptId, questionId, answer, revision);
      if (sequenceRef.current.get(questionId) === sequence) {
        if (result.stale) {
          revisionRef.current.set(questionId, Math.max(revisionRef.current.get(questionId) ?? 0, result.storedRevision));
          dirtyRef.current.add(questionId);
          setSaveStatus("Changes pending");
          return false;
        }
        dirtyRef.current.delete(questionId);
        if (isAnswered(answer)) persistedAnsweredRef.current.add(questionId);
        else persistedAnsweredRef.current.delete(questionId);
        setSaveStatus(dirtyRef.current.size ? "Saving" : "Saved");
        return true;
      }
      return false;
    } catch (error) {
      if (sequenceRef.current.get(questionId) === sequence) {
        setSaveStatus("Save failed");
        const message = error instanceof Error ? error.message : "Save failed";
        if (message === "Attempt is locked by teacher") {
          handleTeacherLock(message);
        } else if (message === "Attempt has expired" || message === "Attempt is no longer in progress") {
          void checkForTeacherTermination().catch(() => {
            setAttemptStatus("expired");
            stopAutoSave(message);
          });
        } else {
          setSubmitError(message);
        }
      }
      return false;
    }
  }, [attemptId, attemptStatus, checkForTeacherTermination, examId, handleTeacherLock, stopAutoSave]);

  const flushDirty = useCallback(async () => {
    await Promise.all([...dirtyRef.current].map(id => saveQuestion(id)));
  }, [saveQuestion]);

  useEffect(() => {
    if (!attemptId || attemptStatus !== "in_progress") return undefined;
    const heartbeat = () => {
      void checkForTeacherTermination().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Attempt session is invalid. Resume from My Exams.";
        if (message === "Attempt is locked by teacher") handleTeacherLock(message);
        else stopAutoSave(message);
      });
    };
    heartbeat();
    const interval = window.setInterval(heartbeat, 10_000);
    return () => window.clearInterval(interval);
  }, [attemptId, attemptStatus, checkForTeacherTermination, handleTeacherLock, stopAutoSave]);

  const submit = useCallback(async (automatic = false) => {
    if (!attemptId || attemptStatus !== "in_progress" || isSubmitted) return;
    setSubmitError(null);
    await flushDirty();
    try {
      const submitRequestId = attemptSessionStorage.getOrCreateSubmitRequestId(attemptId);
      const result = await studentExamService.submit(examId, attemptId, answersRef.current, submitRequestId);
      localStorage.removeItem(attemptKey);
      localStorage.removeItem(draftKey(attemptId));
      localStorage.removeItem(markedQuestionsKey(attemptId));
      setAttemptStatus("submitted");
      stopAutoSave();
      setShowEssayGradingNote(result.resultVisibility !== "hidden" && result.essayPending);
      setIsSubmitted(true);
      examEndingRef.current = true;
      mediaStream?.getTracks().forEach((track) => track.stop());
      void exitFullscreenIntentionally();
    } catch (error) {
      const message = error instanceof Error ? error.message : automatic ? "Auto-submit failed" : "Submit failed";
      if (message === "Attempt is locked by teacher") handleTeacherLock(message);
      else setSubmitError(message);
    }
  }, [attemptId, attemptStatus, examId, exitFullscreenIntentionally, flushDirty, handleTeacherLock, isSubmitted, stopAutoSave]);

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
        revisionRef.current = new Map(
          restored.questions.map((question) => [question.id, question.savedAnswer?.revision ?? 0]),
        );
        const local = localStorage.getItem(draftKey(restored.attempt.attemptId));
        const draft = local ? JSON.parse(local) as StudentAnswers : {};
        answersRef.current = { ...saved, ...draft }; setAnswers(answersRef.current);
        const storedMarks = localStorage.getItem(markedQuestionsKey(restored.attempt.attemptId));
        const questionIds = new Set(restored.questions.map((question) => question.id));
        let markedIds: number[] = [];
        try {
          markedIds = storedMarks ? (JSON.parse(storedMarks) as unknown[]).filter((id): id is number => typeof id === "number" && questionIds.has(id)) : [];
        } catch {
          localStorage.removeItem(markedQuestionsKey(restored.attempt.attemptId));
        }
        setMarkedQuestionIds(markedIds);
        setSettings(restored.settings);
        setAntiCheatEnabled(restored.antiCheatEnabled);
        setViolationCount(restored.violationCount);
        // Restore has no "last event" context. A later warning receives the
        // authoritative per-measure values from the event response.
        setMeasureViolationCount(0);
        setMeasureThreshold(restored.violationLimit);
        setRemainingViolations(null);
        if (!restored.settings.sequentialNavigation) {
          const savedIndex = Number(localStorage.getItem(`attempt-page:${restored.attempt.attemptId}`) ?? 0);
          setCurrentQuestion(Number.isInteger(savedIndex) && savedIndex >= 0 && savedIndex < restored.questions.length ? savedIndex : 0);
        }
        if (restored.settings.sequentialNavigation) {
          const firstUnanswered = restored.questions.findIndex((question) => !isAnswered(saved[question.id]));
          setCurrentQuestion(firstUnanswered === -1 ? Math.max(0, restored.questions.length - 1) : firstUnanswered);
        }
        fullscreenArmedRef.current = Boolean(document.fullscreenElement);
        setFullscreenLocked(restored.antiCheatEnabled && isMonitoringGroupEnabled(restored.settings.antiCheatMeasures, 'browser') && !document.fullscreenElement);
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
    if (!refreshViolationRecorded || refreshWarningShownRef.current || loading || !antiCheatEnabled) return;
    refreshWarningShownRef.current = true;
    setViolationType("PAGE_REFRESH");
    setShowViolationWarning(true);
  }, [antiCheatEnabled, loading, refreshViolationRecorded]);

  useEffect(() => {
    if (!timerReady || loading || attemptId === null || attemptStatus !== "in_progress" || !serverOffsetInitializedRef.current || !Number.isFinite(expiresAtRef.current) || expiresAtRef.current <= 0) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((expiresAtRef.current - (Date.now() + serverOffsetRef.current)) / 1000));
      setTimeRemaining(remaining);
      if (remaining > 0) hadPositiveTimerRef.current = true;
      if (remaining === 0 && hadPositiveTimerRef.current && !autoSubmitRef.current) { autoSubmitRef.current = true; void submit(true); }
    };
    tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer);
  }, [attemptId, attemptStatus, loading, submit, timerReady]);

  useEffect(() => {
    if (attemptStatus !== "in_progress") return;
    const online = () => { setIsOnline(true); setSaveStatus("Saving"); void flushDirty(); };
    const offline = () => { setIsOnline(false); setSaveStatus("Offline - changes pending"); };
    window.addEventListener("online", online); window.addEventListener("offline", offline);
    const flushTimer = window.setInterval(() => void flushDirty(), 30_000);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); window.clearInterval(flushTimer); };
  }, [attemptStatus, flushDirty]);

  const handleAnswerChange = (questionId: number, answer: StudentAnswer) => {
    if (attemptStatus !== "in_progress" || fullscreenLocked || isTeacherLocked) return;
    const next = { ...answersRef.current, [questionId]: answer };
    answersRef.current = next; setAnswers(next); dirtyRef.current.add(questionId);
    if (attemptId) persistDraft(attemptId, next);
    if (!navigator.onLine) { setSaveStatus("Offline - changes pending"); return; }
    const question = questions.find((item) => item.id === questionId);
    if (question?.type === "essay") {
      const previous = essayTimersRef.current.get(questionId); if (previous) window.clearTimeout(previous);
      essayTimersRef.current.set(questionId, window.setTimeout(() => void saveQuestion(questionId), 800));
    } else { void saveQuestion(questionId); }
  };

  const handleNextQuestion = useCallback(async () => {
    const pages = questionPages(questions, settings.questionsPerPage);
    const pageIndex = pageIndexForQuestion(pages, questions[currentQuestion]?.id);
    if (pageIndex >= pages.length - 1 || nextInFlightRef.current) return;
    if (settings.sequentialNavigation) {
      if (!pages[pageIndex].every(q => isAnswered(answersRef.current[q.id]))) return;
      if (!navigator.onLine) { setSubmitError("You must be online to save and continue."); return; }
      nextInFlightRef.current = true; setIsSavingNext(true);
      for (const question of pages[pageIndex]) {
        const timer = essayTimersRef.current.get(question.id);
        if (timer) { window.clearTimeout(timer); essayTimersRef.current.delete(question.id); }
        if (dirtyRef.current.has(question.id) || !persistedAnsweredRef.current.has(question.id)) {
          if (!await saveQuestion(question.id, !dirtyRef.current.has(question.id))) { nextInFlightRef.current = false; setIsSavingNext(false); return; }
        }
      }
      nextInFlightRef.current = false; setIsSavingNext(false);
    }
    setCurrentQuestion(questions.findIndex(q => q.id === pages[pageIndex + 1][0].id));
  }, [currentQuestion, questions, saveQuestion, settings.sequentialNavigation, settings.questionsPerPage]);

  const toggleMarkedQuestion = useCallback((questionId: number) => {
    if (!attemptId) return;
    setMarkedQuestionIds((currentMarks) => {
      const nextMarks = currentMarks.includes(questionId)
        ? currentMarks.filter((id) => id !== questionId)
        : [...currentMarks, questionId];
      localStorage.setItem(markedQuestionsKey(attemptId), JSON.stringify(nextMarks));
      return nextMarks;
    });
  }, [attemptId]);

  const returnToFullscreen = async () => {
    setSubmitError(null);
    try {
      // This is called only by an explicit user action from the blocking gate.
      await requestFullscreenOrThrow();
      setFullscreenLocked(false);
      setShowViolationWarning(false);
    } catch (error) {
      setFullscreenLocked(true);
      setSubmitError(error instanceof Error ? error.message : "Fullscreen permission is required to continue this exam.");
    }
  };

  const handleAntiCheatEvent = useCallback((event: {
    violationCount: number;
    violationLimit: number;
    measureViolationCount?: number | null;
    measureThreshold?: number | null;
    remainingViolations: number | null;
    terminated: boolean;
  }, eventType: string) => {
    const eventCount = event.measureViolationCount ?? event.violationCount;
    const eventThreshold = event.measureThreshold ?? event.violationLimit;
    setViolationType(eventType);
    setViolationCount(event.violationCount);
    setMeasureViolationCount(eventCount);
    setMeasureThreshold(eventThreshold);
    setRemainingViolations(event.remainingViolations);
    setShowViolationWarning(true);
    if (event.terminated) {
      setAttemptStatus("terminated"); setIsTerminated(true); stopAutoSave();
      examEndingRef.current = true;
      localStorage.removeItem(attemptKey);
      if (attemptId) {
        localStorage.removeItem(draftKey(attemptId));
        localStorage.removeItem(markedQuestionsKey(attemptId));
      }
      mediaStream?.getTracks().forEach((track) => track.stop());
      terminatedRedirectRef.current = window.setTimeout(exitAfterTermination, 2_500);
    }
  }, [attemptId, exitAfterTermination, mediaStream, stopAutoSave]);

  const cameraMonitoringEnabled = isMonitoringGroupEnabled(settings.antiCheatMeasures, 'camera');
  const microphoneMonitoringEnabled = isMonitoringGroupEnabled(settings.antiCheatMeasures, 'microphone');
  const browserMonitoringEnabled = isMonitoringGroupEnabled(settings.antiCheatMeasures, 'browser');
  const aiRuntimeActive = antiCheatEnabled && (cameraMonitoringEnabled || microphoneMonitoringEnabled) && attemptStatus === "in_progress" && Boolean(attemptId);
  const incidentReporter = useIncidentReporter({
    active: antiCheatEnabled && attemptStatus === "in_progress" && Boolean(attemptId),
    examId,
    attemptId,
    onEvent: handleAntiCheatEvent,
  });
  const aiRuntime = useAIAntiCheat({
    active: aiRuntimeActive,
    mediaStream,
    reporter: incidentReporter,
    preloadedRuntime: preloadedAntiCheatRuntime,
    requiresCamera: cameraMonitoringEnabled,
    requiresMicrophone: microphoneMonitoringEnabled,
  });

  useAntiCheatMonitoring({
    active: isBrowserMonitoringActive(antiCheatEnabled && browserMonitoringEnabled, attemptStatus, Boolean(attemptId)), examId, attemptId,
    reporter: incidentReporter,
    shouldIgnoreEvents: shouldIgnoreAntiCheatEvents,
    // Open the dialog here rather than waiting for the violation report to resolve:
    // answering is blocked until fullscreen returns, so a slow or failed report
    // would otherwise leave no way back. The report still updates the counts below.
    onFullscreenLost: () => {
      setFullscreenLocked(true);
      setViolationType("FULLSCREEN_EXIT");
      setShowViolationWarning(true);
    },
    onMediaProblem: () => {
      setFullscreenLocked(true);
      aiRuntime.fail("Camera or microphone access was lost. Restore monitoring before continuing.");
    },
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading exam...</div>;
  if (loadError || !questions.length) return <div className="min-h-screen flex flex-col gap-4 items-center justify-center"><p className="text-red-600">{loadError ?? "No questions found."}</p><button onClick={handleNormalExit}>Back</button></div>;
  if (isSubmitted) return <ExamSubmitted onExit={handleNormalExit} showEssayGradingNote={showEssayGradingNote} />;
  if (isTeacherLocked) return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-slate-100 p-6"><div className="max-w-md rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-xl"><Lock className="mx-auto size-10 text-amber-600" /><h1 className="mt-4 text-xl font-semibold text-slate-900">Attempt locked by teacher</h1><p className="mt-3 text-sm leading-6 text-slate-600">Your teacher has temporarily paused this attempt. You cannot save answers or submit until it is unlocked.</p><button className="mt-6 rounded-lg bg-slate-800 px-5 py-3 text-sm font-medium text-white hover:bg-slate-700" onClick={handleNormalExit}>Return to Dashboard</button></div></div>;

  if (aiRuntimeActive && aiRuntime.readiness === "error") return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-teal-950 to-slate-900 p-6"><div className="max-w-md rounded-2xl border border-teal-300/30 bg-white p-8 text-center shadow-2xl"><h1 className="text-xl font-semibold text-slate-900">Security runtime error</h1><p className="mt-3 text-sm leading-6 text-slate-600">Anti-cheat monitoring was interrupted. Restore camera and audio monitoring to continue the exam.</p><div className="mt-6 flex gap-3"><button className="flex-1 rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50" onClick={handleNormalExit}>Return to Dashboard</button><button className="flex-1 rounded-lg bg-teal-600 px-5 py-3 font-medium text-white hover:bg-teal-700" onClick={aiRuntime.retry}>Retry</button></div></div></div>;
  if (aiRuntimeActive && aiRuntime.readiness === "loading") return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-teal-950 to-slate-900 p-6"><div className="max-w-md rounded-2xl border border-teal-300/30 bg-white p-8 text-center shadow-2xl"><h1 className="text-xl font-semibold text-slate-900">Preparing secure exam</h1><p className="mt-3 text-sm leading-6 text-slate-600">Camera and microphone monitoring are being initialized. Please wait.</p></div></div>;

  // A restored attempt can also land here out of fullscreen, with no violation
  // to announce - the gate has to follow the lock, not the warning.
  const fullscreenGateOpen = fullscreenLocked && antiCheatEnabled && browserMonitoringEnabled && !isTerminated;
  const answeredCount = questions.filter((question) => isAnswered(answers[question.id])).length;
  const unansweredQuestions = questions.filter((question) => !isAnswered(answers[question.id])).map((question) => question.id);
  const current = questions[currentQuestion];
  const pages = questionPages(questions, settings.questionsPerPage);
  const pageIndex = pageIndexForQuestion(pages, current.id);
  const pageQuestions = pages[pageIndex];
  const currentAnswerIsValid = pageQuestions.every(q => isAnswered(answers[q.id]));
  return <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 flex flex-col">
    <ExamTopBar examTitle={examTitle} timeRemaining={timeRemaining} onSubmit={() => setShowSubmitDialog(true)} antiCheatEnabled={antiCheatEnabled} violationCount={violationCount} />
    {mediaStream && cameraMonitoringEnabled && <WebcamMonitor stream={mediaStream} />}
    <div className="flex-1 flex overflow-hidden"><div className="flex-1 overflow-y-auto p-4 sm:p-6"><QuestionPage questions={pageQuestions} allQuestions={questions} answers={answers} marked={markedQuestionIds} onAnswerChange={handleAnswerChange} onToggleMark={toggleMarkedQuestion} /><div className="mx-auto mt-6 flex w-full max-w-7xl justify-between"><button type="button" disabled={settings.sequentialNavigation || pageIndex === 0} onClick={() => setCurrentQuestion(questions.findIndex(q => q.id === pages[pageIndex - 1][0].id))}>Previous page</button><span>Page {pageIndex + 1} / {pages.length}</span><button type="button" disabled={pageIndex === pages.length - 1 || (settings.sequentialNavigation && (!currentAnswerIsValid || isSavingNext))} onClick={() => void handleNextQuestion()}>{isSavingNext ? 'Saving…' : 'Next page'}</button></div></div>
      <QuestionPanel questions={questions} currentQuestion={currentQuestion} answers={answers} isOnline={isOnline} saveStatus={saveStatus} currentPageQuestionIds={pageQuestions.map(q => q.id)} onQuestionSelect={setCurrentQuestion} answeredCount={answeredCount} unansweredQuestions={unansweredQuestions} sequentialNavigation={settings.sequentialNavigation} markedQuestionIds={markedQuestionIds} /></div>
    <SubmitConfirmDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog} onConfirm={() => { setShowSubmitDialog(false); void submit(); }} answeredCount={answeredCount} totalQuestions={questions.length} />
    {submitError && <div className="fixed bottom-4 right-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 shadow-lg">{submitError}</div>}
    {/* This dialog is the whole fullscreen gate: while locked it stays open, its
        only button is Return to Fullscreen, and answering is blocked underneath. */}
    <ViolationWarningDialog open={showViolationWarning || fullscreenGateOpen} onOpenChange={setShowViolationWarning} eventType={violationType} measureViolationCount={measureViolationCount} measureThreshold={measureThreshold} remainingViolations={remainingViolations} terminated={isTerminated} teacherTerminationReason={teacherTerminationReason} onReturnToFullscreen={(violationType === "FULLSCREEN_EXIT" || fullscreenGateOpen) && !isTerminated ? () => void returnToFullscreen() : undefined} onTerminatedExit={exitAfterTermination} error={fullscreenGateOpen ? submitError : null} />
  </div>;
}
