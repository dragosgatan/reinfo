import { z } from "zod";

export const ProblemListItemSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  difficulty: z.number().int().min(1).max(10),
  tags: z.array(z.string()),
  solve_count: z.number().int(),
  user_status: z.enum(["solved", "attempted", "unsolved"]).nullable(),
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
  solve_count: z.number().int(),
  sample_test_cases: z.array(TestCaseSummarySchema),
  origin_contest: z.object({ slug: z.string(), title: z.string() }).nullable(),
});
export type ProblemDetail = z.infer<typeof ProblemDetailSchema>;

export const VerdictSchema = z.enum(["pending", "AC", "WA", "CE", "RE", "TLE", "MLE", "PARTIAL"]);
export type VerdictType = z.infer<typeof VerdictSchema>;

export const SubmissionResultSchema = z.object({
  id: z.string().uuid(),
  test_case_id: z.string().uuid(),
  verdict: VerdictSchema,
  score: z.number().int(),
  message: z.string().nullable(),
  actual_output: z.string().nullable(),
  expected_output_snippet: z.string().nullable(),
  execution_time_ms: z.number().int().nullable(),
  memory_kb: z.number().int().nullable(),
});
export type SubmissionResult = z.infer<typeof SubmissionResultSchema>;

export const SubmissionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  problem_id: z.string().uuid(),
  problem_slug: z.string(),
  contest_id: z.string().uuid().nullable(),
  verdict: VerdictSchema,
  score: z.number().int(),
  language: z.string(),
  submitted_code: z.string(),
  created_at: z.string(),
  judged_at: z.string().nullable(),
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
});
export type ContestSummary = z.infer<typeof ContestSummarySchema>;

export const ContestDetailSchema = ContestSummarySchema.extend({
  description_md: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  is_registered: z.boolean(),
  problems: z.array(ContestProblemEntrySchema),
});
export type ContestDetail = z.infer<typeof ContestDetailSchema>;

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

export const TAG_LABELS: Record<string, string> = {
  sortare: "Sortare",
  cautare: "Căutare binară",
  dp: "Programare dinamică",
  grafuri: "Grafuri",
  arbori: "Arbori",
  matematica: "Matematică",
  geometrie: "Geometrie",
  greedy: "Greedy",
  backtracking: "Backtracking",
  recursivitate: "Recursivitate",
  vectori: "Vectori",
  siruri: "Șiruri",
  combinatorica: "Combinatorică",
  "divide-cucereste": "Divide și cucerește",
};
