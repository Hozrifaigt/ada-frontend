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
  toc_source?: 'ai_generated';
  client_specific_requests?: string;
  sector_specific_comments?: string;
  regulations?: string;
  detail_level?: number;
}

export interface Draft {
  id: string;
  metadata: DraftMetadata;
  toc: TOCTopic[];
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

export interface CreateDraftResponse {
  draft_id: string;
  draft: Draft;
  toc_source?: 'similarity_search' | 'ai_generated';
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