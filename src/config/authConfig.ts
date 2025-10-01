import { Configuration, PublicClientApplication } from '@azure/msal-browser';

// MSAL configuration for Microsoft Azure AD authentication
export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.REACT_APP_AZURE_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${process.env.REACT_APP_AZURE_TENANT_ID || 'common'}`,
    redirectUri: process.env.REACT_APP_AZURE_REDIRECT_URI || window.location.origin,
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

// API scope for your backend
export const apiRequest = {
  scopes: [`api://${process.env.REACT_APP_AZURE_CLIENT_ID}/access_as_user`], // Your API scope
};