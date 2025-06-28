import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest } from "@/lib/queryClient";

type TeamSizeFormatsContextType = {
  teamSizeFormats: string[];
  addTeamSizeFormat: (format: string) => void;
  removeTeamSizeFormat: (format: string) => void;
  isLoading: boolean;
};

const TeamSizeFormatsContext = createContext<TeamSizeFormatsContextType | undefined>(undefined);

const DEFAULT_FORMATS = [
  "fullsize",
  "small", 
  "mini",
  "futsal",
  "street",
  "individual"
];

export function TeamSizeFormatsProvider({ children }: { children: ReactNode }) {
  const [teamSizeFormats, setTeamSizeFormats] = useState<string[]>(DEFAULT_FORMATS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTeamSizeFormats();
  }, []);

  const loadTeamSizeFormats = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/settings/team_size_formats");
      
      if (response.ok) {
        const setting = await response.json();
        const formats = JSON.parse(setting.value);
        setTeamSizeFormats(formats);
      } else if (response.status === 404) {
        // Setting doesn't exist, create it with defaults
        await saveTeamSizeFormats(DEFAULT_FORMATS);
      }
    } catch (error) {
      // If loading fails, keep defaults
      setTeamSizeFormats(DEFAULT_FORMATS);
    } finally {
      setIsLoading(false);
    }
  };

  const saveTeamSizeFormats = async (formats: string[]) => {
    try {
      await fetch("/api/settings/team_size_formats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          value: JSON.stringify(formats),
          type: "json"
        }),
      });
    } catch (error) {
      // Handle save error silently for now
    }
  };

  const addTeamSizeFormat = async (format: string) => {
    if (!teamSizeFormats.includes(format)) {
      const newFormats = [...teamSizeFormats, format];
      setTeamSizeFormats(newFormats);
      await saveTeamSizeFormats(newFormats);
    }
  };

  const removeTeamSizeFormat = async (format: string) => {
    const newFormats = teamSizeFormats.filter(f => f !== format);
    setTeamSizeFormats(newFormats);
    await saveTeamSizeFormats(newFormats);
  };

  return (
    <TeamSizeFormatsContext.Provider value={{
      teamSizeFormats,
      addTeamSizeFormat,
      removeTeamSizeFormat,
      isLoading,
    }}>
      {children}
    </TeamSizeFormatsContext.Provider>
  );
}

export function useTeamSizeFormats() {
  const context = useContext(TeamSizeFormatsContext);
  if (context === undefined) {
    throw new Error("useTeamSizeFormats must be used within a TeamSizeFormatsProvider");
  }
  return context;
}