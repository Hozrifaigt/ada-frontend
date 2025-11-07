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
  TOCTopic,
  TOCChatResponse,
  TOCOperation,
  TOCConfirmResponse,
  GetPolicyTypesResponse
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
  async validateDraft(data: CreateDraftRequest): Promise<import('../types/draft.types').ValidateDraftResponse> {
    const response = await apiClient.post('/api/v1/drafts/validate', data);
    return response.data;
  },

  async createDraft(data: CreateDraftRequest): Promise<CreateDraftResponse> {
    const response = await longTimeoutClient.post('/api/v1/drafts/initialize', data);
    return response.data;
  },

  async getDrafts(filters?: {
    title?: string;
    country?: string;
    city?: string;
    created_by?: string;
    industry?: string;
    function?: string;
    policy_type?: string;
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

  async getPolicyTypes(functionName: string): Promise<GetPolicyTypesResponse> {
    const response = await apiClient.get(`/api/v1/drafts/policy-templates`, {
      params: { function: functionName }
    });
    return response.data;
  },

  async getFunctions(): Promise<GetPolicyTypesResponse> {
    const response = await apiClient.get(`/api/v1/drafts/functions`);
    return response.data;
  },
};