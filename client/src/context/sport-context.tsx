import { createContext, useContext, useState, ReactNode, useEffect } from "react";

// Define the type for the sport context
type SportContextType = {
  defaultSport: string;
  setDefaultSport: (sport: string) => void;
};

// Create the context with an undefined default value
const SportContext = createContext<SportContextType | undefined>(undefined);

// Sport context provider component
export function SportProvider({ children }: { children: ReactNode }) {
  // Use local storage to persist the default sport
  const [defaultSport, setDefaultSport] = useState<string>(() => {
    // Try to get the value from localStorage, default to "football" if not found
    const savedSport = localStorage.getItem("defaultSport");
    return savedSport || "football";
  });

  // Update localStorage when the default sport changes
  useEffect(() => {
    localStorage.setItem("defaultSport", defaultSport);
  }, [defaultSport]);

  // The context value
  const value = {
    defaultSport,
    setDefaultSport,
  };

  return <SportContext.Provider value={value}>{children}</SportContext.Provider>;
}

// Custom hook to use the sport context
export function useSport() {
  const context = useContext(SportContext);
  if (context === undefined) {
    throw new Error("useSport must be used within a SportProvider");
  }
  return context;
}