import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface QualificationLevelsContextType {
  qualificationLevels: string[];
  addQualificationLevel: (level: string) => void;
  removeQualificationLevel: (level: string) => void;
  getQualificationLevels: () => string[];
}

const QualificationLevelsContext = createContext<QualificationLevelsContextType | undefined>(undefined);

export function QualificationLevelsProvider({ children }: { children: ReactNode }) {
  const [qualificationLevels, setQualificationLevels] = useState<string[]>([]);

  // Load qualification levels from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("qualificationLevels");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setQualificationLevels(parsed);
        } else {
          // Use default levels if stored data is invalid
          setDefaultLevels();
        }
      } catch (error) {
        console.error("Failed to parse stored qualification levels:", error);
        setDefaultLevels();
      }
    } else {
      setDefaultLevels();
    }
  }, []);

  const setDefaultLevels = () => {
    const defaultLevels = ["Regional", "National", "FIFA"];
    setQualificationLevels(defaultLevels);
    localStorage.setItem("qualificationLevels", JSON.stringify(defaultLevels));
  };

  // Save qualification levels to localStorage whenever they change
  useEffect(() => {
    if (qualificationLevels.length > 0) {
      localStorage.setItem("qualificationLevels", JSON.stringify(qualificationLevels));
    }
  }, [qualificationLevels]);

  const addQualificationLevel = (level: string) => {
    if (level.trim() && !qualificationLevels.includes(level.trim())) {
      setQualificationLevels(prev => [...prev, level.trim()]);
    }
  };

  const removeQualificationLevel = (level: string) => {
    setQualificationLevels(prev => prev.filter(l => l !== level));
  };

  const getQualificationLevels = () => {
    return qualificationLevels;
  };

  return (
    <QualificationLevelsContext.Provider value={{
      qualificationLevels,
      addQualificationLevel,
      removeQualificationLevel,
      getQualificationLevels
    }}>
      {children}
    </QualificationLevelsContext.Provider>
  );
}

export function useQualificationLevels() {
  const context = useContext(QualificationLevelsContext);
  if (!context) {
    throw new Error("useQualificationLevels must be used within a QualificationLevelsProvider");
  }
  return context;
}