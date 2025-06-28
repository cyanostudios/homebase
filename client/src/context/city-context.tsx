import { createContext, useContext, useState, ReactNode, useEffect } from "react";

// Define the type for the city context
type CityContextType = {
  defaultCity: string;
  setDefaultCity: (city: string) => void;
};

// Create the context with an undefined default value
const CityContext = createContext<CityContextType | undefined>(undefined);

// City context provider component
export function CityProvider({ children }: { children: ReactNode }) {
  // Use local storage to persist the default city
  const [defaultCity, setDefaultCity] = useState<string>(() => {
    // Try to get the value from localStorage, default to "Malmö" if not found
    const savedCity = localStorage.getItem("defaultCity");
    return savedCity || "Malmö";
  });

  // Update localStorage when the default city changes
  useEffect(() => {
    localStorage.setItem("defaultCity", defaultCity);
  }, [defaultCity]);

  // The context value
  const value = {
    defaultCity,
    setDefaultCity,
  };

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

// Custom hook to use the city context
export function useCity() {
  const context = useContext(CityContext);
  if (context === undefined) {
    throw new Error("useCity must be used within a CityProvider");
  }
  return context;
}