import { Configuration, PublicClientApplication } from '@azure/msal-browser';

// Get environment variables with fallback
const clientId = process.env.REACT_APP_AZURE_CLIENT_ID || '97e38bae-2ff0-43c9-a427-de20446dbecf';
const tenantId = process.env.REACT_APP_AZURE_TENANT_ID || '080926ad-2234-4380-b488-3da6b11ddfc1';
const redirectUri = process.env.REACT_APP_AZURE_REDIRECT_URI || 'http://localhost:3000';

// Log configuration for debugging (remove in production)
console.log('MSAL Configuration:', {
  clientId: clientId ? 'Set' : 'Missing',
  tenantId: tenantId ? 'Set' : 'Missing',
  redirectUri: redirectUri
});

// MSAL configuration for Microsoft Azure AD authentication
export const msalConfig: Configuration = {
  auth: {
    clientId: clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: redirectUri,
    postLogoutRedirectUri: redirectUri, // Add explicit post-logout redirect
    navigateToLoginRequestUrl: false, // Prevent navigation to previous page after login
  },
  cache: {
    cacheLocation: 'localStorage', // This configures where your tokens are cached
    storeAuthStateInCookie: false, // Set to true if you have issues on IE11 or Edge
  },
};

// Scopes you want to request from Azure AD
export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};

// Initialize MSAL instance
export const msalInstance = new PublicClientApplication(msalConfig);

// Handle redirect promise on page load
msalInstance.initialize().then(() => {
  msalInstance.handleRedirectPromise()
    .then((response) => {
      if (response) {
        // User has been successfully authenticated
        msalInstance.setActiveAccount(response.account);
      } else {
        // Check if we have accounts
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          msalInstance.setActiveAccount(accounts[0]);
        }
      }
    })
    .catch((error) => {
      console.error('Redirect error:', error);
    });
});

// API scope for your backend
export const apiRequest = {
  scopes: [`api://${clientId}/access_as_user`], // Your API scope
};