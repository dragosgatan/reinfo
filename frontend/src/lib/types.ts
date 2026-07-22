import { z } from "zod";

export const ProblemTypeSchema = z.enum(["standard", "quiz", "dataset"]);
export type ProblemType = z.infer<typeof ProblemTypeSchema>;

export const DatasetMetricSchema = z.enum(["accuracy", "f1", "rmse", "mae"]);
export type DatasetMetric = z.infer<typeof DatasetMetricSchema>;

export const DATASET_METRIC_LABELS: Record<DatasetMetric, string> = {
  accuracy: "Accuracy",
  f1: "F1",
  rmse: "RMSE",
  mae: "MAE",
};

export const QuizOptionReadSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int(),
  text_md: z.string(),
  text_md_en: z.string().nullable(),
});
export type QuizOptionRead = z.infer<typeof QuizOptionReadSchema>;

export const QuizOptionWithAnswerSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int(),
  text_md: z.string(),
  text_md_en: z.string().nullable(),
  is_correct: z.boolean(),
  explanation_md: z.string().nullable(),
  explanation_md_en: z.string().nullable(),
});
export type QuizOptionWithAnswer = z.infer<typeof QuizOptionWithAnswerSchema>;

export const QuizAttemptResultSchema = z.object({
  correct: z.boolean(),
  options: z.array(QuizOptionWithAnswerSchema),
});
export type QuizAttemptResult = z.infer<typeof QuizAttemptResultSchema>;

export const ProblemListItemSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  difficulty: z.number().int().min(1).max(10),
  tags: z.array(z.string()),
  solve_count: z.number().int(),
  user_status: z.enum(["solved", "attempted", "unsolved"]).nullable(),
  problem_type: ProblemTypeSchema,
  dataset_metric: DatasetMetricSchema.nullable().optional(),
});
export type ProblemListItem = z.infer<typeof ProblemListItemSchema>;

export const ProblemListResponseSchema = z.object({
  items: z.array(ProblemListItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  per_page: z.number().int(),
  pages: z.number().int(),
});
export type ProblemListResponse = z.infer<typeof ProblemListResponseSchema>;

export const TestCaseSummarySchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int(),
  score: z.number().int(),
  is_sample: z.boolean(),
});
export type TestCaseSummary = z.infer<typeof TestCaseSummarySchema>;

export const TestCaseReadSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int(),
  score: z.number().int(),
  is_sample: z.boolean(),
  is_hidden: z.boolean(),
  input_path: z.string(),
  output_path: z.string(),
});
export const TestCaseListSchema = z.array(TestCaseReadSchema);
export type TestCaseRead = z.infer<typeof TestCaseReadSchema>;

export const ProblemDetailSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  statement_md: z.string(),
  statement_md_en: z.string().nullable(),
  statement_md_hu: z.string().nullable(),
  input_format: z.string(),
  output_format: z.string(),
  difficulty: z.number().int().min(1).max(10),
  tags: z.array(z.string()),
  author_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  visibility: z.enum(["public", "draft", "private", "contest"]),
  time_limit_ms: z.number().int(),
  memory_limit_kb: z.number().int(),
  score_total: z.number().int(),
  comparison_mode: z.enum(["exact", "whitespace_insensitive", "float_epsilon"]),
  float_epsilon: z.number().nullable(),
  problem_type: ProblemTypeSchema,
  dataset_metric: DatasetMetricSchema.nullable().optional(),
  metric_threshold: z.number().nullable().optional(),
  dataset_id_column: z.string().nullable().optional(),
  dataset_target_column: z.string().nullable().optional(),
  dataset_expected_rows: z.number().int().nullable().optional(),
  require_source_in_contest: z.boolean().optional(),
  solve_count: z.number().int(),
  sample_test_cases: z.array(TestCaseSummarySchema),
  quiz_options: z.array(QuizOptionReadSchema),
  origin_contest: z.object({ slug: z.string(), title: z.string() }).nullable(),
  dataset_files: z.array(z.string()).optional(),
});
export type ProblemDetail = z.infer<typeof ProblemDetailSchema>;

