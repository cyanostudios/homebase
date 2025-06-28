import React, { useState } from "react";
import { useQualificationLevels } from "@/context/qualification-levels-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

export function QualificationLevelsSettings() {
  const { qualificationLevels, addQualificationLevel, removeQualificationLevel } = useQualificationLevels();
  const [newLevel, setNewLevel] = useState("");
  const { toast } = useToast();

  const handleAddLevel = () => {
    if (newLevel.trim()) {
      if (qualificationLevels.includes(newLevel.trim())) {
        toast({
          title: "Level already exists",
          description: "This qualification level is already in your list.",
          variant: "destructive",
        });
        return;
      }
      
      addQualificationLevel(newLevel.trim());
      setNewLevel("");
      toast({
        title: "Level added",
        description: `"${newLevel.trim()}" has been added to your qualification levels.`,
      });
    }
  };

  const handleRemoveLevel = (level: string) => {
    removeQualificationLevel(level);
    toast({
      title: "Level removed",
      description: `"${level}" has been removed from your qualification levels.`,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddLevel();
    }
  };

  return (
    <div className="space-y-4">
      
      <div className="flex gap-3">
        <Input
          placeholder="Enter new qualification level"
          value={newLevel}
          onChange={(e) => setNewLevel(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1 h-9 text-sm"
        />
        <Button 
          onClick={handleAddLevel}
          size="sm"
          className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
          disabled={!newLevel.trim()}
        >
          Add
        </Button>
      </div>
      
      {qualificationLevels.length === 0 ? (
        <p className="text-neutral-500 text-sm">No qualification levels added yet.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
          {qualificationLevels.map((level) => (
            <span 
              key={level}
              className="inline-flex items-center justify-between gap-1 px-2 py-1 bg-neutral-50 border border-neutral-200 text-neutral-700 rounded text-xs hover:bg-neutral-100 transition-colors"
            >
              <span className="truncate text-xs">{level}</span>
              <button
                onClick={() => handleRemoveLevel(level)}
                className="text-neutral-400 hover:text-red-500 transition-colors flex-shrink-0"
                aria-label={`Remove ${level}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      
      <p className="text-xs text-neutral-500">
        These qualification levels will be available when creating or editing referee profiles.
      </p>
    </div>
  );
}