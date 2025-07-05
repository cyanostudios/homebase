import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/context/app-context";
import { ViewModeProvider } from "@/context/view-mode-context";
import { TimeFormatProvider } from "@/context/time-format-context";
import { DateFormatProvider } from "@/context/date-format-context";
import { CityProvider } from "@/context/city-context";
import { ThemeProvider } from "next-themes";
import { MainLayout } from "@/components/layout/modules/MainLayout";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Invoices from "@/pages/invoices";
import Contacts from "@/pages/contacts";
import Calendar from "@/pages/calendar";
import Statistics from "@/pages/stats";
import Settings from "@/pages/settings";

import { useViewMode } from "@/context/view-mode-context";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme="light" storageKey="homebase-theme">
        <TooltipProvider>
          <ViewModeProvider>
            <AppContent />
          </ViewModeProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function AppContent() {
  const { viewMode } = useViewMode();
  
  // Apply contact-mode class based on current view mode
  const isContactMode = viewMode === 'contact';
  
  return (
    <TimeFormatProvider>
      <DateFormatProvider>
        <CityProvider>
          <AppProvider>
            <div className={`relative min-h-screen bg-neutral-50 ${isContactMode ? 'contact-mode' : ''}`}>
              {/* Main Layout - 3 Columns with Fixed TopBar */}
              <MainLayout />
            </div>
            <Toaster />
          </AppProvider>
        </CityProvider>
      </DateFormatProvider>
    </TimeFormatProvider>
  );
}

export default App;