export const DatasetFilesStatusSchema = z.object({
  train_csv: z.boolean(),
  test_csv: z.boolean(),
  sample_submission_csv: z.boolean(),
  answer_csv: z.boolean(),
});
export type DatasetFilesStatus = z.infer<typeof DatasetFilesStatusSchema>;

export const VerdictSchema = z.enum([
  "pending",
  "AC",
  "WA",
  "CE",
  "RE",
  "TLE",
  "MLE",
  "PARTIAL",
  "INVALID_FORMAT",
]);
export type VerdictType = z.infer<typeof VerdictSchema>;

export const SubmissionResultSchema = z.object({
  id: z.string().uuid(),
  test_case_id: z.string().uuid().nullable(),
  verdict: VerdictSchema,
  score: z.number().int(),
  message: z.string().nullable(),
  actual_output: z.string().nullable(),
  expected_output_snippet: z.string().nullable(),
  execution_time_ms: z.number().int().nullable(),
  memory_kb: z.number().int().nullable(),
  metric_value: z.number().nullable().optional(),
});
export type SubmissionResult = z.infer<typeof SubmissionResultSchema>;

export const SubmissionKindSchema = z.enum(["code", "dataset"]);
export type SubmissionKind = z.infer<typeof SubmissionKindSchema>;

export const SubmissionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  problem_id: z.string().uuid(),
  problem_slug: z.string(),
  contest_id: z.string().uuid().nullable(),
  verdict: VerdictSchema,
  score: z.number().int(),
  language: z.string(),
  submitted_code: z.string().nullable(),
  created_at: z.string(),
  judged_at: z.string().nullable(),
  flag_reason: z.string().nullable().optional(),
  submission_kind: SubmissionKindSchema.optional(),
  manual_review: z.boolean().optional(),
  results: z.array(SubmissionResultSchema),
});
export type Submission = z.infer<typeof SubmissionSchema>;

export const SubmissionSummarySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  problem_id: z.string().uuid(),
  problem_slug: z.string(),
  problem_title: z.string(),
  contest_id: z.string().uuid().nullable(),
  verdict: VerdictSchema,
  score: z.number().int(),
  language: z.string(),
  created_at: z.string(),
  judged_at: z.string().nullable(),
  flag_reason: z.string().nullable().optional(),
  submission_kind: SubmissionKindSchema.optional(),
  manual_review: z.boolean().optional(),
});
export type SubmissionSummary = z.infer<typeof SubmissionSummarySchema>;

export const SubmissionListResponseSchema = z.object({
  items: z.array(SubmissionSummarySchema),
  total: z.number().int(),
  page: z.number().int(),
  per_page: z.number().int(),
  pages: z.number().int(),
});
export type SubmissionListResponse = z.infer<typeof SubmissionListResponseSchema>;

export const ProblemReadSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  statement_md: z.string(),
  statement_md_en: z.string().nullable(),
  statement_md_hu: z.string().nullable(),
  input_format: z.string(),
  output_format: z.string(),
  difficulty: z.number().int().min(1).max(10),
  tags: z.array(z.string()),
  author_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  visibility: z.enum(["public", "draft", "private", "contest"]),
  time_limit_ms: z.number().int(),
  memory_limit_kb: z.number().int(),
  score_total: z.number().int(),
  comparison_mode: z.enum(["exact", "whitespace_insensitive", "float_epsilon"]),
  float_epsilon: z.number().nullable(),
  problem_type: ProblemTypeSchema,
  dataset_metric: DatasetMetricSchema.nullable().optional(),
  metric_threshold: z.number().nullable().optional(),
  dataset_id_column: z.string().nullable().optional(),
  dataset_target_column: z.string().nullable().optional(),
  dataset_expected_rows: z.number().int().nullable().optional(),
  require_source_in_contest: z.boolean().optional(),
});
export type ProblemRead = z.infer<typeof ProblemReadSchema>;

export const ContestStatusSchema = z.enum(["upcoming", "ongoing", "past"]);
export type ContestStatus = z.infer<typeof ContestStatusSchema>;

