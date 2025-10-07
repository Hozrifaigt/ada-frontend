import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';

interface PrivateRouteProps {
  children: React.ReactElement;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { accounts, instance } = useMsal();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuthentication = () => {
      // Check if we need to clear MSAL cache (set by API interceptors)
      if (localStorage.getItem('clearMSALCache')) {
        localStorage.removeItem('clearMSALCache');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        localStorage.setItem('justLoggedOut', 'true');

        if (accounts.length > 0) {
          instance.logoutRedirect({
            postLogoutRedirectUri: '/login'
          }).catch(() => {
            setIsAuthenticated(false);
            setIsChecking(false);
          });
          return;
        }
      }

      // Check if we have a valid token in localStorage
      const token = localStorage.getItem('authToken');

      if (!token) {
        // No token, check if we have MSAL accounts
        if (accounts.length > 0) {
          // We have MSAL accounts but no token - this is the problematic state
          // Clear everything to force a fresh login
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          localStorage.setItem('justLoggedOut', 'true');
          // Clear MSAL cache to prevent auto-login loop
          instance.logoutRedirect({
            postLogoutRedirectUri: '/login'
          }).catch(() => {
            // If logout fails, still redirect to login
            setIsAuthenticated(false);
            setIsChecking(false);
          });
          return;
        }
        // No token and no accounts - not authenticated
        setIsAuthenticated(false);
        setIsChecking(false);
        return;
      }

      // We have a token - check if it's still valid (basic check)
      try {
        // Parse the token to check expiry (JWT tokens have 3 parts separated by dots)
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          const expiry = payload.exp * 1000; // Convert to milliseconds

          if (Date.now() >= expiry) {
            // Token is expired
            console.log('Token expired, clearing authentication');
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');

            // Clear MSAL cache if we have accounts
            if (accounts.length > 0) {
              localStorage.setItem('justLoggedOut', 'true');
              instance.logoutRedirect({
                postLogoutRedirectUri: '/login'
              }).catch(() => {
                setIsAuthenticated(false);
                setIsChecking(false);
              });
              return;
            }

            setIsAuthenticated(false);
            setIsChecking(false);
            return;
          }

          // Token exists and is not expired
          setIsAuthenticated(true);
          setIsChecking(false);
        } else {
          // Invalid token format
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          setIsAuthenticated(false);
          setIsChecking(false);
        }
      } catch (error) {
        console.error('Error checking token validity:', error);
        // If we can't parse the token, assume it's invalid
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        setIsChecking(false);
      }
    };

    checkAuthentication();
  }, [accounts, instance]);

  // While checking, show loading state
  if (isChecking) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-gray-600">Checking authentication...</p>
      </div>
    </div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;