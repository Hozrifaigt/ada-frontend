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

  // TOC Chat Methods
  async chatModifyToc(
    draftId: string,
    message: string,
    conversationHistory?: Array<{ user_message: string; ai_response: string }>
  ): Promise<TOCChatResponse> {
    const response = await apiClient.post(
      `/api/v1/drafts/${draftId}/toc/chat`,
      {
        message,
        conversation_history: conversationHistory || []
      }
    );
    return response.data;
  },

  async confirmTocModification(
    draftId: string,
    operation: TOCOperation,
    currentToc: TOCTopic[]
  ): Promise<TOCConfirmResponse> {
    const response = await apiClient.post(
      `/api/v1/drafts/${draftId}/toc/confirm`,
      {
        operation,
        current_toc: currentToc
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

  // Policy type methods removed - no longer using Excel templates
};