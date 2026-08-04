import { useCallback, useEffect, useRef, useState } from "react";
import { ExamTopBar } from "./ExamTopBar";
import { QuestionArea } from "./QuestionArea";
import { QuestionPanel } from "./QuestionPanel";
import { SubmitConfirmDialog } from "./SubmitConfirmDialog";
import { ExamSubmitted } from "./ExamSubmitted";
import { ViolationWarningDialog } from "./ViolationWarningDialog";
import { studentExamService } from "../../services/student-exam.service";
import type { StudentAnswer, StudentAnswers, StudentExamSettings, StudentQuestion } from "../../types/student-exam";

interface ExamInterfaceProps {
  examId: string;
  onExit: () => void;
}

const attemptKey = "current_exam_attempt";
const draftKey = (attemptId: number) => `exam_attempt_draft_${attemptId}`;

const isAnswered = (answer: StudentAnswer | undefined) =>
  Boolean(answer && ("selectedOptionId" in answer || answer.answerText.trim()));

export function ExamInterface({ examId, onExit }: ExamInterfaceProps) {
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
  const [isTerminating, setIsTerminating] = useState(false);
  const [terminationFailed, setTerminationFailed] = useState(false);
  const [attemptStatus, setAttemptStatus] = useState("initializing");
  const [timerReady, setTimerReady] = useState(false);
  const [isTerminated, setIsTerminated] = useState(false);
  const [warnings, setWarnings] = useState(0);
  const [violationType, setViolationType] = useState<"copy-paste" | "tab-switch" | "fullscreen-exit" | "final">("copy-paste");
  const [violationCount, setViolationCount] = useState(0);
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [fullscreenLocked, setFullscreenLocked] = useState(false);
  const [settings, setSettings] = useState<StudentExamSettings>({ autoSubmitOnExpire: true, sequentialNavigation: false, tabSwitchThreshold: 0, copyPasteThreshold: 0, fullscreenExitThreshold: 0 });
  const [isSavingNext, setIsSavingNext] = useState(false);

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
  const terminateRef = useRef(false);
  const lastTabViolationRef = useRef(0);
  const fullscreenArmedRef = useRef(false);
  const intentionalFullscreenExitRef = useRef(false);
  const nextInFlightRef = useRef(false);

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
      }
      return false;
    } catch (error) {
      if (sequenceRef.current.get(questionId) === sequence) {
        setSaveStatus("Save failed");
        const message = error instanceof Error ? error.message : "Save failed";
        if (message === "Attempt has expired" || message === "Attempt is no longer in progress") {
          setAttemptStatus("expired");
          stopAutoSave(message);
        } else {
          setSubmitError(message);
        }
      }
      return false;
    }
  }, [attemptId, attemptStatus, examId, stopAutoSave]);

  const flushDirty = useCallback(async () => {
    await Promise.all([...dirtyRef.current].map(saveQuestion));
  }, [saveQuestion]);

  const submit = useCallback(async (automatic = false) => {
    if (!attemptId || attemptStatus !== "in_progress" || isSubmitted || isTerminating || terminationFailed) return;
    setSubmitError(null);
    await flushDirty();
    try {
      await studentExamService.submit(examId, attemptId, answersRef.current);
      localStorage.removeItem(attemptKey);
      localStorage.removeItem(draftKey(attemptId));
      setAttemptStatus("submitted");
      stopAutoSave();
      setIsSubmitted(true);
      void exitFullscreenIntentionally();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : automatic ? "Auto-submit failed" : "Submit failed");
    }
  }, [attemptId, attemptStatus, examId, exitFullscreenIntentionally, flushDirty, isSubmitted, isTerminating, terminationFailed, stopAutoSave]);

  const terminate = useCallback(async (type: string) => {
    if (!attemptId || terminateRef.current) return;
    terminateRef.current = true;
    setIsTerminating(true);
    setTerminationFailed(false);
    setSubmitError(null);
    await flushDirty();
    try {
      await studentExamService.terminate(examId, attemptId, "anti_cheat", type, answersRef.current);
      localStorage.removeItem(attemptKey);
      localStorage.removeItem(draftKey(attemptId));
      setAttemptStatus("terminated");
      stopAutoSave();
      setIsTerminated(true);
      setViolationType("final");
      setShowViolationWarning(true);
      void exitFullscreenIntentionally();
      window.setTimeout(handleNormalExit, 1500);
    } catch (error) {
      terminateRef.current = false;
      setTerminationFailed(true);
      setSubmitError(error instanceof Error ? error.message : "Termination failed. Retry while the exam remains locked.");
    } finally {
      setIsTerminating(false);
    }
  }, [attemptId, examId, exitFullscreenIntentionally, flushDirty, handleNormalExit, stopAutoSave]);

  useEffect(() => {
    const raw = localStorage.getItem(attemptKey);
    if (!raw) { setLoadError("No active attempt was selected. Resume it from My Exams."); setLoading(false); return; }
    try {
      const hint = JSON.parse(raw) as { examId?: string | number; attemptId?: number };
      if (String(hint.examId) !== String(examId) || !hint.attemptId) throw new Error();
      const load = async () => {
        const restored = await studentExamService.restore(examId, hint.attemptId!);
        setAttemptId(restored.attempt.attemptId); setAttemptStatus(restored.attempt.status); setExamTitle(restored.exam.title); setQuestions(restored.questions);
        const saved = restored.questions.reduce<StudentAnswers>((all, question) => question.savedAnswer ? { ...all, [question.id]: question.savedAnswer } : all, {});
        persistedAnsweredRef.current = new Set(
          restored.questions.filter((question) => isAnswered(saved[question.id])).map((question) => question.id),
        );
        const local = localStorage.getItem(draftKey(restored.attempt.attemptId));
        const draft = local ? JSON.parse(local) as StudentAnswers : {};
        answersRef.current = { ...saved, ...draft }; setAnswers(answersRef.current);
        setSettings(restored.settings);
        if (restored.settings.sequentialNavigation) {
          const firstUnanswered = restored.questions.findIndex((question) => !isAnswered(saved[question.id]));
          setCurrentQuestion(firstUnanswered === -1 ? Math.max(0, restored.questions.length - 1) : firstUnanswered);
        }
        fullscreenArmedRef.current = Boolean(document.fullscreenElement);
        setFullscreenLocked(restored.settings.fullscreenExitThreshold > 0 && !document.fullscreenElement);
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
    if (attemptStatus !== "in_progress" || isTerminating || terminationFailed || fullscreenLocked) return;
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
    if (!settings.sequentialNavigation) {
      setCurrentQuestion((value) => Math.min(questions.length - 1, value + 1));
      return;
    }
    if (nextInFlightRef.current || currentQuestion >= questions.length - 1) return;
    const question = questions[currentQuestion];
    if (!question || !isAnswered(answersRef.current[question.id])) return;
    const essayTimer = essayTimersRef.current.get(question.id);
    if (essayTimer) {
      window.clearTimeout(essayTimer);
      essayTimersRef.current.delete(question.id);
    }
    if (!navigator.onLine) {
      setSaveStatus("Offline - changes pending");
      setSubmitError("You must be online to save and continue.");
      return;
    }
    nextInFlightRef.current = true;
    const needsSave = dirtyRef.current.has(question.id) || !persistedAnsweredRef.current.has(question.id);
    if (needsSave) {
      setIsSavingNext(true);
      const saved = await saveQuestion(question.id, !dirtyRef.current.has(question.id));
      setIsSavingNext(false);
      if (!saved) {
        nextInFlightRef.current = false;
        return;
      }
    }
    setCurrentQuestion((value) => Math.min(questions.length - 1, value + 1));
    nextInFlightRef.current = false;
  }, [currentQuestion, questions, saveQuestion, settings.sequentialNavigation]);

  const handleViolation = useCallback((type: "copy-paste" | "tab-switch" | "fullscreen-exit") => {
    const threshold = type === "copy-paste" ? settings.copyPasteThreshold : type === "tab-switch" ? settings.tabSwitchThreshold : settings.fullscreenExitThreshold;
    if (!threshold || isSubmitted || isTerminated || isTerminating || terminationFailed) return;
    setWarnings((value) => value + 1); setViolationType(type);
    setViolationCount((value) => { const next = value + 1; if (next >= threshold) void terminate(type); else setShowViolationWarning(true); return next; });
  }, [isSubmitted, isTerminated, isTerminating, terminationFailed, settings, terminate]);

  const returnToFullscreen = async () => {
    setSubmitError(null);
    try {
      // This is called only by an explicit user action from the blocking gate.
      await document.documentElement.requestFullscreen();
      fullscreenArmedRef.current = true;
      setFullscreenLocked(false);
      setShowViolationWarning(false);
    } catch {
      setFullscreenLocked(true);
      setSubmitError("Fullscreen permission is required to continue this exam.");
    }
  };

  const fullscreenRequired = settings.fullscreenExitThreshold > 0;

  useEffect(() => {
    const fullscreen = () => {
      if (document.fullscreenElement) {
        if (fullscreenRequired && attemptStatus === "in_progress") {
          fullscreenArmedRef.current = true;
          setFullscreenLocked(false);
        }
        return;
      }
      if (intentionalFullscreenExitRef.current || !fullscreenRequired || !fullscreenArmedRef.current || attemptStatus !== "in_progress") return;
      setFullscreenLocked(true);
      handleViolation("fullscreen-exit");
    };
    document.addEventListener("fullscreenchange", fullscreen);
    return () => document.removeEventListener("fullscreenchange", fullscreen);
  }, [attemptStatus, fullscreenRequired, handleViolation]);

  useEffect(() => {
    const tabEvent = () => { if (document.hidden || document.hasFocus() === false) { const now = Date.now(); if (now - lastTabViolationRef.current > 750) { lastTabViolationRef.current = now; handleViolation("tab-switch"); } } };
    document.addEventListener("visibilitychange", tabEvent); window.addEventListener("blur", tabEvent);
    return () => { document.removeEventListener("visibilitychange", tabEvent); window.removeEventListener("blur", tabEvent); };
  }, [handleViolation]);

  useEffect(() => {
    const copy = (event: ClipboardEvent) => { event.preventDefault(); handleViolation("copy-paste"); };
    document.addEventListener("copy", copy); document.addEventListener("paste", copy); document.addEventListener("cut", copy);
    return () => { document.removeEventListener("copy", copy); document.removeEventListener("paste", copy); document.removeEventListener("cut", copy); };
  }, [handleViolation]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading exam...</div>;
  if (loadError || !questions.length) return <div className="min-h-screen flex flex-col gap-4 items-center justify-center"><p className="text-red-600">{loadError ?? "No questions found."}</p><button onClick={handleNormalExit}>Back</button></div>;
  if (isSubmitted) return <ExamSubmitted onExit={handleNormalExit} />;

  if (fullscreenLocked && fullscreenRequired) return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-teal-950 to-slate-900 p-6"><div className="max-w-md rounded-2xl border border-teal-300/30 bg-white p-8 text-center shadow-2xl"><h1 className="text-xl font-semibold text-slate-900">Fullscreen required</h1><p className="mt-3 text-sm leading-6 text-slate-600">Return to fullscreen to continue answering. Leaving fullscreen is recorded as an exam violation.</p><button className="mt-6 rounded-lg bg-teal-600 px-5 py-3 font-medium text-white hover:bg-teal-700" onClick={() => void returnToFullscreen()}>Return to Fullscreen</button>{submitError && <p className="mt-4 text-sm text-red-600">{submitError}</p>}</div><ViolationWarningDialog open={showViolationWarning} onOpenChange={setShowViolationWarning} violationType={violationType} violationCount={violationCount} threshold={settings.fullscreenExitThreshold} onReturnToFullscreen={violationType === "fullscreen-exit" && !isTerminated ? () => void returnToFullscreen() : undefined} /></div>;

  const answeredCount = questions.filter((question) => isAnswered(answers[question.id])).length;
  const unansweredQuestions = questions.filter((question) => !isAnswered(answers[question.id])).map((question) => question.id);
  const current = questions[currentQuestion];
  const currentAnswerIsValid = isAnswered(answers[current.id]);
  return <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 flex flex-col">
    <ExamTopBar examTitle={examTitle} timeRemaining={timeRemaining} onSubmit={() => setShowSubmitDialog(true)} warnings={warnings} />
    <div className="flex-1 flex overflow-hidden"><div className="flex-1 overflow-y-auto p-6"><QuestionArea question={current} currentQuestion={currentQuestion} totalQuestions={questions.length} answer={answers[current.id]} onAnswerChange={handleAnswerChange} onPrevious={() => setCurrentQuestion((value) => Math.max(0, value - 1))} onNext={() => void handleNextQuestion()} sequentialNavigation={settings.sequentialNavigation} currentAnswerIsValid={currentAnswerIsValid} isSavingNext={isSavingNext} /></div>
      <QuestionPanel questions={questions} currentQuestion={currentQuestion} answers={answers} isOnline={isOnline} saveStatus={saveStatus} onQuestionSelect={setCurrentQuestion} answeredCount={answeredCount} unansweredQuestions={unansweredQuestions} sequentialNavigation={settings.sequentialNavigation} /></div>
    <SubmitConfirmDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog} onConfirm={() => { setShowSubmitDialog(false); void submit(); }} answeredCount={answeredCount} totalQuestions={questions.length} />
    {submitError && <div className="fixed bottom-4 right-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 shadow-lg">{submitError}{terminationFailed && <button className="ml-3 underline" onClick={() => void terminate(violationType)}>Retry termination</button>}</div>}
    <ViolationWarningDialog open={showViolationWarning} onOpenChange={setShowViolationWarning} violationType={violationType} violationCount={violationCount} threshold={violationType === "copy-paste" ? settings.copyPasteThreshold : violationType === "tab-switch" ? settings.tabSwitchThreshold : settings.fullscreenExitThreshold} onReturnToFullscreen={violationType === "fullscreen-exit" && !isTerminated ? () => void returnToFullscreen() : undefined} />
  </div>;
}
