export interface ClientMetadata {
  name: string;
  country: string;
  city: string;
  industry: string;
}

export interface ConversationEntry {
  timestamp: string;
  user_message: string;
  ai_response: string;
}

export interface TOCSubtopic {
  subtopic_id: string;
  topic: string;
  order: number;
  source_subtopic_id?: string;
  content: string;
  summary: string;
  conversation_history: ConversationEntry[];
  gap_report_json?: string | null;
  gap_status?: 'pending' | 'assessed' | 'applied';
  baseline_content?: string;
  review_step?: 'pending' | 'benchmark' | 'regulation' | 'review' | 'closed';
  benchmark_match?: string | null;
  added_from_benchmark?: boolean;
  manual_benchmark_content?: string | null;
  manual_benchmark_match?: string | null;
}

export interface TOCTopic {
  topic_id: string;
  topic: string;
  order: number;
  source_topic_id?: string;
  content: string;
  summary: string;
  conversation_history: ConversationEntry[];
  subtopics: TOCSubtopic[];
  gap_report_json?: string | null;
  gap_status?: 'pending' | 'assessed' | 'applied';
  baseline_content?: string;
  review_step?: 'pending' | 'benchmark' | 'regulation' | 'review' | 'closed';
  added_from_benchmark?: boolean;
  benchmark_match?: string | null;
  reconcile_note?: string | null;
  manual_benchmark_content?: string | null;
  manual_benchmark_match?: string | null;
}

export interface DraftMetadata {
  title: string;
  description: string;
  created_by: string;
  created_at: string;
  modified_at: string;
  client_metadata: ClientMetadata;
  function: string;
  most_similar_policy_id?: string;
  toc_source?: 'ai_generated' | 'similar_policy' | 'uploaded_policy' | 'pending_selection' | 'similarity_search';
  client_specific_requests?: string;
  sector_specific_comments?: string;
  regulations?: string;
  detail_level?: number;
  review_mode?: boolean;
  benchmark_policy_id?: string;
  benchmark_source?: 'library' | 'uploaded';
  benchmark_topics_json?: string | null;
  benchmark_toc_json?: string | null;
  review_intensity?: 'preserve' | 'rebuild';
  toc_reconciliation_note?: string | null;
  consistency_report_json?: string | null;
  // Perfect-TOC-first stage (v2)
  client_toc_json?: string | null;
  good_toc_json?: string | null;
  good_toc_basis_json?: string | null;
  toc_approved?: boolean;
  content_mapped?: boolean;
}

// A lightweight TOC structure used for the extracted/good preview columns and adoption.
// Ids (when present) let the backend preserve a section's content across a RENAME —
// title-only entries (extract/paste previews) still work via title matching.
export interface TocStructureItem {
  id?: string;
  title: string;
  subtopics?: (string | { id?: string; title: string })[];
}

export interface LibraryPolicy {
  policy_id: string;
  filename: string;
  description: string;
  function: string;
  web_url?: string;
}

export interface GapFinding {
  id: string;
  type: 'missing' | 'non_compliant' | 'enhancement';
  source: 'benchmark' | 'regulation' | 'previous';
  severity: 'high' | 'medium' | 'low';
  description: string;
  suggested_change: string;
  evidence?: string | null;
  evidence_source?: string | null;
}

export interface GapReport {
  topic_id: string;
  findings: GapFinding[];
  benchmark_topic_matched?: string | null;
  overall_summary: string;
}

export interface GapReportResponse {
  gap_report: GapReport;
  message: string;
}

export interface ApplyGapRequest {
  confirmed_finding_ids: string[];
  edited_findings?: GapFinding[];
  preview?: boolean;
  final_content?: string;
  subtopic_id?: string;
}

export interface ApplyGapResponse {
  content: string;
  summary: string;
  word_count: number;
  message: string;
}

export interface ConsistencyIssue {
  id: string;
  type: 'contradiction' | 'terminology' | 'duplicate' | 'undefined_term' | 'cross_reference' | string;
  severity: 'high' | 'medium' | 'low' | string;
  description: string;
  locations: string[];
  suggestion: string;
}