export const ContestProblemEntrySchema = z.object({
  ordinal: z.number().int(),
  problem_slug: z.string(),
  problem_title: z.string(),
  score_total: z.number().int(),
  solved_by_user: z.boolean().nullable(),
});
export type ContestProblemEntry = z.infer<typeof ContestProblemEntrySchema>;

export const ContestSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  scoring_mode: z.enum(["sum", "test"]),
  contest_type: z.enum(["competition", "class_test"]),
  participant_count: z.number().int(),
  problem_count: z.number().int(),
  status: ContestStatusSchema,
  fullscreen_required: z.boolean(),
  copy_paste_blocked: z.boolean(),
});
export type ContestSummary = z.infer<typeof ContestSummarySchema>;

export const ClassTestReadSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  description_md: z.string().nullable(),
  start_time: z.string(),
  end_time: z.string(),
  status: ContestStatusSchema,
  problem_count: z.number().int(),
  participant_count: z.number().int(),
  fullscreen_required: z.boolean(),
  copy_paste_blocked: z.boolean(),
});
export type ClassTestRead = z.infer<typeof ClassTestReadSchema>;

export const ContestDetailSchema = ContestSummarySchema.extend({
  description_md: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  is_registered: z.boolean(),
  problems: z.array(ContestProblemEntrySchema),
});
export type ContestDetail = z.infer<typeof ContestDetailSchema>;

export const ContestViolationSchema = z.object({
  id: z.string().uuid(),
  contest_id: z.string().uuid(),
  user_id: z.string().uuid(),
  violation_type: z.string(),
  details: z.record(z.unknown()).nullable(),
  created_at: z.string(),
});
export type ContestViolation = z.infer<typeof ContestViolationSchema>;

export const ContestListResponseSchema = z.object({
  items: z.array(ContestSummarySchema),
  total: z.number().int(),
  page: z.number().int(),
  per_page: z.number().int(),
  pages: z.number().int(),
});
export type ContestListResponse = z.infer<typeof ContestListResponseSchema>;

