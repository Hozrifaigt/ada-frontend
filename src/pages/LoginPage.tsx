import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Container,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Microsoft } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../config/authConfig';
import { useApp } from '../context/AppContext';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { instance, accounts } = useMsal();
  const { login } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already logged in or just completed login redirect
  useEffect(() => {
    const checkAccount = async () => {
      // Check if we're coming from a logout redirect
      const urlParams = new URLSearchParams(window.location.search);
      const isLogoutRedirect = urlParams.get('logout') === 'true';

      if (isLogoutRedirect) {
        // Clear any remaining auth state
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');

        // Clear the logout parameter from URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return; // Don't auto-login after logout
      }

      // First, ensure redirect promise is handled
      try {
        const response = await instance.handleRedirectPromise();
        if (response) {
          // Just logged in via redirect
          const account = response.account;
          instance.setActiveAccount(account);

          const user = {
            user_id: account.localAccountId,
            name: account.name || account.username,
            email: account.username,
          };

          localStorage.setItem('authToken', response.idToken);
          localStorage.setItem('user', JSON.stringify(user));
          login(response.idToken, user);
          navigate('/drafts');
          return;
        }
      } catch (error) {
        console.error('Redirect handling error:', error);
      }

      // Check for existing accounts (but not if we just logged out)
      if (accounts.length > 0 && !localStorage.getItem('justLoggedOut')) {
        // Check if we already have a valid token
        const existingToken = localStorage.getItem('authToken');

        if (existingToken) {
          try {
            // Check if the existing token is still valid
            const tokenParts = existingToken.split('.');
            if (tokenParts.length === 3) {
              const payload = JSON.parse(atob(tokenParts[1]));
              const expiry = payload.exp * 1000;

              if (Date.now() < expiry) {
                // Token is still valid, redirect to drafts
                navigate('/drafts');
                return;
              }
            }
          } catch (error) {
            console.error('Error checking existing token:', error);
          }
        }

        // No valid token, try to acquire one silently
        const account = accounts[0];
        const user = {
          user_id: account.localAccountId,
          name: account.name || account.username,
          email: account.username,
        };

        // Get the ID token to use as bearer token
        instance.acquireTokenSilent({
          ...loginRequest,
          account: account
        }).then(response => {
          localStorage.setItem('authToken', response.idToken);
          localStorage.setItem('user', JSON.stringify(user));
          login(response.idToken, user);
          navigate('/drafts');
        }).catch(error => {
          console.error('Token acquisition failed:', error);
          // Token acquisition failed - clear the MSAL cache and stay on login page
          localStorage.setItem('justLoggedOut', 'true');
          instance.logoutRedirect({
            postLogoutRedirectUri: '/login'
          }).catch(() => {
            // Even if logout fails, stay on login page
            console.log('MSAL logout failed, but staying on login page');
          });
        });
      }

      // Clean up the flag after check (with a small delay to ensure it's used)
      setTimeout(() => {
        localStorage.removeItem('justLoggedOut');
      }, 1000);
    };

    checkAccount();
  }, [accounts, instance, login, navigate]);

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      // Initiate login with Microsoft using redirect instead of popup
      // This will redirect the user to Microsoft login page
      await instance.loginRedirect(loginRequest);
      // The response will be handled when the user is redirected back to the app
      // The useEffect hook above will handle the logged-in state
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Login failed. Please ensure you use your Grant Thornton credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
        <Paper elevation={3} sx={{ p: 5 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography variant="h3" component="h1" gutterBottom color="primary">
              ADA
            </Typography>
            <Typography variant="h5" gutterBottom>
              Policy Drafting Application
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Sign in to create and manage your policy documents
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Box sx={{ mt: 4 }}>
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={loading ? <CircularProgress size={20} /> : <Microsoft />}
              onClick={handleMicrosoftLogin}
              disabled={loading}
              sx={{ py: 1.5 }}
            >
              {loading ? 'Signing in...' : 'Sign in with Microsoft'}
            </Button>

            <Typography variant="body2" sx={{ mt: 2, textAlign: 'center', color: 'text.secondary' }}>
              Use your Grant Thornton's Microsoft account to sign in
            </Typography>
          </Box>

        </Paper>

        <Typography
          variant="body2"
          color="text.secondary"
          align="center"
          sx={{ mt: 3 }}
        >
          © 2025 ADA Project. All rights reserved.
        </Typography>
      </Box>
    </Container>
  );
};

export default LoginPage;