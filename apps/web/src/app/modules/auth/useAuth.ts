import React, { createContext, useContext } from 'react';

// Placeholder auth context and provider; real state management will be added later
export const AuthContext = createContext<{ user: unknown }>({ user: null });

export const AuthProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AuthContext.Provider value={{ user: null }}>{children}</AuthContext.Provider>
);

export const useAuth = () => useContext(AuthContext);