export const LeaderboardEntrySchema = z.object({
  rank: z.number().int(),
  user_id: z.string().uuid(),
  username: z.string(),
  display_name: z.string(),
  total_score: z.number().int(),
  problem_scores: z.record(z.string(), z.number().int()),
  last_submission_at: z.string().nullable(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const LeaderboardResponseSchema = z.object({
  contest_slug: z.string(),
  entries: z.array(LeaderboardEntrySchema),
  generated_at: z.string(),
});
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

export const SUPPORTED_LANGUAGES = [
  "c",
  "cpp",
  "python",
  "rust",
  "go",
  "java",
  "kotlin",
  "javascript",
] as const;

export const LANGUAGE_LABELS: Record<string, string> = {
  c: "C",
  cpp: "C++",
  python: "Python 3",
  rust: "Rust",
  go: "Go",
  java: "Java",
  kotlin: "Kotlin",
  javascript: "JavaScript",
};

export const MONACO_LANGUAGE_MAP: Record<string, string> = {
  c: "c",
  cpp: "cpp",
  python: "python",
  rust: "rust",
  go: "go",
  java: "java",
  kotlin: "kotlin",
  javascript: "javascript",
};

export const ALL_TAGS = [
  "sortare",
  "cautare",
  "dp",
  "grafuri",
  "arbori",
  "matematica",
  "geometrie",
  "greedy",
  "backtracking",
  "recursivitate",
  "vectori",
  "siruri",
  "combinatorica",
  "divide-cucereste",
] as const;

export type ProblemTag = (typeof ALL_TAGS)[number];

export function getTagLabel(tag: string, t: (key: string) => string): string {
  return t(`tagLabels.${tag}`);
}

export const DuelStatusSchema = z.enum([
  "pending",
  "active",
  "resigned",
  "drawn",
  "finished",
]);
export type DuelStatus = z.infer<typeof DuelStatusSchema>;

export const DuelRequestStatusSchema = z.enum([
  "pending",
  "accepted",
  "declined",
  "expired",
]);
export type DuelRequestStatus = z.infer<typeof DuelRequestStatusSchema>;

export const DuelPlayerStateSchema = z.object({
  user_id: z.string().uuid(),
  username: z.string(),
  display_name: z.string(),
  score: z.number().int(),
  best_verdict: VerdictSchema.nullable(),
  duel_rating: z.number().int(),
});
export type DuelPlayerState = z.infer<typeof DuelPlayerStateSchema>;

export const DuelReadSchema = z.object({
  id: z.string().uuid(),
  status: DuelStatusSchema,
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  winner_id: z.string().uuid().nullable(),
  time_limit_minutes: z.number().int(),
  draw_offered_by: z.string().uuid().nullable(),
  draw_offered_at: z.string().nullable(),
  created_at: z.string(),
  problem_id: z.string().uuid(),
  problem_slug: z.string(),
  problem_title: z.string(),
  challenger: DuelPlayerStateSchema,
  opponent: DuelPlayerStateSchema,
});
export type DuelRead = z.infer<typeof DuelReadSchema>;

export const DuelRequestReadSchema = z.object({
  id: z.string().uuid(),
  from_id: z.string().uuid(),
  from_username: z.string(),
  to_id: z.string().uuid(),
  to_username: z.string(),
  time_limit_minutes: z.number().int(),
  difficulty_min: z.number().int(),
  difficulty_max: z.number().int(),
  status: DuelRequestStatusSchema,
  created_at: z.string(),
  expires_at: z.string(),
});
export type DuelRequestRead = z.infer<typeof DuelRequestReadSchema>;

export const DuelRatingHistoryEntrySchema = z.object({
  duel_id: z.string().uuid(),
  rating_before: z.number().int(),
  rating_after: z.number().int(),
  created_at: z.string(),
});
export type DuelRatingHistoryEntry = z.infer<typeof DuelRatingHistoryEntrySchema>;

export const DuelQueueStatusSchema = z.enum(["waiting", "matched", "cancelled"]);
export type DuelQueueStatus = z.infer<typeof DuelQueueStatusSchema>;

export const QueueEntryReadSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  time_limit_minutes: z.number().int(),
  joined_at: z.string(),
  expires_at: z.string(),
  status: DuelQueueStatusSchema,
  matched_duel_id: z.string().uuid().nullable(),
});
export type QueueEntryRead = z.infer<typeof QueueEntryReadSchema>;

export const ActiveDuelSummarySchema = z.object({
  id: z.string().uuid(),
  challenger_username: z.string(),
  challenger_rating: z.number().int(),
  opponent_username: z.string(),
  opponent_rating: z.number().int(),
  problem_title: z.string(),
  time_limit_minutes: z.number().int(),
  seconds_elapsed: z.number().int(),
});
export type ActiveDuelSummary = z.infer<typeof ActiveDuelSummarySchema>;

export const RecentDuelSummarySchema = z.object({
  id: z.string().uuid(),
  challenger_username: z.string(),
  challenger_rating: z.number().int(),
  opponent_username: z.string(),
  opponent_rating: z.number().int(),
  winner_username: z.string().nullable(),
  status: DuelStatusSchema,
  problem_title: z.string(),
  finished_at: z.string(),
});
export type RecentDuelSummary = z.infer<typeof RecentDuelSummarySchema>;

export const LobbyResponseSchema = z.object({
  queue_counts: z.record(z.string(), z.number().int()),
  active_duels: z.array(ActiveDuelSummarySchema),
  recent_duels: z.array(RecentDuelSummarySchema),
  your_queue_entry: QueueEntryReadSchema.nullable(),
});
export type LobbyResponse = z.infer<typeof LobbyResponseSchema>;

export const LESSON_CATEGORIES = [
  "basics",
  "data_structures",
  "graphs",
  "dp",
  "math",
] as const;
export type LessonCategory = (typeof LESSON_CATEGORIES)[number];

export const LESSON_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type LessonLevel = (typeof LESSON_LEVELS)[number];

export const QuizQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(z.string()),
  correct: z.number().int(),
  explanation: z.string(),
});
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const LessonListItemSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  category: z.enum(LESSON_CATEGORIES),
  level: z.enum(LESSON_LEVELS),
  ordinal: z.number().int(),
  published: z.boolean(),
  is_completed: z.boolean(),
});
export type LessonListItem = z.infer<typeof LessonListItemSchema>;

