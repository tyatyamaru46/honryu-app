import { Timestamp } from "firebase/firestore";

// ─── Main ─────────────────────────────────────────────────────────────────────
export type MainId = "side_business" | "sns_ops" | "skill_building";

export const MAIN_NAMES: Record<MainId, string> = {
  side_business: "副業化",
  sns_ops: "発信運用",
  skill_building: "制作技術の習得",
};

export interface Main {
  id: MainId;
  name: string;
  purpose: string;
  win_this_week: string;
  next_action: string;
  not_doing_now: string;
  saikai_memo: string;
  updated_at: Timestamp;
}

// ─── Sub ──────────────────────────────────────────────────────────────────────
export type UnderstandingLevel = "見た" | "意味はわかる" | "手順を言える" | "自力で再現できる";
export type SkillBucket = "reproducing" | "observing" | "future";

export interface Sub {
  id?: string;
  name: string;
  purpose: string;
  deliverable: string;
  reason_to_do_now: string;
  is_active: boolean;
  understanding_level: UnderstandingLevel;
  skill_bucket: SkillBucket | null;
  source_noise_id: string | null;
  next_action: string;
  saikai_memo: string;
  updated_at: Timestamp;
}

// ─── AI Log ───────────────────────────────────────────────────────────────────
export interface AiLog {
  id?: string;
  what_i_know: string;
  where_stuck: string;
  my_hypothesis: string;
  difference_from_last: string;
  ai_answer: string;
  my_summary_3lines: string;
  first_step_to_reproduce: string;
  understanding_level_after: string; // Updated understanding level
  
  // Optional Gemini AI-extracted fields
  golden_prompt?: string | null;
  outcome?: string | null;
  tips?: string | null;
  user_memo?: string | null;

  created_at: Timestamp;
}

// ─── Review ───────────────────────────────────────────────────────────────────
export type QuestionType = "3行説明" | "最初の一手" | "なぜその方法か";

export interface Review {
  id?: string;
  source_ai_log_id: string;
  scheduled_date: Timestamp;
  question_type: QuestionType;
  answer: string;
  completed_at: Timestamp | null;
  status: "pending" | "done";
  // collectionGroup traversal helpers (set by app on fetch)
  main_id?: string;
  sub_id?: string;
}

// ─── Noise ────────────────────────────────────────────────────────────────────
export type RelatedMain = MainId | "unclassified";

export const RELATED_MAIN_NAMES: Record<RelatedMain, string> = {
  side_business: "副業化",
  sns_ops: "発信運用",
  skill_building: "制作技術の習得",
  unclassified: "未分類",
};

export interface Noise {
  id?: string;
  title: string;
  content: string;
  related_main: RelatedMain;
  reason_not_now: string;
  noticed_history: Timestamp[];
  next_review_date: Timestamp;
  promoted_to_sub_id: string | null;
  status: "active" | "promoted" | "archived";
  created_at: Timestamp;
}

// ─── Weekly Review ────────────────────────────────────────────────────────────
export interface WeeklyReview {
  id?: string;
  started_at: Timestamp;
  main_progress: Partial<Record<MainId, string>>;
  next_win_this_week: Partial<Record<MainId, string>>;
  promotions: string[];
  completed_at: Timestamp | null;
}

// ─── Work Log ─────────────────────────────────────────────────────────────────
export interface WorkLog {
  id?: string;
  did_today: string;
  next_action: string;
  saikai_memo: string;
  created_at: Timestamp;
}

// ─── User Profile ─────────────────────────────────────────────────────────────
export interface UserProfile {
  today_focus_main_id: MainId | null;
  review_intervals: number[];
  my_rules: string[];
  weekly_review_status: "idle" | "active";
  current_weekly_review_id: string | null;
}
