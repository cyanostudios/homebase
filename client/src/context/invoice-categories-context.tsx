import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest } from "@/lib/queryClient";

type InvoiceCategoriesContextType = {
  invoiceCategories: string[];
  addInvoiceCategory: (category: string) => void;
  removeInvoiceCategory: (category: string) => void;
  isLoading: boolean;
};

const InvoiceCategoriesContext = createContext<InvoiceCategoriesContextType | undefined>(undefined);

const DEFAULT_CATEGORIES = [
  "Premier League",
  "Championship", 
  "League One",
  "League Two",
  "FA Cup",
  "Carabao Cup",
  "Youth League",
  "Women's League"
];

export function InvoiceCategoriesProvider({ children }: { children: ReactNode }) {
  const [invoiceCategories, setInvoiceCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Clear any old localStorage data that might interfere
    localStorage.removeItem("invoiceCategories");
    loadInvoiceCategories();
  }, []);

  const loadInvoiceCategories = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/settings/invoice_categories");
      
      if (response.ok) {
        const setting = await response.json();
        const categories = JSON.parse(setting.value);
        setInvoiceCategories(categories);
      } else if (response.status === 404) {
        // Setting doesn't exist, create it with defaults
        await saveInvoiceCategories(DEFAULT_CATEGORIES);
        setInvoiceCategories(DEFAULT_CATEGORIES);
      }
    } catch (error) {
      console.error("Failed to load invoice categories:", error);
      // If loading fails, keep defaults
      setInvoiceCategories(DEFAULT_CATEGORIES);
    } finally {
      setIsLoading(false);
    }
  };

  const saveInvoiceCategories = async (categories: string[]) => {
    try {
      await fetch("/api/settings/invoice_categories", {
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

  const addInvoiceCategory = async (category: string) => {
    if (!invoiceCategories.includes(category)) {
      const newCategories = [...invoiceCategories, category];
      setInvoiceCategories(newCategories);
      await saveInvoiceCategories(newCategories);
    }
  };

  const removeInvoiceCategory = async (category: string) => {
    const newCategories = invoiceCategories.filter(c => c !== category);
    setInvoiceCategories(newCategories);
    await saveInvoiceCategories(newCategories);
  };

  return (
    <InvoiceCategoriesContext.Provider value={{
      invoiceCategories,
      addInvoiceCategory,
      removeInvoiceCategory,
      isLoading,
    }}>
      {children}
    </InvoiceCategoriesContext.Provider>
  );
}

export function useInvoiceCategories() {
  const context = useContext(InvoiceCategoriesContext);
  if (context === undefined) {
    throw new Error("useInvoiceCategories must be used within an InvoiceCategoriesProvider");
  }
  return context;
}