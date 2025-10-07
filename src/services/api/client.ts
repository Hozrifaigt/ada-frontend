import axios, { AxiosResponse, AxiosError } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // Increased to 2 minutes for embedding generation and similarity search
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false, // Set to true if using cookies
});

// Request interceptor to add auth token if available
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    // Handle network errors
    if (!error.response) {
      console.error('Network error:', error.message);
      // Don't redirect on network errors, just reject
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      // Don't redirect if already on login page
      if (window.location.pathname !== '/login') {
        console.log('401 Unauthorized - clearing auth and redirecting to login');
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