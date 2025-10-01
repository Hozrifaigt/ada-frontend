import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Draft } from '../types/draft.types';

interface User {
  user_id: string;
  name: string;
  email: string;
}

interface AppContextValue {
  currentDraft: Draft | null;
  setCurrentDraft: (draft: Draft | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentDraft, setCurrentDraft] = useState<Draft | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check for existing auth on mount
    const token = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
  }, []);

  const login = (token: string, userData: User) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
    setCurrentDraft(null);
  };

  return (
    <AppContext.Provider
      value={{
        currentDraft,
        setCurrentDraft,
        isLoading,
        setIsLoading,
        user,
        isAuthenticated,
        login,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};