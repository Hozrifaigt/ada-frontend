import { apiClient } from './api/client';
import axios from 'axios';
import {
  Draft,
  DraftSummary,
  CreateDraftRequest,
  CreateDraftResponse,
  UpdateTOCRequest,
  GenerateContentRequest,
  ContentGenerationResponse,
  DraftProgress,
  ValidateDraftResponse,
  TOCTopic,
  TOCChatResponse,
  TOCOperation,
  TOCConfirmResponse
} from '../types/draft.types';

// Create a special client with longer timeout for draft initialization and content generation
const longTimeoutClient = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080',
  timeout: 300000, // 5 minutes for embedding generation, similarity search, and OpenAI API calls
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
});

// Add the same interceptors as the main client
longTimeoutClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

longTimeoutClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!error.response) {
      console.error('Network error:', error.message);
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      if (window.location.pathname !== '/login') {
        console.log('401 Unauthorized in draftService - clearing auth and redirecting to login');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');

        // Set flag to prevent auto-login loop
        localStorage.setItem('justLoggedOut', 'true');

        // Clear MSAL cache by triggering logout through MSAL
        // This needs to be done through the MSAL instance
        // For now, we'll use a flag that PrivateRoute will handle
        localStorage.setItem('clearMSALCache', 'true');

        // Use replace to prevent back button issues
        window.location.replace('/login');
      }
    }

    return Promise.reject(error);
  }
);