export const LessonListResponseSchema = z.object({
  items: z.array(LessonListItemSchema),
  total: z.number().int(),
});
export type LessonListResponse = z.infer<typeof LessonListResponseSchema>;

export const UserPublicSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  role: z.enum(["student", "teacher", "admin", "superuser"]),
  created_at: z.string(),
});
export type UserPublic = z.infer<typeof UserPublicSchema>;

export const UserProfileReadSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  bio: z.string().nullable(),
  role: z.enum(["student", "teacher", "admin", "superuser"]),
  created_at: z.string(),
  last_active_at: z.string(),
  duel_rating: z.number().int(),
  duel_wins: z.number().int(),
  duel_losses: z.number().int(),
  duel_draws: z.number().int(),
  github_url: z.string().nullable().optional(),
  link_1: z.string().nullable().optional(),
  link_2: z.string().nullable().optional(),
  link_3: z.string().nullable().optional(),
  privacy_show_email: z.boolean().optional(),
  email: z.string().nullable().optional(),
});
export type UserProfileRead = z.infer<typeof UserProfileReadSchema>;

export const ActivityDaySchema = z.object({
  date: z.string(),
  count: z.number().int(),
});
export type ActivityDay = z.infer<typeof ActivityDaySchema>;

export const DifficultyDistributionSchema = z.object({
  easy: z.number().int(),
  medium: z.number().int(),
  hard: z.number().int(),
});

export const UserStatsReadSchema = z.object({
  total_solved: z.number().int(),
  total_submissions: z.number().int(),
  difficulty_distribution: DifficultyDistributionSchema,
  achievements: z.array(z.string()),
  problem_score: z.number().int().default(0),
});
export type UserStatsRead = z.infer<typeof UserStatsReadSchema>;

export const ProblemsLeaderboardEntrySchema = z.object({
  rank: z.number().int(),
  username: z.string(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  problem_score: z.number().int(),
  total_solved: z.number().int(),
  solved_easy: z.number().int(),
  solved_medium: z.number().int(),
  solved_hard: z.number().int(),
});
export type ProblemsLeaderboardEntry = z.infer<typeof ProblemsLeaderboardEntrySchema>;

export const DuelLeaderboardEntrySchema = z.object({
  rank: z.number().int(),
  username: z.string(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  duel_rating: z.number().int(),
  duel_wins: z.number().int(),
  duel_losses: z.number().int(),
  duel_draws: z.number().int(),
});
export type DuelLeaderboardEntry = z.infer<typeof DuelLeaderboardEntrySchema>;

export const ExternalResultReadSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  contest_name: z.string(),
  platform: z.string(),
  result_text: z.string(),
  year: z.number().int(),
  verified: z.boolean(),
  verified_by_id: z.string().uuid().nullable(),
  created_at: z.string(),
});
export type ExternalResultRead = z.infer<typeof ExternalResultReadSchema>;

export const FriendStatusSchema = z.object({
  is_friend: z.boolean(),
  pending_sent: z.boolean(),
  pending_received: z.boolean(),
  request_id: z.string().uuid().nullable(),
});
export type FriendStatus = z.infer<typeof FriendStatusSchema>;

export const FriendRequestReadSchema = z.object({
  id: z.string().uuid(),
  sender_id: z.string().uuid(),
  receiver_id: z.string().uuid(),
  status: z.enum(["pending", "accepted", "rejected"]),
  created_at: z.string(),
  sender_username: z.string(),
  sender_display_name: z.string(),
  sender_avatar_url: z.string().nullable(),
});
export type FriendRequestRead = z.infer<typeof FriendRequestReadSchema>;

