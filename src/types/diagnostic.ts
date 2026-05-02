export type Plan = "free" | "pro" | "premium";

export interface DTCCode {
  code: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface VehicleInfo {
  make: string;
  model: string;
  year: number;
  engine?: string;
}

export interface ProbableCause {
  cause: string;
  probability: number;
  sources: string[];
}

export interface Solution {
  description: string;
  difficulty: "easy" | "medium" | "hard";
  estimated_cost: string;
  steps: string[];
  sources: string[];
}

export interface InteractiveTest {
  id: string;
  name: string;
  description: string;
  tools_needed: string[];
  steps: string[];
  expected_result: string;
  pass_implication: string;
  fail_implication: string;
}

export interface ForumInsight {
  forum: string;
  summary: string;
  url: string;
}

export interface AIAnalysis {
  dtc_codes: DTCCode[];
  vehicle_context: {
    affected_systems: string[];
  };
  probable_causes: ProbableCause[];
  solutions: Solution[];
  interactive_tests: InteractiveTest[];
  forum_insights: ForumInsight[];
  summary: string;
}

export interface Diagnostic {
  id: string;
  user_id: string;
  source: "pdf" | "manual";
  raw_text: string;
  dtc_codes: DTCCode[];
  vehicle_info: VehicleInfo;
  ai_analysis: AIAnalysis | null;
  status: "pending" | "analyzing" | "completed" | "tests_in_progress";
  created_at: string;
  updated_at: string;
}

export interface TestResult {
  id: string;
  diagnostic_id: string;
  test_id: string;
  test_name: string;
  status: "pending" | "passed" | "failed" | "skipped";
  user_notes: string;
  ai_recommendation: string;
}
