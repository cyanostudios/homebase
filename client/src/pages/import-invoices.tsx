import { AppContainer } from "@/components/layout/app-container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, Database } from "lucide-react";
import { ImportInvoicesPanel } from "@/components/import/ImportInvoicesPanel";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function ImportInvoices() {
  const [activeImportType, setActiveImportType] = useState<'overview' | 'text' | 'csv' | 'api'>('overview');

  if (activeImportType === 'text') {
    return (
      <AppContainer>
        <div className="max-w-4xl mx-auto">
          <ImportInvoicesPanel onClose={() => setActiveImportType('overview')} />
        </div>
      </AppContainer>
    );
  }

  return (
    <AppContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Import Invoices</h1>
          <p className="text-neutral-600">
            Import invoice data from various sources to streamline your scheduling process.
          </p>
        </div>

        {/* Import Options Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <CardTitle className="text-lg">CSV Import</CardTitle>
              <CardDescription>
                Upload match data from CSV files with team names, dates, and venues.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-sm text-neutral-500 text-center">
                Coming soon
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Database className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-lg">API Import</CardTitle>
              <CardDescription>
                Connect to external league management systems and import match schedules.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-sm text-neutral-500 text-center">
                Coming soon
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setActiveImportType('text')}>
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <CardTitle className="text-lg">Text Import</CardTitle>
              <CardDescription>
                Paste match information directly from text sources or documents.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImportType('text');
                }}
                className="w-full"
                variant="subtleGray"
              >
                <FileText className="h-4 w-4 mr-2" />
                Start Text Import
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Additional Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Import Guidelines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-neutral-600">
              <p className="mb-3">
                When importing matches, ensure your data includes the following required fields:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Home team name</li>
                <li>Away team name</li>
                <li>Match date and time</li>
                <li>Venue information</li>
              </ul>
              <p className="mt-3">
                Optional fields that can enhance your match data include team categories, 
                match descriptions, and specific sport classifications.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppContainer>
  );
}