export const FriendshipReadSchema = z.object({
  id: z.string().uuid(),
  friend_id: z.string().uuid(),
  friend_username: z.string(),
  friend_display_name: z.string(),
  friend_avatar_url: z.string().nullable(),
  online: z.boolean(),
  last_active_at: z.string(),
  created_at: z.string(),
});
export type FriendshipRead = z.infer<typeof FriendshipReadSchema>;

export const NotificationReadSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["friend_request", "friend_accepted"]),
  payload: z.string(),
  read: z.boolean(),
  created_at: z.string(),
});
export type NotificationRead = z.infer<typeof NotificationReadSchema>;

export const ActivityFeedItemSchema = z.object({
  submission_id: z.string().uuid(),
  user_id: z.string().uuid(),
  username: z.string(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  problem_slug: z.string(),
  problem_title: z.string(),
  verdict: z.string(),
  score: z.number().int(),
  language: z.string(),
  created_at: z.string(),
});
export type ActivityFeedItem = z.infer<typeof ActivityFeedItemSchema>;

export const ClassMemberSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
});
export type ClassMember = z.infer<typeof ClassMemberSchema>;

export const ClassReadSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description_md: z.string().nullable(),
  join_code: z.string(),
  archived: z.boolean(),
  created_at: z.string(),
  teacher_id: z.string().uuid(),
  teacher_username: z.string(),
  teacher_display_name: z.string(),
  teacher_avatar_url: z.string().nullable(),
  member_count: z.number().int(),
});
export type ClassRead = z.infer<typeof ClassReadSchema>;

export const ClassDetailSchema = ClassReadSchema.extend({
  members: z.array(ClassMemberSchema),
});
export type ClassDetail = z.infer<typeof ClassDetailSchema>;

export const AnnouncementReadSchema = z.object({
  id: z.string().uuid(),
  class_id: z.string().uuid(),
  author_id: z.string().uuid(),
  author_username: z.string(),
  author_display_name: z.string(),
  author_avatar_url: z.string().nullable(),
  title: z.string(),
  body_md: z.string(),
  pinned: z.boolean(),
  created_at: z.string(),
});
export type AnnouncementRead = z.infer<typeof AnnouncementReadSchema>;

export const AssignmentReadSchema = z.object({
  id: z.string().uuid(),
  class_id: z.string().uuid(),
  homework_id: z.string().uuid().nullable(),
  problem_id: z.string().uuid(),
  problem_slug: z.string(),
  problem_title: z.string(),
  problem_difficulty: z.number().int(),
  note_md: z.string().nullable(),
  due_at: z.string().nullable(),
  created_at: z.string(),
  user_solved: z.boolean(),
});
export type AssignmentRead = z.infer<typeof AssignmentReadSchema>;

export const HomeworkReadSchema = z.object({
  id: z.string().uuid(),
  class_id: z.string().uuid(),
  title: z.string(),
  description_md: z.string().nullable(),
  due_at: z.string().nullable(),
  created_at: z.string(),
  assignments: z.array(AssignmentReadSchema),
});
export type HomeworkRead = z.infer<typeof HomeworkReadSchema>;

export const StudentProgressSchema = z.object({
  student_id: z.string().uuid(),
  student_username: z.string(),
  student_display_name: z.string(),
  student_avatar_url: z.string().nullable(),
  solved_problem_ids: z.array(z.string().uuid()),
});

export const HomeworkProgressSchema = z.object({
  homework: HomeworkReadSchema,
  members: z.array(StudentProgressSchema),
});
export type HomeworkProgress = z.infer<typeof HomeworkProgressSchema>;

export const ClassMessageReadSchema = z.object({
  id: z.string().uuid(),
  class_id: z.string().uuid(),
  author_id: z.string().uuid(),
  author_username: z.string(),
  author_display_name: z.string(),
  author_avatar_url: z.string().nullable(),
  body: z.string(),
  created_at: z.string(),
});
export type ClassMessageRead = z.infer<typeof ClassMessageReadSchema>;

