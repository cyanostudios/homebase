import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest } from "@/lib/queryClient";

type TeamCategoriesContextType = {
  teamCategories: string[];
  addTeamCategory: (category: string) => void;
  removeTeamCategory: (category: string) => void;
  isLoading: boolean;
};

const TeamCategoriesContext = createContext<TeamCategoriesContextType | undefined>(undefined);

const DEFAULT_CATEGORIES = [
  "Senior",
  "Youth", 
  "Junior",
  "Veterans",
  "Women"
];

export function TeamCategoriesProvider({ children }: { children: ReactNode }) {
  const [teamCategories, setTeamCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Clear any old localStorage data that might interfere
    localStorage.removeItem("teamCategories");
    loadTeamCategories();
  }, []);

  const loadTeamCategories = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/settings/team_categories");
      
      if (response.ok) {
        const setting = await response.json();
        const categories = JSON.parse(setting.value);
        setTeamCategories(categories);
      } else if (response.status === 404) {
        // Setting doesn't exist, create it with defaults
        await saveTeamCategories(DEFAULT_CATEGORIES);
        setTeamCategories(DEFAULT_CATEGORIES);
      }
    } catch (error) {
      console.error("Failed to load team categories:", error);
      // If loading fails, keep defaults
      setTeamCategories(DEFAULT_CATEGORIES);
    } finally {
      setIsLoading(false);
    }
  };

  const saveTeamCategories = async (categories: string[]) => {
    try {
      await fetch("/api/settings/team_categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          value: JSON.stringify(categories),
          type: "json"
        }),
      });
    } catch (error) {
      // Handle save error silently for now
    }
  };

  const addTeamCategory = async (category: string) => {
    if (!teamCategories.includes(category)) {
      const newCategories = [...teamCategories, category];
      setTeamCategories(newCategories);
      await saveTeamCategories(newCategories);
    }
  };

  const removeTeamCategory = async (category: string) => {
    const newCategories = teamCategories.filter(c => c !== category);
    setTeamCategories(newCategories);
    await saveTeamCategories(newCategories);
  };

  return (
    <TeamCategoriesContext.Provider value={{
      teamCategories,
      addTeamCategory,
      removeTeamCategory,
      isLoading,
    }}>
      {children}
    </TeamCategoriesContext.Provider>
  );
}

export function useTeamCategories() {
  const context = useContext(TeamCategoriesContext);
  if (context === undefined) {
    throw new Error("useTeamCategories must be used within a TeamCategoriesProvider");
  }
  return context;
}