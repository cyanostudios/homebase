import { Upload, ChevronRight, CheckCircle2, FileText } from 'lucide-react';
import React, { useState, useRef } from 'react';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NativeSelect } from '@/components/ui/select';
import { parseCSV, mapCsvToObjects, ImportSchema } from '../utils/importUtils';

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: any[]) => Promise<void>;
  schema: ImportSchema;
  title: string;
}

type WizardStep = 'upload' | 'mapping' | 'preview';

export const ImportWizard: React.FC<ImportWizardProps> = ({
  isOpen,
  onClose,
  onImport,
  schema,
  title,
}) => {
  const [step, setStep] = useState<WizardStep>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length > 0) {
        setCsvData(parsed);
        // Auto-mapping by label or key name
        const headers = parsed[0];
        const initialMapping: Record<string, number> = {};
        schema.fields.forEach((field) => {
          const index = headers.findIndex(
            (h) =>
              h.toLowerCase() === field.label.toLowerCase() ||
              h.toLowerCase() === field.key.toLowerCase(),
          );
          initialMapping[field.key] = index; // -1 if not found
        });
        setMapping(initialMapping);
        setStep('mapping');
      }
    };
    reader.readAsText(file);
  };

  const handleStartImport = async () => {
    setIsImporting(true);
    try {
      const data = mapCsvToObjects(csvData, mapping);
      await onImport(data);
      handleOnClose();
    } catch (error) {
      console.error('Import failed', error);
      // Logic for showing error could be added here
    } finally {
      setIsImporting(false);
    }
  };

  const handleOnClose = () => {
    onClose();
    setTimeout(() => {
      setStep('upload');
      setFileName('');
      setCsvData([]);
      setMapping({});
      setIsImporting(false);
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleOnClose()}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {title}
            <Badge variant="outline" className="text-[10px] uppercase">
              {step}
            </Badge>
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="py-2">
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl space-y-4">
              <Upload className="w-12 h-12 text-gray-400" />
              <div className="text-center">
                <p className="text-sm font-medium">Click to upload or drag and drop</p>
                <p className="text-xs text-gray-400 mt-1">CSV files supported</p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv"
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()}>Select File</Button>
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg flex items-start gap-3 border border-blue-100 dark:border-blue-900/40">
                <FileText className="w-5 h-5 text-blue-500 mt-0.5" />
                <div className="text-xs text-blue-700 dark:text-blue-400">
                  <div className="font-bold">{fileName}</div>
                  <div>
                    {csvData.length - 1} rows detected. Map your file columns to system fields.
                  </div>
                </div>
              </div>

              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {schema.fields.map((field) => (
                    <div
                      key={field.key}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-100 dark:border-gray-800"
                    >
                      <div>
                        <div className="text-sm font-medium flex items-center gap-2">
                          {field.label}
                          {field.required && (
                            <Badge className="text-[10px] h-4 bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/50">
                              Required
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">
                          {field.key}
                        </div>
                      </div>
                      <NativeSelect
                        value={mapping[field.key] ?? -1}
                        onChange={(e) =>
                          setMapping({ ...mapping, [field.key]: parseInt(e.target.value) })
                        }
                        className="sm:w-48 text-sm h-9 bg-white dark:bg-gray-900"
                      >
                        <option value="-1">Ignore Column</option>
                        {csvData[0]?.map((h, i) => (
                          <option key={i} value={i}>
                            {h}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="text-sm font-medium">Data Preview (first 5 rows)</div>
              <ScrollArea className="h-[300px] border border-gray-100 dark:border-gray-800 rounded-lg">
                <table className="w-full text-[11px] text-left border-collapse">
                  <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 border-b border-gray-100 dark:border-gray-800">
                    <tr>
                      {schema.fields
                        .filter((f) => mapping[f.key] !== -1)
                        .map((f) => (
                          <th
                            key={f.key}
                            className="px-4 py-2 font-bold text-gray-500 uppercase tracking-tight"
                          >
                            {f.label}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mapCsvToObjects(csvData, mapping)
                      .slice(0, 5)
                      .map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                        >
                          {schema.fields
                            .filter((f) => mapping[f.key] !== -1)
                            .map((f) => (
                              <td
                                key={f.key}
                                className="px-4 py-2 truncate max-w-[150px] text-gray-700 dark:text-gray-300"
                              >
                                {String(row[f.key] ?? '')}
                              </td>
                            ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleOnClose}>Cancel</AlertDialogCancel>

          {step === 'mapping' && (
            <Button onClick={() => setStep('preview')} icon={ChevronRight}>
              Next: Preview
            </Button>
          )}

          {step === 'preview' && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep('mapping')}>
                Back
              </Button>
              <Button
                onClick={handleStartImport}
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={isImporting}
                icon={isImporting ? undefined : CheckCircle2}
              >
                {isImporting ? 'Importing...' : 'Start Import'}
              </Button>
            </div>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