export const DirectMessageReadSchema = z.object({
  id: z.string().uuid(),
  class_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  sender_username: z.string(),
  sender_display_name: z.string(),
  sender_avatar_url: z.string().nullable(),
  receiver_id: z.string().uuid(),
  body: z.string(),
  read: z.boolean(),
  created_at: z.string(),
});
export type DirectMessageRead = z.infer<typeof DirectMessageReadSchema>;

export const NodeStatusSchema = z.enum(["not_started", "in_progress", "done"]);
export type NodeStatus = z.infer<typeof NodeStatusSchema>;

export const NodeLinkTypeSchema = z.enum(["problem", "material", "external"]);
export type NodeLinkType = z.infer<typeof NodeLinkTypeSchema>;

export const NodeLinkSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  title: z.string(),
  link_type: NodeLinkTypeSchema,
  problem_id: z.string().uuid().nullable(),
});
export type NodeLink = z.infer<typeof NodeLinkSchema>;

export const NodeProgressSchema = z.object({
  status: NodeStatusSchema,
  updated_at: z.string(),
});
export type NodeProgress = z.infer<typeof NodeProgressSchema>;

export const RoadmapNodeSchema = z.object({
  id: z.string().uuid(),
  roadmap_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  order: z.number().int(),
  x: z.number(),
  y: z.number(),
  links: z.array(NodeLinkSchema),
  progress: NodeProgressSchema.nullable(),
});
export type RoadmapNode = z.infer<typeof RoadmapNodeSchema>;

export const RoadmapEdgeSchema = z.object({
  id: z.string().uuid(),
  from_node_id: z.string().uuid(),
  to_node_id: z.string().uuid(),
});
export type RoadmapEdge = z.infer<typeof RoadmapEdgeSchema>;

export const RoadmapSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  is_published: z.boolean(),
  total_nodes: z.number().int(),
  completed_nodes: z.number().int(),
  completion_pct: z.number(),
});
export type RoadmapSummary = z.infer<typeof RoadmapSummarySchema>;

export const RoadmapListResponseSchema = z.object({
  items: z.array(RoadmapSummarySchema),
  total: z.number().int(),
});
export type RoadmapListResponse = z.infer<typeof RoadmapListResponseSchema>;

export const RoadmapDetailSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  is_published: z.boolean(),
  nodes: z.array(RoadmapNodeSchema),
  edges: z.array(RoadmapEdgeSchema),
});
export type RoadmapDetail = z.infer<typeof RoadmapDetailSchema>;

export const LessonReadSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  category: z.enum(LESSON_CATEGORIES),
  level: z.enum(LESSON_LEVELS),
  content_md: z.string(),
  content_md_en: z.string().nullable(),
  content_md_hu: z.string().nullable(),
  teacher_notes_md: z.string().nullable(),
  quizzes: z.array(z.record(z.unknown())),
  ordinal: z.number().int(),
  published: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  is_completed: z.boolean(),
});
export type LessonRead = z.infer<typeof LessonReadSchema>;

export const TRACK_OLYMPIADS = ["ONI", "ONIA", "ONSC", "IOAI", "CTF", "Linux", "other"] as const;
export const TrackOlympiadSchema = z.enum(TRACK_OLYMPIADS);
export type TrackOlympiad = z.infer<typeof TrackOlympiadSchema>;

export const TrackItemTypeSchema = z.enum(["lesson", "problem", "ctf_challenge"]);
export type TrackItemType = z.infer<typeof TrackItemTypeSchema>;

export const TrackItemStatusSchema = z.enum(["not_started", "in_progress", "done"]);
export type TrackItemStatus = z.infer<typeof TrackItemStatusSchema>;

export const TrackItemUnlockStatusSchema = z.enum(["locked", "available", "done"]);
export type TrackItemUnlockStatus = z.infer<typeof TrackItemUnlockStatusSchema>;

