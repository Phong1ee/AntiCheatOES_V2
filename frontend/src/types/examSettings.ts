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
  autoGradeMcq: true,
  manualGradeEssay: true,
};

export interface TeacherExamSettingsPayload {
  shuffle_question: boolean;
  shuffle_answer_options: boolean;
  sequential_navigation: boolean;
  auto_submit_on_expire: boolean;
  grace_period: number;
  anti_cheat_enabled: boolean;
  violation_limit: number;
  auto_grade: boolean;
  result_strategy: ResultStrategy;
  result_visibility?: 'hidden' | 'score-only' | 'full';
  expected_version?: number;
}

export interface TeacherExamSettingsApi extends TeacherExamSettingsPayload {
  exam_id: number;
  version: number;
}

export const defaultTeacherExamSettings: TeacherExamSettingsPayload = {
  shuffle_question: false,
  shuffle_answer_options: false,
  sequential_navigation: false,
  auto_submit_on_expire: true,
  grace_period: 0,
  anti_cheat_enabled: false,
  violation_limit: 5,
  auto_grade: true,
  result_strategy: 'highest',
};
import type { ResultStrategy } from './teacher-results';
