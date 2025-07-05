import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Upload, Eye, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface ParsedInvoice {
  id?: string;
  customerName: string;
  invoiceDate: string;
  amountDue: string;
  serviceDescription?: string;
  paymentTerms?: string;
  referenceNumber?: string;
  category?: string;
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
  const { data: invoiceCategories, isLoading: loadingInvoiceCategories } = useQuery<{value: string}>({
    queryKey: ['/api/settings/invoice_categories'],
  });

  const settingsLoading = loadingInvoiceCategories;

  // Mutation for importing invoices
  const importMutation = useMutation({
    mutationFn: async (invoices: ParsedInvoice[]) => {
      const results = [];
      for (const invoice of invoices) {
        const invoiceData = {
          customerName: invoice.customerName,
          invoiceDate: invoice.invoiceDate,
          amountDue: invoice.amountDue,
          serviceDescription: invoice.serviceDescription || '',
          paymentTerms: invoice.paymentTerms || '',
          referenceNumber: invoice.referenceNumber || '',
          category: invoice.category || '',
          status: invoice.status || 'PENDING',
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
      setParsedInvoices([]);
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
  const parseTextInput = (text: string): ParsedInvoice[] => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    
    return lines.map((line, index) => {
      const errors: string[] = [];
      const parts = line.split(',').map(part => part.trim());
      
      // Expected format: Customer Name, Invoice Date, Amount Due, Service Description, Payment Terms, Reference Number, Category
      // Minimum required: Customer Name, Invoice Date, Amount Due
      if (parts.length < 3) {
        errors.push('Minimum 3 fields required: Customer Name, Invoice Date, Amount Due');
      }

      const customerName = parts[0] || '';
      const invoiceDateStr = parts[1] || '';
      const amountDue = parts[2] || '';
      const serviceDescription = parts[3] || '';
      const paymentTerms = parts[4] || '';
      const referenceNumber = parts[5] || '';
      const category = parts[6] || '';

      // Validate invoice category against settings
      if (parts[6] && invoiceCategories?.value) {
        const invoiceCategoriesList = JSON.parse(invoiceCategories.value);
        if (!invoiceCategoriesList.includes(parts[6])) {
          errors.push(`Invalid invoice category "${parts[6]}". Available: ${invoiceCategoriesList.join(', ')}`);
        }
      } else if (!invoiceCategories?.value && parts[6]) {
        errors.push('Invoice categories not loaded. Please try again.');
      }

      // Validate date
      let parsedInvoiceDate = '';
      if (invoiceDateStr) {
        const date = new Date(invoiceDateStr);
        if (isNaN(date.getTime())) {
          errors.push('Invalid date format');
        } else {
          parsedInvoiceDate = date.toISOString();
        }
      } else {
        errors.push('Invoice Date is required');
      }

      // Validate customer name and amount due
      if (!customerName) {
        errors.push('Customer Name is required');
      }
      if (!amountDue) {
        errors.push('Amount Due is required');
      }
      if (amountDue && isNaN(parseFloat(amountDue))) {
        errors.push('Amount Due must be a valid number');
      }

      return {
        id: `temp-${index}`,
        customerName,
        invoiceDate: parsedInvoiceDate,
        amountDue,
        serviceDescription,
        paymentTerms,
        referenceNumber,
        category,
        status: 'PENDING',
        isValid: errors.length === 0,
        errors,
        rawLine: line,
      };
    });
  };

  const handlePreview = () => {
    const parsed = parseTextInput(textInput);
    setParsedInvoices(parsed);
    setShowPreview(true);
    setImportResult(null); // Clear previous import results
  };

  const handleImport = () => {
    // Filter out invalid invoices before importing
    const validInvoices = parsedInvoices.filter(invoice => invoice.isValid);
    if (validInvoices.length > 0) {
      importMutation.mutate(validInvoices);
    } else {
      setImportResult({ success: false, message: "No valid invoices to import." });
    }
  };

  const handleClear = () => {
    setTextInput('');
    setParsedInvoices([]);
    setShowPreview(false);
    setImportResult(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Invoices from Text</CardTitle>
        <CardDescription>Paste invoice data, one invoice per line, with fields separated by commas.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid w-full gap-2">
          <Textarea
            placeholder={`Paste your invoice data here... (e.g., "Client A, 2024-07-01, 1500.00, Web Design, Net 30, REF123, Marketing")`}
            value={textInput}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTextInput(e.target.value)}
            rows={10}
          />
          <p className="text-sm text-neutral-500 mt-2">
            Required fields: Customer Name, Invoice Date (YYYY-MM-DD), Amount Due.
            Optional fields: Service Description, Payment Terms, Reference Number, Category.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={handleClear} variant="outline">Clear</Button>
            <Button onClick={handlePreview} disabled={textInput.trim() === '' || settingsLoading}>Preview & Validate</Button>
          </div>
        </div>

        {showPreview && parsedInvoices.length > 0 && (
          <div className="mt-6 space-y-4">
            <h4 className="font-semibold text-lg">Import Preview ({parsedInvoices.length} entries)</h4>
            {importResult && (
              <Alert variant={importResult.success ? "default" : "destructive"}>
                {importResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <AlertDescription>{importResult.message}</AlertDescription>
              </Alert>
            )}
            <div className="border rounded-md max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">#</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Customer Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Invoice Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Amount Due</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Service Description</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Payment Terms</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Reference Number</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {parsedInvoices.map((invoice, index) => (
                    <tr key={invoice.id} className={!invoice.isValid ? 'bg-red-50' : ''}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-neutral-900">{index + 1}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-500">{invoice.customerName}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-500">{invoice.invoiceDate ? format(new Date(invoice.invoiceDate), 'yyyy-MM-dd') : ''}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-500">{invoice.amountDue}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-500">{invoice.serviceDescription}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-500">{invoice.paymentTerms}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-500">{invoice.referenceNumber}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-500">{invoice.category}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        <Badge variant={invoice.isValid ? "default" : "destructive"}>
                          {invoice.isValid ? "Valid" : "Invalid"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {parsedInvoices.some(invoice => !invoice.isValid) && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Some invoices have validation errors. Please fix them before importing.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button onClick={() => setShowPreview(false)} variant="outline">Edit Input</Button>
              <Button
                onClick={handleImport}
                disabled={parsedInvoices.some(invoice => !invoice.isValid) || importMutation.isPending}
              >
                {importMutation.isPending ? "Importing..." : `Import ${parsedInvoices.filter(m => m.isValid).length} Invoices`}
              </Button>
            </div>
          </div>
        )}

        {showPreview && parsedInvoices.length === 0 && (
          <div className="mt-6 text-center text-neutral-500">
            No invoices parsed from the input. Please check your data format.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

