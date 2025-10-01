import { apiClient } from './api/client';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: {
    user_id: string;
    email: string;
    name: string;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      // Use development auth endpoint
      const response = await apiClient.post('/api/v1/auth/dev-login', credentials);
      return response.data;
    } catch (error: any) {
      // Check if it's an authentication error
      if (error.response?.status === 401) {
        throw new Error('Invalid email or password');
      }
      // Check if development mode is not enabled
      if (error.response?.status === 403) {
        throw new Error('Development login is not available. Please use Microsoft login.');
      }
      // Network or other errors
      throw new Error(error.response?.data?.detail || 'Login failed. Please try again.');
    }
  },

  async register(data: RegisterRequest): Promise<LoginResponse> {
    try {
      const response = await apiClient.post('/auth/register', data);
      return response.data;
    } catch (error) {
      // Demo mode fallback
      const mockResponse: LoginResponse = {
        access_token: 'demo-token-' + Date.now(),
        token_type: 'Bearer',
        user: {
          user_id: 'demo-user-' + Date.now(),
          email: data.email,
          name: data.name,
        },
      };
      return mockResponse;
    }
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      // Continue with local logout even if API call fails
    }
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  },

  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await apiClient.post('/api/v1/auth/validate-token');
      return response.data.valid === true;
    } catch (error) {
      return false;
    }
  },

  async getCurrentUser(): Promise<LoginResponse['user'] | null> {
    const token = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      return null;
    }

    try {
      // Try to get fresh user data from API
      const response = await apiClient.get('/api/v1/auth/me');
      return response.data;
    } catch (error) {
      // Return stored user data as fallback
      return JSON.parse(storedUser);
    }
  },

  // Demo login for quick access during development
  async demoLogin(): Promise<LoginResponse> {
    return this.login({
      email: 'demo@adapolicy.com',
      password: 'demo123',
    });
  },
};