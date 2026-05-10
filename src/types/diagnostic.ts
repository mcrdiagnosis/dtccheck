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
  module?: string;
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
  test_points?: TestPoint[];
  component_location?: string;
}

export interface TestPoint {
  component: string;
  connector: string;
  pin: number | string;
  wire_color: string;
  expected_value: string;
  condition: string;
  fuse_to_check?: {
    reference: string;
    amperage: string;
    location: string;
  };
  component_location?: string;
}

export interface DiagramAnnotation {
  x: number;
  y: number;
  label: string;
  type: "component" | "fuse" | "connector" | "ground" | "sensor" | "actuator" | "ecu" | "relay";
  details?: string;
  pin?: string;
  wire_color?: string;
}

export interface DiagramAnalysis {
  image_url?: string;
  image_base64?: string;
  components_identified: {
    name: string;
    type: string;
    reference: string;
    location: string;
    connector?: string;
    pins?: { number: number | string; color: string; function: string }[];
  }[];
  wires_highlighted: {
    from: string;
    to: string;
    color: string;
    function: string;
  }[];
  fuses: {
    reference: string;
    amperage: string;
    location: string;
    protects: string[];
  }[];
  path_to_follow: string[];
  annotations: DiagramAnnotation[];
  summary: string;
}

export interface ForumInsight {
  forum: string;
  summary: string;
  url: string;
}

export interface VideoResource {
  title: string;
  url: string;
  channel: string;
  description: string;
}

export interface VehicleReference {
  title: string;
  url: string;
  description: string;
  type: "fuse_box" | "relay" | "component_location" | "wiring" | "manual" | "other";
  source: string;
  image_url?: string;
}

export type FuseType = "MINI" | "ATO" | "ATO_SHUNT" | "MAXI" | "JCASE";

export interface FuseEntry {
  number: string;
  amperage: string;
  circuit: string;
  color?: string;
  protected_component?: string;
  type?: FuseType;
  position?: { row: number; col: number };
}

export interface FuseBox {
  name: string;
  location: string;
  reference?: string;
  fuses: FuseEntry[];
  image_url?: string;
  grid?: { rows: number; cols: number };
  diagram_url?: string;
}

export interface RelayInfo {
  reference: string;
  function: string;
  location: string;
  box_name?: string;
}

export interface ComponentLocation {
  name: string;
  location: string;
  description?: string;
  connector?: string;
  image_url?: string;
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
  video_resources: VideoResource[];
  summary: string;
  diagram_analysis?: DiagramAnalysis;
  diagram_image_url?: string;
  vehicle_references?: VehicleReference[];
  fuse_boxes?: FuseBox[];
  relays?: RelayInfo[];
  component_locations?: ComponentLocation[];
}

export interface Diagnostic {
  id: string;
  user_id: string;
  source: "pdf" | "manual";
  raw_text: string;
  modules?: {
    module: string;
    codes: string[];
    descriptions?: Record<string, string>;
    details?: string;
  }[];
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
