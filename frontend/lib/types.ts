export type Role = "ADMIN" | "PARTICIPANT";

export interface Profile {
  uid: string;
  display_name: string;
  email: string | null;
  role: Role;
}

export interface SessionInfo {
  session_code: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "FINISHED";
  remaining_seconds: number;
  duration_seconds: number;
}

export interface ArenaQuestion {
  id: string;
  order: number;
  title: string;
  language: string;
  difficulty: string;
  points: number;
  analogy: string;
  code_template: string;
  hint: string;
}

export interface QuestionsResponse {
  session: SessionInfo;
  questions: ArenaQuestion[];
}

export interface MyScore {
  total_score: number;
  solved_count: number;
  total_time_seconds: number;
  solved_question_ids: string[];
  violation_count: number;
}

export interface ViolationEntry {
  type: string;
  at: string;
}

export interface ViolationRow {
  participant_id: string;
  display_name: string;
  violation_count: number;
  violations: ViolationEntry[];
}

export interface LeaderboardRow {
  participant_id: string;
  display_name: string;
  total_score: number;
  solved_count: number;
  total_time_seconds: number;
}

export interface SubmissionResponse {
  message: string;
  data: {
    submission_id: string;
    question_id: string;
    is_correct: boolean;
    earned_points: number;
    already_solved_before: boolean;
    session_score: {
      total_score: number;
      solved_count: number;
      total_time_seconds: number;
    };
  };
}

export interface AnswerPayload {
  id: string;
  answer_text: string;
  is_case_sensitive: boolean;
}

export interface AdminQuestion {
  id: string;
  title: string;
  language: string;
  difficulty: string;
  points: number;
  analogy: string;
  code_template: string;
  hint: string | null;
  is_active: boolean;
  answers: AnswerPayload[];
}

export interface AdminParticipant {
  uid: string;
  display_name: string;
  email: string | null;
  role: Role;
}

export interface AdminSession {
  id: string;
  session_code: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "FINISHED";
  duration_seconds: number;
  remaining_seconds: number;
  question_count: number;
}

export interface SubmissionHistoryRow {
  id: string;
  participant_id: string;
  display_name: string;
  question_id: string;
  question_title: string;
  submitted_answer: string;
  is_correct: boolean;
  earned_points: number;
  submitted_at: string | null;
}