export interface ConsistencyReport {
  issues: ConsistencyIssue[];
  summary: string;
  generated_at: string;
}

export interface GapSummaryTopic {
  title: string;
  status: string;
  findings_count: number;
  overall_summary: string;
  findings: GapFinding[];
}

export interface GapSummary {
  narrative: string;
  total_units: number;
  assessed: number;
  applied: number;
  pending: number;
  benchmark_coverage: number;
  pct_preserved: number | null;
  total_findings: number;
  by_severity: Record<string, number>;
  by_type: Record<string, number>;
  by_source: Record<string, number>;
  topics: GapSummaryTopic[];
}

export interface Draft {
  id: string;
  metadata: DraftMetadata;
  toc: TOCTopic[];
  toc_chat_history?: Array<{ timestamp: string; user_message: string; ai_response: string }>;
}

export interface DraftVersion {
  version_id: string;
  created_at: string;
  created_by: string;
  label: string;
  reason: string;
  size: number;
}

export interface AuditEntry {
  ts: string;
  actor: string;
  action: string;
  target_id: string;
  target_title: string;
  summary: string;
}

export interface DraftSummary {
  draft_id: string;
  title: string;
  description: string;
  created_by: string;
  created_at: string;
  modified_at: string;
  most_similar_policy_id?: string;
  client_metadata?: ClientMetadata;
  function?: string;
}

export interface CreateDraftRequest {
  title: string;
  description?: string;
  client_metadata: ClientMetadata;
  function: string;
  client_specific_requests?: string;
  sector_specific_comments?: string;
  regulations: string;
  detail_level: number;
}

export interface ValidateDraftRequest {
  title: string;
  description?: string;
  client_metadata: ClientMetadata;
  function: string;
  client_specific_requests?: string;
  sector_specific_comments?: string;
  regulations: string;
  detail_level: number;
}

export interface ValidateDraftResponse {
  is_valid: boolean;
  issues: string[];
  suggestions: string[];
  description_quality_score: number;
  improved_description?: string;
}

export interface SimilarPolicy {
  policy_id: string;
  filename: string;
  description: string;
  web_url?: string;
  similarity_score: number;
}

export interface CreateDraftResponse {
  draft_id: string;
  draft: Draft;
  toc_source?: 'similarity_search' | 'ai_generated' | 'pending_selection';
  needs_policy_selection?: boolean;
  similar_policies?: SimilarPolicy[];
}

export interface UpdateTOCRequest {
  toc: TOCUpdateItem[];
}

export interface TOCUpdateItem {
  id: string;
  topic: string;
  order: number;
  source_topic_id?: string;
  source_subtopic_id?: string;
  subtopics?: TOCUpdateItem[];
}

export interface GenerateContentRequest {
  user_prompt: string;
  subtopic_id?: string;
}

export interface ContentGenerationResponse {
  content: string;
  sources_used: string[];
  summary: string;
  word_count: number;
  message: string;
  is_chat_response?: boolean;
}

export interface ValidateDraftResponse {
  is_valid: boolean;
  issues: string[];
  suggestions: string[];
  description_quality_score: number;
  improved_description?: string;
}

export interface DraftProgress {
  total: number;
  completed: number;
  percentage: number;
  remaining: number;
}

// TOC Chat Types
export interface TOCChatMessage {
  message: string;
  conversation_history?: Array<{
    user_message: string;
    ai_response: string;
  }>;
}

export interface TOCOperation {
  action: string;
  parameters: Record<string, any>;
  interpretation: string;
  requires_confirmation: boolean;
  error?: string;
}

export interface TOCChatResponse {
  success: boolean;
  operation?: TOCOperation;
  preview_toc?: TOCTopic[];
  current_toc: TOCTopic[];
  message: string;
  follow_up_question?: string;
  suggestions?: string[];
}

export interface TOCConfirmRequest {
  operation: TOCOperation;
  current_toc: TOCTopic[];
}

export interface TOCConfirmResponse {
  success: boolean;
  updated_toc: TOCTopic[];
  message: string;
  undo_available: boolean;
}

// Policy Template Types removed - no longer using Excel templates