export const draftService = {
  async validateDraft(data: CreateDraftRequest): Promise<ValidateDraftResponse> {
    const response = await apiClient.post('/api/v1/drafts/validate', data);
    return response.data;
  },

  async createDraft(data: CreateDraftRequest): Promise<CreateDraftResponse> {
    const response = await longTimeoutClient.post('/api/v1/drafts/initialize', data);
    return response.data;
  },

  async listLibraryPolicies(functionFilter?: string): Promise<import('../types/draft.types').LibraryPolicy[]> {
    const response = await apiClient.get('/api/v1/drafts/library-policies', {
      params: functionFilter ? { function: functionFilter } : undefined,
    });
    return response.data.policies || [];
  },

  async createDraftFromUpload(
    data: CreateDraftRequest,
    currentPolicyFile: File,
    previousPolicyFile?: File | null,
    regulationsFiles?: File[],
    benchmarkFile?: File | null,
    benchmarkPolicyId?: string | null,
    reviewIntensity?: 'preserve' | 'rebuild'
  ): Promise<CreateDraftResponse> {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('function', data.function);
    formData.append('client_name', data.client_metadata.name);
    formData.append('client_country', data.client_metadata.country);
    formData.append('client_city', data.client_metadata.city);
    formData.append('client_industry', data.client_metadata.industry);
    if (data.client_specific_requests) formData.append('client_specific_requests', data.client_specific_requests);
    if (data.sector_specific_comments) formData.append('sector_specific_comments', data.sector_specific_comments);
    formData.append('regulations', data.regulations || '');
    formData.append('detail_level', String(data.detail_level ?? 3));
    formData.append('policy_file', currentPolicyFile);
    if (previousPolicyFile) formData.append('previous_policy_file', previousPolicyFile);
    if (regulationsFiles?.length) {
      regulationsFiles.forEach(f => formData.append('regulations_files', f));
    }
    if (benchmarkFile) formData.append('benchmark_file', benchmarkFile);
    if (benchmarkPolicyId) formData.append('benchmark_policy_id', benchmarkPolicyId);
    formData.append('review_intensity', reviewIntensity || 'preserve');
    const response = await longTimeoutClient.post('/api/v1/drafts/initialize-from-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async applyPolicy(draftId: string, policyId: string | null): Promise<void> {
    await longTimeoutClient.post(`/api/v1/drafts/${draftId}/apply-policy`, { policy_id: policyId });
  },

  async generateGapReport(draftId: string, topicId: string, subtopicId?: string): Promise<import('../types/draft.types').GapReportResponse> {
    const qs = subtopicId ? `?subtopic_id=${encodeURIComponent(subtopicId)}` : '';
    const response = await longTimeoutClient.post(`/api/v1/drafts/${draftId}/topics/${topicId}/gap-report${qs}`, {});
    return response.data;
  },

  // Assess several units in one request (server runs them in parallel).
  async assessBatch(
    draftId: string,
    units: { topic_id: string; subtopic_id?: string }[]
  ): Promise<{ results: { topic_id: string; subtopic_id: string | null; gap_report: import('../types/draft.types').GapReport }[] }> {
    const response = await longTimeoutClient.post(`/api/v1/drafts/${draftId}/assess-batch`, { units });
    return response.data;
  },

  async applyGap(
    draftId: string,
    topicId: string,
    body: import('../types/draft.types').ApplyGapRequest
  ): Promise<import('../types/draft.types').ApplyGapResponse> {
    const response = await longTimeoutClient.post(`/api/v1/drafts/${draftId}/topics/${topicId}/apply-gap`, body);
    return response.data;
  },

  // Preview step: generate the proposed rewrite without persisting it.
  async previewGap(
    draftId: string,
    topicId: string,
    body: import('../types/draft.types').ApplyGapRequest
  ): Promise<import('../types/draft.types').ApplyGapResponse> {
    return this.applyGap(draftId, topicId, { ...body, preview: true });
  },

  // Confirm step: commit the reviewer-approved (possibly edited) content.
  async confirmGap(
    draftId: string,
    topicId: string,
    finalContent: string,
    subtopicId?: string
  ): Promise<import('../types/draft.types').ApplyGapResponse> {
    return this.applyGap(draftId, topicId, { confirmed_finding_ids: [], final_content: finalContent, subtopic_id: subtopicId });
  },

  // ===== Version history & audit =====
  async saveVersion(draftId: string, label?: string, reason?: string): Promise<{ version_id: string }> {
    const response = await longTimeoutClient.post(`/api/v1/drafts/${draftId}/versions`, { label, reason });
    return response.data;
  },

  async listVersions(draftId: string): Promise<import('../types/draft.types').DraftVersion[]> {
    const response = await longTimeoutClient.get(`/api/v1/drafts/${draftId}/versions`);
    return response.data;
  },

  async restoreVersion(draftId: string, versionId: string): Promise<void> {
    await longTimeoutClient.post(`/api/v1/drafts/${draftId}/versions/${versionId}/restore`, {});
  },

  async listAudit(draftId: string): Promise<import('../types/draft.types').AuditEntry[]> {
    const response = await longTimeoutClient.get(`/api/v1/drafts/${draftId}/audit`);
    return response.data;
  },

  // ===== Gap summary report =====
  async getGapSummary(draftId: string): Promise<import('../types/draft.types').GapSummary> {
    const response = await longTimeoutClient.get(`/api/v1/drafts/${draftId}/gap-summary`);
    return response.data;
  },

  async exportGapSummary(draftId: string): Promise<Blob> {
    const response = await longTimeoutClient.post(`/api/v1/drafts/${draftId}/export/gap-summary/word`, {}, { responseType: 'blob' });
    return response.data;
  },

  // ===== Whole-policy consistency pass =====
  async runConsistencyCheck(draftId: string): Promise<import('../types/draft.types').ConsistencyReport> {
    const response = await longTimeoutClient.post(`/api/v1/drafts/${draftId}/consistency-check`, {});
    return response.data;
  },

  async getDrafts(filters?: {
    title?: string;
    country?: string;
    city?: string;
    created_by?: string;
    industry?: string;
    function?: string;
  }): Promise<{ drafts: DraftSummary[]; total: number }> {
    try {
      // Build query string from filters
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) {
            params.append(key, value);
          }
        });
      }

      const queryString = params.toString();
      const url = queryString ? `/api/v1/drafts/?${queryString}` : '/api/v1/drafts/';

      const response = await apiClient.get(url);
      return response.data || { drafts: [], total: 0 };
    } catch (error) {
      console.error('Error fetching drafts:', error);
      // Return empty array instead of throwing to prevent app crashes
      return { drafts: [], total: 0 };
    }
  },

  async getDraft(id: string): Promise<Draft> {
    const response = await apiClient.get(`/api/v1/drafts/${id}`);
    return response.data;
  },

  async updateTOC(id: string, data: UpdateTOCRequest): Promise<void> {
    await apiClient.put(`/api/v1/drafts/${id}/toc`, data);
  },

  async updateDraftMetadata(id: string, data: CreateDraftRequest): Promise<void> {
    await apiClient.put(`/api/v1/drafts/${id}/metadata`, data);
  },

  async generateContent(
    draftId: string,
    topicId: string,
    data: GenerateContentRequest
  ): Promise<ContentGenerationResponse> {
    const response = await longTimeoutClient.post(
      `/api/v1/drafts/${draftId}/topics/${topicId}/generate`,
      data
    );
    return response.data;
  },

  async updateContent(
    draftId: string,
    topicId: string,
    content: string,
    subtopicId?: string,
    conversationHistory?: any[]
  ): Promise<void> {
    await apiClient.put(`/api/v1/drafts/${draftId}/topics/${topicId}/content`, {
      content,
      subtopic_id: subtopicId,
      conversation_history: conversationHistory,
    });
  },

  async deleteDraft(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/drafts/${id}`);
  },

  async getProgress(id: string): Promise<DraftProgress> {
    const response = await apiClient.get(`/api/v1/drafts/${id}/progress`);
    return response.data;
  },

  async exportToWord(id: string): Promise<Blob> {
    const response = await apiClient.post(
      `/api/v1/drafts/${id}/export/word`,
      { delete_after_export: false },
      { responseType: 'blob' }
    );
    return response.data;
  },

  async exportToPDF(id: string): Promise<Blob> {
    const response = await apiClient.post(
      `/api/v1/drafts/${id}/export/pdf`,
      { delete_after_export: false },
      { responseType: 'blob' }
    );
    return response.data;
  },

  // Review-draft export variants (word | pdf): redline = additions highlighted green / removals red +
  // strikethrough; changes overview = per-section Added/Modified/Unchanged + removed list.
  async exportRedline(id: string, format: 'word' | 'pdf' = 'word'): Promise<Blob> {
    const response = await longTimeoutClient.post(
      `/api/v1/drafts/${id}/export/redline/${format}`, {}, { responseType: 'blob' }
    );
    return response.data;
  },

  async exportChangesOverview(id: string, format: 'word' | 'pdf' = 'word'): Promise<Blob> {
    const response = await longTimeoutClient.post(
      `/api/v1/drafts/${id}/export/changes/${format}`, {}, { responseType: 'blob' }
    );
    return response.data;
  },

  // TOC Chat Methods
  async chatModifyToc(
    draftId: string,
    message: string,
    conversationHistory?: Array<{ user_message: string; ai_response: string }>,
    currentToc?: TOCTopic[],
    references?: { client_toc?: TOCTopic[]; benchmark_toc?: TOCTopic[] }
  ): Promise<TOCChatResponse> {
    const response = await apiClient.post(
      `/api/v1/drafts/${draftId}/toc/chat`,
      {
        message,
        conversation_history: conversationHistory || [],
        // The TOC the chatbot should operate on (dropdown-selected); omitted → backend uses working TOC.
        current_toc: currentToc,
        // Reference TOCs (passed when editing Good) so the bot can merge Current + Extracted + the query.
        client_toc: references?.client_toc,
        benchmark_toc: references?.benchmark_toc,
      }
    );
    return response.data;
  },

  async confirmTocModification(
    draftId: string,
    operation: TOCOperation,
    currentToc: TOCTopic[],
    target?: 'good' | 'client' | 'benchmark'
  ): Promise<TOCConfirmResponse> {
    const response = await apiClient.post(
      `/api/v1/drafts/${draftId}/toc/confirm`,
      {
        operation,
        current_toc: currentToc,
        target,
      }
    );
    return response.data;
  },

  async saveTocChatHistory(
    draftId: string,
    conversationHistory: Array<{ user_message: string; ai_response: string; timestamp?: string }>
  ): Promise<void> {
    await apiClient.put(`/api/v1/drafts/${draftId}/toc/chat-history`, {
      conversation_history: conversationHistory,
    });
  },

  // ===== Perfect-TOC-first stage (v2) =====

  // Extract a TOC structure from an uploaded .docx (to adopt as the good TOC).
  async extractTocFromFile(
    draftId: string,
    file: File
  ): Promise<{ preview_toc: import('../types/draft.types').TocStructureItem[]; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await longTimeoutClient.post(
      `/api/v1/drafts/${draftId}/toc/extract-from-file`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  // Parse a pasted/described TOC into a structure (to adopt as the good TOC).
  async tocFromText(
    draftId: string,
    text: string
  ): Promise<{ preview_toc: import('../types/draft.types').TocStructureItem[]; message: string }> {
    const response = await longTimeoutClient.post(`/api/v1/drafts/${draftId}/toc/from-text`, { text });
    return response.data;
  },

  // Adopt a TOC structure as the working good TOC (redistributes existing content by title match).
  async useToc(
    draftId: string,
    toc: import('../types/draft.types').TocStructureItem[]
  ): Promise<{ success: boolean; draft: Draft }> {
    const response = await longTimeoutClient.post(`/api/v1/drafts/${draftId}/toc/use`, { toc });
    return response.data;
  },

  // Persist an edited reference TOC. which = 'client' | 'benchmark' | 'good'.
  // 'good' adopts it as the working TOC (content redistributed by title); client/benchmark
  // update the read-only reference snapshots shown in the TOC tab.
  async saveTocSnapshot(
    draftId: string,
    which: 'client' | 'benchmark' | 'good',
    toc: import('../types/draft.types').TocStructureItem[]
  ): Promise<{ success: boolean; draft: Draft }> {
    const response = await longTimeoutClient.post(`/api/v1/drafts/${draftId}/toc/snapshot`, { which, toc });
    return response.data;
  },

  // Re-derive a fresh Good TOC by reconciling the current Current + Extracted TOCs.
  async regenerateGoodToc(draftId: string): Promise<{ success: boolean; draft: Draft }> {
    const response = await longTimeoutClient.post(`/api/v1/drafts/${draftId}/toc/regenerate-good`, {});
    return response.data;
  },

  // Lock the good TOC as the agreed structure (gate before content work).
  async approveToc(draftId: string): Promise<{ success: boolean; draft: Draft }> {
    const response = await apiClient.post(`/api/v1/drafts/${draftId}/toc/approve`, {});
    return response.data;
  },

  // Consolidate everything about a section's theme from across the whole policy (preview).
  async consolidateTheme(
    draftId: string,
    topicId: string,
    subtopicId?: string
  ): Promise<{ content: string; word_count: number; message: string }> {
    const qs = subtopicId ? `?subtopic_id=${encodeURIComponent(subtopicId)}` : '';
    const response = await longTimeoutClient.post(
      `/api/v1/drafts/${draftId}/topics/${topicId}/consolidate${qs}`,
      {}
    );
    return response.data;
  },

  // ===== Content redistribution (map original client content → current Good TOC) =====

  // Propose how the client's original content maps into the current Good TOC (read-only, editable).
  async proposeRedistribution(
    draftId: string
  ): Promise<{
    sources: { id: number; title: string; content: string; level: 'topic' | 'subtopic' }[];
    targets: { key: string; topic_id: string; subtopic_id: string | null; title: string; level: 'topic' | 'subtopic'; current_content: string; added_from_benchmark?: boolean }[];
    assignments: Record<string, string>; // source id (string) -> target key | "unassigned"
    original_missing?: boolean; // no version-0 snapshot — sources came from the LIVE draft (degraded)
  }> {
    const response = await longTimeoutClient.post(`/api/v1/drafts/${draftId}/redistribute/propose`, {});
    return response.data;
  },

  // Commit the final structure (renames/adds/removes) + content+baseline from the redistribution editor.
  async commitRedistribution(
    draftId: string,
    sections: { level: 'topic' | 'subtopic'; id: string; title: string; content: string; include: boolean }[]
  ): Promise<{ success: boolean; draft: Draft }> {
    const response = await longTimeoutClient.post(`/api/v1/drafts/${draftId}/redistribute/commit`, { sections });
    return response.data;
  },

  // Commit the reviewer-confirmed redistribution (sets content + baseline for each section).
  async applyRedistribution(
    draftId: string,
    sections: { topic_id: string; subtopic_id: string | null; content: string }[]
  ): Promise<{ success: boolean; draft: Draft }> {
    const response = await longTimeoutClient.post(`/api/v1/drafts/${draftId}/redistribute/apply`, { sections });
    return response.data;
  },

  // ===== Per-section review pipeline (review_mode drafts: benchmark → law → close) =====

  // Step 1: benchmark gap assessment for one section → baseline + benchmark + structured findings + as-is.
  async reviewBenchmark(
    draftId: string,
    topicId: string,
    subtopicId?: string
  ): Promise<{
    topic_id: string; subtopic_id: string | null;
    baseline_content: string; benchmark_content: string; benchmark_match: string | null;
    benchmark_source: 'manual' | 'pinned' | 'matched' | 'none';
    findings: import('../types/draft.types').GapFinding[]; as_is_suggestion: string; message: string;
  }> {
    const qs = subtopicId ? `?subtopic_id=${encodeURIComponent(subtopicId)}` : '';
    const response = await longTimeoutClient.post(
      `/api/v1/drafts/${draftId}/topics/${topicId}/review/benchmark${qs}`, {}
    );
    return response.data;
  },

  // Step 2: law/regulation check for one section (RAG) → {applies, extract, suggestion}.
  // has_regulations distinguishes "no regulations loaded" from "checked, none apply".
  async reviewRegulation(
    draftId: string,
    topicId: string,
    subtopicId?: string
  ): Promise<{ applies: boolean; extract: string; suggestion: string; has_regulations: boolean; check_failed?: boolean; topic_id: string; subtopic_id: string | null; message: string }> {
    const qs = subtopicId ? `?subtopic_id=${encodeURIComponent(subtopicId)}` : '';
    const response = await longTimeoutClient.post(
      `/api/v1/drafts/${draftId}/topics/${topicId}/review/regulation${qs}`, {}
    );
    return response.data;
  },

  // Re-upload regulation .docx files to an existing review draft (Review tab → Regulations).
  // Appends to the draft's regulation set so the per-section check can retrieve from it.
  async uploadRegulations(
    draftId: string,
    files: File[]
  ): Promise<{ has_regulations: boolean; added: string[]; message: string }> {
    const form = new FormData();
    files.forEach((f) => form.append('regulations_files', f));
    const response = await longTimeoutClient.post(
      `/api/v1/drafts/${draftId}/regulations/upload`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  // Persist reviewer-approved content for a section and advance its review_step.
  async reviewApply(
    draftId: string,
    topicId: string,
    content: string,
    step?: 'benchmark' | 'regulation' | 'review',
    subtopicId?: string
  ): Promise<{ content: string; summary: string; word_count: number; review_step: string; message: string }> {
    const response = await longTimeoutClient.post(
      `/api/v1/drafts/${draftId}/topics/${topicId}/review/apply`,
      { content, step, subtopic_id: subtopicId }
    );
    return response.data;
  },

  // Bank a content-ready section (review_step='closed'), or reopen it.
  async reviewClose(
    draftId: string,
    topicId: string,
    subtopicId?: string,
    reopen?: boolean
  ): Promise<{ topic_id: string; subtopic_id: string | null; review_step: string; message: string }> {
    const response = await apiClient.post(
      `/api/v1/drafts/${draftId}/topics/${topicId}/review/close`,
      { subtopic_id: subtopicId, reopen: !!reopen }
    );
    return response.data;
  },

  // Per-section review chatbot → {reply, proposed_content}. proposed_content is applied via reviewApply.
  async reviewChat(
    draftId: string,
    topicId: string,
    message: string,
    subtopicId?: string
  ): Promise<{ reply: string; proposed_content: string | null; topic_id: string; subtopic_id: string | null }> {
    const response = await longTimeoutClient.post(
      `/api/v1/drafts/${draftId}/topics/${topicId}/review/chat`,
      { message, subtopic_id: subtopicId }
    );
    return response.data;
  },

  // Set (or clear, when content is empty) the reviewer's manual benchmark text for a section.
  // When set it OVERRIDES auto-matching; re-run reviewBenchmark to assess against it.
  async setBenchmarkContent(
    draftId: string,
    topicId: string,
    content: string,
    subtopicId?: string
  ): Promise<{ topic_id: string; subtopic_id: string | null; has_manual_benchmark: boolean; message: string }> {
    const response = await apiClient.post(
      `/api/v1/drafts/${draftId}/topics/${topicId}/benchmark-content`,
      { content, subtopic_id: subtopicId }
    );
    return response.data;
  },

  // The benchmark's topics + subtopics (titles + has_content), for the Review-tab match picker.
  async getBenchmarkUnits(
    draftId: string
  ): Promise<{ units: { name: string; level: 'topic' | 'subtopic'; parent: string | null; has_content: boolean }[] }> {
    const response = await apiClient.get(`/api/v1/drafts/${draftId}/benchmark-units`);
    return response.data;
  },

  // Pin (or clear, when matchName is empty) the benchmark section a section is tested against.
  // A pin overrides auto-matching; re-run reviewBenchmark to assess against it.
  async setBenchmarkMatch(
    draftId: string,
    topicId: string,
    matchName: string,
    subtopicId?: string
  ): Promise<{ topic_id: string; subtopic_id: string | null; manual_benchmark_match: string | null; message: string }> {
    const response = await apiClient.post(
      `/api/v1/drafts/${draftId}/topics/${topicId}/benchmark-match`,
      { match_name: matchName, subtopic_id: subtopicId }
    );
    return response.data;
  },

  // Policy type methods removed - no longer using Excel templates
};