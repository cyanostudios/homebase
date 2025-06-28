import { Switch, Route, useLocation } from "wouter";
import Dashboard from "@/pages/dashboard";
import Invoices from "@/pages/invoices";
import ImportInvoices from "@/pages/import-invoices";
import Contacts from "@/pages/contacts";
import Settings from "@/pages/settings";
import Stats from "@/pages/stats";
import Calendar from "@/pages/calendar";

import NotFound from "@/pages/not-found";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function getPageTitle(pathname: string): string {
  switch (pathname) {
    case "/":
      return "Dashboard";
    case "/invoices":
      return "Invoices";
    case "/invoices/import":
      return "Import Invoices";
    case "/calendar":
      return "Calendar";
    case "/contacts":
      return "Contacts";
    case "/stats":
      return "Statistics";
    case "/settings":
      return "Settings";

    default:
      return "Page Not Found";
  }
}

function getPageDescription(pathname: string): string {
  switch (pathname) {
    case "/":
      return "Overview of system activity";
    case "/invoices":
      return "Manage game information";
    case "/invoices/import":
      return "Import invoice data from external sources";
    case "/calendar":
      return "View schedule";
    case "/contacts":
      return "Manage contact profiles and availability";
    case "/stats":
      return "Review data insights";
    case "/settings":
      return "Configure app preferences";

    default:
      return "Page Not Found";
  }
}

export function MainContentArea() {
  return (
    <div className="main-content">
      <div className="main-content__container middle-column-content">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/invoices" component={Invoices} />
          <Route path="/invoices/import" component={ImportInvoices} />
          <Route path="/calendar" component={Calendar} />
          <Route path="/contacts" component={Contacts} />
          <Route path="/stats" component={Stats} />
          <Route path="/settings" component={Settings} />

          <Route component={NotFound} />
        </Switch>
      </div>
    </div>
  );
}