export const TrackItemSchema = z.object({
  id: z.string().uuid(),
  item_type: TrackItemTypeSchema,
  ref_id: z.string().uuid(),
  ref_title: z.string(),
  ref_slug: z.string(),
  order: z.number().int(),
  prerequisite_item_id: z.string().uuid().nullable(),
  status: TrackItemStatusSchema,
  unlock_status: TrackItemUnlockStatusSchema,
});
export type TrackItem = z.infer<typeof TrackItemSchema>;

export const TrackSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  olympiad: TrackOlympiadSchema,
  order: z.number().int(),
  published: z.boolean(),
  item_count: z.number().int(),
  completed_items: z.number().int(),
  completion_pct: z.number(),
});
export type TrackSummary = z.infer<typeof TrackSummarySchema>;

export const TrackDetailSchema = TrackSummarySchema.extend({
  description_md: z.string().nullable(),
  items: z.array(TrackItemSchema),
});
export type TrackDetail = z.infer<typeof TrackDetailSchema>;

export const TrackListResponseSchema = z.object({
  items: z.array(TrackSummarySchema),
  total: z.number().int(),
});
export type TrackListResponse = z.infer<typeof TrackListResponseSchema>;

export const CTF_CATEGORIES = [
  "web",
  "crypto",
  "pwn",
  "reverse",
  "forensics",
  "osint",
  "misc",
] as const;
export const CtfCategorySchema = z.enum(CTF_CATEGORIES);
export type CtfCategory = z.infer<typeof CtfCategorySchema>;

export const CtfScoringSchema = z.enum(["static", "dynamic"]);
export type CtfScoring = z.infer<typeof CtfScoringSchema>;

export const CtfChallengeSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  category: CtfCategorySchema,
  difficulty: z.number().int().min(1).max(10),
  scoring: CtfScoringSchema,
  base_points: z.number().int(),
  current_points: z.number().int(),
  solve_count: z.number().int(),
  published: z.boolean(),
  solved_by_user: z.boolean().nullable(),
  first_blood_username: z.string().nullable(),
  created_at: z.string(),
});
export type CtfChallengeSummary = z.infer<typeof CtfChallengeSummarySchema>;

export const CtfChallengeListResponseSchema = z.object({
  items: z.array(CtfChallengeSummarySchema),
  total: z.number().int(),
  page: z.number().int(),
  per_page: z.number().int(),
  pages: z.number().int(),
});
export type CtfChallengeListResponse = z.infer<typeof CtfChallengeListResponseSchema>;

export const CtfAttachmentSchema = z.object({
  id: z.string().uuid(),
  filename: z.string(),
});
export type CtfAttachment = z.infer<typeof CtfAttachmentSchema>;

export const CtfHintSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int(),
  cost: z.number().int(),
  revealed: z.boolean(),
  content_md: z.string().nullable(),
});
export type CtfHint = z.infer<typeof CtfHintSchema>;

export const CtfChallengeDetailSchema = CtfChallengeSummarySchema.extend({
  statement_md: z.string(),
  flag_case_sensitive: z.boolean(),
  attachments: z.array(CtfAttachmentSchema),
  hints: z.array(CtfHintSchema),
});
export type CtfChallengeDetail = z.infer<typeof CtfChallengeDetailSchema>;

export const CtfFlagSubmitResultSchema = z.object({
  correct: z.boolean(),
  already_solved: z.boolean(),
  first_blood: z.boolean(),
  points_awarded: z.number().int().nullable(),
  message: z.string(),
});
export type CtfFlagSubmitResult = z.infer<typeof CtfFlagSubmitResultSchema>;

export const CtfScoreboardEntrySchema = z.object({
  rank: z.number().int(),
  user_id: z.string().uuid(),
  username: z.string(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  total_points: z.number().int(),
  solve_count: z.number().int(),
  last_solved_at: z.string(),
  category_points: z.record(z.string(), z.number().int()),
});
export type CtfScoreboardEntry = z.infer<typeof CtfScoreboardEntrySchema>;

export const CtfScoreboardResponseSchema = z.object({
  entries: z.array(CtfScoreboardEntrySchema),
  generated_at: z.string(),
});
export type CtfScoreboardResponse = z.infer<typeof CtfScoreboardResponseSchema>;
