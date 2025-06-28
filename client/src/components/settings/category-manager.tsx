import { useState, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";

export function CategoryManager({
  categories,
  addCategory,
  removeCategory,
  placeholder,
  label
}: {
  categories: string[];
  addCategory: (category: string) => void;
  removeCategory: (category: string) => void;
  placeholder: string;
  label: string;
}) {
  const [inputValue, setInputValue] = useState("");

  const handleAddCategory = () => {
    if (inputValue.trim() && !categories.includes(inputValue.trim())) {
      addCategory(inputValue.trim());
      setInputValue("");
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCategory();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Input
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          className="flex-1 h-9 text-sm"
        />
        <Button 
          onClick={handleAddCategory}
          size="sm"
          className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap flex items-center space-x-2"
        >
          <Plus className="h-3 w-3" />
          <span>Add</span>
        </Button>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
        {categories.map((category) => (
          <span 
            key={category}
            className="inline-flex items-center justify-between gap-1 px-2 py-1 bg-neutral-50 border border-neutral-200 text-neutral-700 rounded text-xs hover:bg-neutral-100 transition-colors"
          >
            <span className="truncate text-xs">{category}</span>
            <button
              onClick={() => removeCategory(category)}
              className="text-neutral-400 hover:text-red-500 transition-colors flex-shrink-0"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
      {categories.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-neutral-400">No {label.toLowerCase()} configured</p>
          <p className="text-xs text-neutral-300 mt-1">Add your first {label.toLowerCase().slice(0, -1)} above</p>
        </div>
      )}
    </div>
  );
}