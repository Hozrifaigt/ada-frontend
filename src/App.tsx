import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { MsalProvider } from '@azure/msal-react';
import { theme } from './styles/theme';
import { AppProvider } from './context/AppContext';
import { msalInstance } from './config/authConfig';
import AuthenticatedLayout from './components/common/AuthenticatedLayout';
import PrivateRoute from './components/common/PrivateRoute';
import LoginPage from './pages/LoginPage';
import DraftsPage from './pages/DraftsPage';
import DraftEditPage from './pages/DraftEditPage';
import NewDraftPage from './pages/NewDraftPage';
import ProfilePage from './pages/ProfilePage';
import HelpPage from './pages/HelpPage';
import AdminPage from './pages/AdminPage';
import NotFoundPage from './pages/NotFoundPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  // Debug: Check if environment variables are loaded
  React.useEffect(() => {
    if (!process.env.REACT_APP_AZURE_CLIENT_ID) {
      console.warn('⚠️ REACT_APP_AZURE_CLIENT_ID is not set. Using fallback value.');
    }
    if (!process.env.REACT_APP_AZURE_TENANT_ID) {
      console.warn('⚠️ REACT_APP_AZURE_TENANT_ID is not set. Using fallback value.');
    }
  }, []);

  return (
    <MsalProvider instance={msalInstance}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Router>
            <AppProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Navigate to="/login" replace />} />

              {/* Protected routes */}
              <Route
                path="/drafts"
                element={
                  <PrivateRoute>
                    <AuthenticatedLayout>
                      <DraftsPage />
                    </AuthenticatedLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/drafts/new"
                element={
                  <PrivateRoute>
                    <AuthenticatedLayout>
                      <NewDraftPage />
                    </AuthenticatedLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/drafts/:id"
                element={
                  <PrivateRoute>
                    <AuthenticatedLayout>
                      <DraftEditPage />
                    </AuthenticatedLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <PrivateRoute>
                    <AuthenticatedLayout>
                      <ProfilePage />
                    </AuthenticatedLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/help"
                element={
                  <PrivateRoute>
                    <AuthenticatedLayout>
                      <HelpPage />
                    </AuthenticatedLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <PrivateRoute>
                    <AuthenticatedLayout>
                      <AdminPage />
                    </AuthenticatedLayout>
                  </PrivateRoute>
                }
              />

              {/* 404 page */}
              <Route path="/404" element={<NotFoundPage />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </AppProvider>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
    </MsalProvider>
  );
}

export default App;