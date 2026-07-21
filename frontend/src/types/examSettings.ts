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

export interface TeacherExamSettingsPayload {
  shuffle_question: boolean;
  shuffle_answer_options: boolean;
  auto_submit_on_expire: boolean;
  grace_period: number;
  force_fullscreen_thresh: number;
  tab_switch_thresh: number;
  copy_paste_thresh: number;
  auto_grade: boolean;
}

export interface TeacherExamSettingsApi extends TeacherExamSettingsPayload {
  exam_id: number;
}

export const defaultTeacherExamSettings: TeacherExamSettingsPayload = {
  shuffle_question: false,
  shuffle_answer_options: false,
  auto_submit_on_expire: true,
  grace_period: 0,
  force_fullscreen_thresh: 0,
  tab_switch_thresh: 0,
  copy_paste_thresh: 0,
  auto_grade: true,
};
