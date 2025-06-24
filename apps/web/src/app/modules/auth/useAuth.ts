import { createContext, useContext } from 'react';

// Placeholder auth context; real state management will be added later
export const AuthContext = createContext<{ user: unknown }>({ user: null });

export const useAuth = () => useContext(AuthContext);
