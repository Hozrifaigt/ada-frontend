import { apiClient } from './api/client';
import axios from 'axios';
import {
  Draft,
  DraftSummary,
  CreateDraftRequest,
  UpdateTOCRequest,
  GenerateContentRequest,
  ContentGenerationResponse,
  DraftProgress,
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
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export const draftService = {
  async createDraft(data: CreateDraftRequest): Promise<{ draft_id: string; draft: Draft }> {
    const response = await longTimeoutClient.post('/api/v1/drafts/initialize', data);
    return response.data;
  },

  async getDrafts(): Promise<{ drafts: DraftSummary[]; total: number }> {
    const response = await apiClient.get('/api/v1/drafts/');
    return response.data;
  },

  async getDraft(id: string): Promise<Draft> {
    const response = await apiClient.get(`/api/v1/drafts/${id}`);
    return response.data;
  },

  async updateTOC(id: string, data: UpdateTOCRequest): Promise<void> {
    await apiClient.put(`/api/v1/drafts/${id}/toc`, data);
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
};