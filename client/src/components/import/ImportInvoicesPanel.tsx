import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Upload, Eye, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ParsedInvoice {
  id?: string;
  homeTeam: string;
  awayTeam: string;
  dateTime: string;
  venue?: string;
  city?: string;
  category?: string;
  description?: string;
  sport?: string;
  team?: string;
  teamCategory?: string;
  teamSize?: string;
  status?: string;
  isValid: boolean;
  errors: string[];
  rawLine: string;
}

interface ImportInvoicesPanelProps {
  onClose?: () => void;
}

export function ImportInvoicesPanel({ onClose }: ImportInvoicesPanelProps) {
  const [textInput, setTextInput] = useState("");
  const [parsedInvoices, setParsedInvoices] = useState<ParsedInvoice[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const queryClient = useQueryClient();

  // Fetch settings for categories and formats
  const { data: defaultSport, isLoading: loadingDefaultSport } = useQuery<{value: string}>({
    queryKey: ['/api/settings/default_sport'],
  });

  const { data: invoiceCategories, isLoading: loadingInvoiceCategories } = useQuery<{value: string}>({
    queryKey: ['/api/settings/invoice_categories'],
  });

  const { data: teamCategories, isLoading: loadingTeamCategories } = useQuery<{value: string}>({
    queryKey: ['/api/settings/team_categories'],
  });

  const { data: teamSizeFormats, isLoading: loadingTeamSizeFormats } = useQuery<{value: string}>({
    queryKey: ['/api/settings/team_size_formats'],
  });

  const { data: defaultTeamSize, isLoading: loadingDefaultTeamSize } = useQuery<{value: string}>({
    queryKey: ['/api/settings/default_team_size'],
  });

  const settingsLoading = loadingDefaultSport || loadingMatchCategories || loadingTeamCategories || loadingTeamSizeFormats || loadingDefaultTeamSize;

  // Mutation for importing invoices
  const importMutation = useMutation({
    mutationFn: async (matches: ParsedMatch[]) => {
      const results = [];
      for (const match of matches) {
        const invoiceData = {
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          dateTime: match.dateTime,
          venue: match.venue || '',
          city: match.city || '',
          category: match.category || '',
          description: `${match.teamCategory || ''} - ${match.teamSize || ''}`.replace(/^[\s-]+|[\s-]+$/g, '') || 'Invoice',
          sport: match.sport || defaultSport?.value || 'Football',
          team: `${match.teamCategory || ''} ${match.teamSize || ''}`.trim() || 'Team',
          status: match.status || 'SCHEDULED',
          clubId: 1 // Default club ID
        };

        const response = await apiRequest('POST', '/api/invoices', invoiceData);
        results.push(await response.json());
      }
      return results;
    },
    onSuccess: (data) => {
      // Invalidate invoices query to refresh the table
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      setImportResult({ 
        success: true, 
        message: `Successfully imported ${data.length} invoices`
      });
      
      // Clear input and preview after successful import
      setTextInput('');
      setParsedMatches([]);
      setShowPreview(false);
    },
    onError: (error) => {
      setImportResult({ 
        success: false, 
        message: 'Failed to import invoices. Please try again.'
      });
    }
  });

  // Parse text input into invoice objects
  const parseTextInput = (text: string): ParsedMatch[] => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    
    return lines.map((line, index) => {
      const errors: string[] = [];
      const parts = line.split(',').map(part => part.trim());
      
      // Expected format: Date, Home Team, Away Team, Venue, City, Category, Team Category, Team Size
      // Minimum required: Date, Home Team, Away Team
      if (parts.length < 3) {
        errors.push('Minimum 3 fields required: Date, Home Team, Away Team');
      }

      const dateStr = parts[0] || '';
      const homeTeam = parts[1] || '';
      const awayTeam = parts[2] || '';
      const venue = parts[3] || '';
      const city = parts[4] || '';
      const category = parts[5] || '';
      // Get default values from settings
      const defaultTeamCategoryFromSettings = teamCategories?.value ? JSON.parse(teamCategories.value)[0] : null;
      const defaultTeamSizeFromSettings = teamSizeFormats?.value ? JSON.parse(teamSizeFormats.value)[0] : null;
      
      let teamCategory = parts[6] || defaultTeamCategoryFromSettings || '';
      let teamSize = parts[7] || defaultTeamSizeFromSettings || '';

      // Validate team category against settings
      if (parts[6] && teamCategories?.value) {
        const teamCategoriesList = JSON.parse(teamCategories.value);
        if (!teamCategoriesList.includes(parts[6])) {
          errors.push(`Invalid team category "${parts[6]}". Available: ${teamCategoriesList.join(', ')}`);
          teamCategory = defaultTeamCategoryFromSettings || '';
        }
      } else if (!teamCategories?.value && parts[6]) {
        errors.push('Team categories not loaded. Please try again.');
      }

      // Validate team size against settings
      if (parts[7] && teamSizeFormats?.value) {
        const teamSizesList = JSON.parse(teamSizeFormats.value);
        if (!teamSizesList.includes(parts[7])) {
          errors.push(`Invalid team size "${parts[7]}". Available: ${teamSizesList.join(', ')}`);
          teamSize = defaultTeamSizeFromSettings || '';
        }
      } else if (!teamSizeFormats?.value && parts[7]) {
        errors.push('Team size formats not loaded. Please try again.');
      }

      // Validate match category against settings
      if (parts[5] && matchCategories?.value) {
        const matchCategoriesList = JSON.parse(matchCategories.value);
        if (!matchCategoriesList.includes(parts[5])) {
          errors.push(`Invalid match category "${parts[5]}". Available: ${matchCategoriesList.join(', ')}`);
        }
      } else if (!matchCategories?.value && parts[5]) {
        errors.push('Match categories not loaded. Please try again.');
      }

      // Validate date
      let parsedDate = '';
      if (dateStr) {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          errors.push('Invalid date format');
        } else {
          parsedDate = date.toISOString();
        }
      } else {
        errors.push('Date is required');
      }

      // Validate teams
      if (!homeTeam) {
        errors.push('Home team is required');
      }
      if (!awayTeam) {
        errors.push('Away team is required');
      }
      if (homeTeam && awayTeam && homeTeam.toLowerCase() === awayTeam.toLowerCase()) {
        errors.push('Home and away teams cannot be the same');
      }

      return {
        id: `temp-${index}`,
        homeTeam,
        awayTeam,
        dateTime: parsedDate,
        venue,
        city,
        category,
        description: '',
        sport: defaultSport?.value || '',
        team: category,
        teamCategory,
        teamSize,
        status: 'SCHEDULED',
        isValid: errors.length === 0,
        errors,
        rawLine: line
      };
    });
  };

  const handlePreview = () => {
    if (!textInput.trim()) {
      setImportResult({ success: false, message: 'Please enter match data to preview' });
      return;
    }

    // Check if all required settings are loaded
    const settingsLoaded = defaultSport && matchCategories && teamCategories && teamSizeFormats && defaultTeamSize;
    if (!settingsLoaded) {
      setImportResult({ success: false, message: 'Settings are still loading. Please wait and try again.' });
      return;
    }

    const parsed = parseTextInput(textInput);
    setParsedMatches(parsed);
    setShowPreview(true);
    setImportResult(null);
  };

  const handleImport = () => {
    const validMatches = parsedMatches.filter(match => match.isValid);
    
    if (validMatches.length === 0) {
      setImportResult({ success: false, message: 'No valid invoices to import' });
      return;
    }

    importMutation.mutate(validMatches);
  };

  const handleClear = () => {
    setTextInput('');
    setParsedMatches([]);
    setShowPreview(false);
    setImportResult(null);
  };

  const validCount = parsedMatches.filter(match => match.isValid).length;
  const invalidCount = parsedMatches.length - validCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Import Matches from Text</h2>
          <p className="text-sm text-neutral-600 mt-1">
            Paste match data with each match on a new line
          </p>
        </div>
        {onClose && (
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Match Data Input</CardTitle>
          <CardDescription>
            Enter one match per line. Format: Date, Home Team, Away Team, Venue, City, Category, Team Category, Team Size
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-neutral-600 bg-neutral-50 p-3 rounded-md">
            <div className="font-medium mb-2">Example format:</div>
            <div className="font-mono text-xs space-y-1">
              <div>2025-06-20 15:00, Manchester United, Liverpool, Old Trafford, Manchester, Premier League, Senior, fullsize</div>
              <div>2025-06-21 17:30, Chelsea, Arsenal, Stamford Bridge, London, Premier League, Youth, small</div>
            </div>
            <div className="text-xs mt-2 text-neutral-500">
              <strong>Available Match Categories:</strong> {matchCategories?.value ? JSON.parse(matchCategories.value).join(', ') : 'Loading...'}<br/>
              <strong>Available Team Categories:</strong> {teamCategories?.value ? JSON.parse(teamCategories.value).join(', ') : 'Loading...'}<br/>
              <strong>Available Team Sizes:</strong> {teamSizeFormats?.value ? JSON.parse(teamSizeFormats.value).join(', ') : 'Loading...'}
            </div>
          </div>
          
          <Textarea
            placeholder="Paste your match data here..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />
          
          <div className="flex gap-2">
            <Button 
              onClick={handlePreview}
              variant="outline"
              disabled={!textInput.trim() || settingsLoading}
            >
              <Eye className="h-4 w-4 mr-2" />
              {settingsLoading ? 'Loading Settings...' : 'Preview'}
            </Button>
            <Button 
              onClick={handleClear}
              variant="outline"
              disabled={!textInput.trim() && !showPreview}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Section */}
      {showPreview && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Preview Results</CardTitle>
              <div className="flex gap-2">
                {validCount > 0 && (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    {validCount} Valid
                  </Badge>
                )}
                {invalidCount > 0 && (
                  <Badge variant="destructive">
                    {invalidCount} Invalid
                  </Badge>
                )}
              </div>
            </div>
            <CardDescription>
              Review parsed invoices before importing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {parsedMatches.map((match, index) => (
                <div
                  key={match.id}
                  className={`p-3 rounded-lg border ${
                    match.isValid 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {match.isValid ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="font-medium">
                          {match.homeTeam} vs {match.awayTeam}
                        </span>
                      </div>
                      
                      <div className="text-sm text-neutral-600 grid grid-cols-2 gap-2">
                        <div>Date: {match.dateTime ? new Date(match.dateTime).toLocaleString() : 'Invalid'}</div>
                        <div>Venue: {match.venue || 'Not specified'}</div>
                        <div>City: {match.city || 'Not specified'}</div>
                        <div>Category: {match.category || 'Not specified'}</div>
                        <div>Team Category: {match.teamCategory || 'Not specified'}</div>
                        <div>Team Size: {match.teamSize || 'Not specified'}</div>
                      </div>

                      {match.errors.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs font-medium text-red-700 mb-1">Errors:</div>
                          <ul className="text-xs text-red-600 list-disc list-inside">
                            {match.errors.map((error, errorIndex) => (
                              <li key={errorIndex}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-2 pt-2 border-t border-neutral-200">
                    <div className="text-xs text-neutral-500 font-mono">
                      Raw: {match.rawLine}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {validCount > 0 && (
              <div className="mt-4 pt-4 border-t">
                <Button 
                  onClick={handleImport}
                  disabled={importMutation.isPending || validCount === 0}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {importMutation.isPending ? 'Importing...' : `Import ${validCount} Valid Matches`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Result Messages */}
      {importResult && (
        <Alert className={importResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <AlertCircle className={`h-4 w-4 ${importResult.success ? 'text-green-600' : 'text-red-600'}`} />
          <AlertDescription className={importResult.success ? 'text-green-800' : 'text-red-800'}>
            {importResult.message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

