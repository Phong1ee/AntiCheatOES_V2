export interface ExamSettings {
  // Randomization
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;

  // Timing
  autoSubmit: boolean;
  gracePeriod: number; // minutes

  // Display
  fullscreen: boolean;

  // Anti-Cheating
  tabSwitchAction: 'none' | 'warn' | 'flag' | 'submit';
  disableCopyPaste: boolean;
  webcamMonitoring: boolean;
  lockdownBrowser: boolean;

  // Violation Thresholds
  tabSwitchThreshold: number;
  copyPasteThreshold: number;
  fullscreenExitThreshold: number;

  // Grading
  autoGradeMcq: boolean;
  manualGradeEssay: boolean;
}

export const defaultExamSettings: ExamSettings = {
  shuffleQuestions: true,
  shuffleAnswers: true,
  autoSubmit: true,
  gracePeriod: 5,
  fullscreen: true,
  tabSwitchAction: 'warn',
  disableCopyPaste: true,
  webcamMonitoring: true,
  lockdownBrowser: false,
  tabSwitchThreshold: 3,
  copyPasteThreshold: 5,
  fullscreenExitThreshold: 3,
  autoGradeMcq: true,
  manualGradeEssay: true,
};
