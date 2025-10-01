import React from 'react';
import { Navigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';

interface PrivateRouteProps {
  children: React.ReactElement;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { accounts } = useMsal();
  const isAuthenticated = accounts.length > 0 || localStorage.getItem('authToken') !== null;

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;