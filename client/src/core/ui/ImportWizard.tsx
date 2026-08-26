import { Upload, ChevronRight, CheckCircle2, FileText, ClipboardPaste } from 'lucide-react';
import React, { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialogRoundCancel, DialogCloseButton } from '@/core/ui/DialogRoundButtons';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import {
  areRequiredFieldsMapped,
  buildAutoMapping,
  checkImportLimits,
  IMPORT_MAX_DATA_ROWS,
  IMPORT_MAX_FILE_BYTES,
  ImportLimitErrorCode,
  ImportResult,
  ImportSchema,
  mapGridToObjects,
  parseCSV,
  parseTabularPaste,
  parseXlsxArrayBuffer,
} from '../utils/importUtils';

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  /** When set, shows a Back button that returns to the parent flow without closing it. */
  onBack?: () => void;
  onImport: (data: Record<string, string>[]) => Promise<ImportResult | void>;
  schema: ImportSchema;
  title: string;
}

type WizardStep = 'source' | 'mapping' | 'preview' | 'result';
type SourceMode = 'file' | 'paste';

function isXlsxFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.xlsx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}

function isCsvFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.csv') || file.type === 'text/csv' || file.type === 'application/csv';
}

export const ImportWizard: React.FC<ImportWizardProps> = ({
  isOpen,
  onClose,
  onBack,
  onImport,
  schema,
  title,
}) => {
  const { t } = useTranslation();
  const pasteFieldId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>('source');
  const [sourceMode, setSourceMode] = useState<SourceMode>('file');
  const [sourceLabel, setSourceLabel] = useState('');
  const [gridData, setGridData] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [pasteText, setPasteText] = useState('');
  const [sourceError, setSourceError] = useState<ImportLimitErrorCode | 'invalid_format' | null>(
    null,
  );
  const [importError, setImportError] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const resetState = () => {
    setStep('source');
    setSourceMode('file');
    setSourceLabel('');
    setGridData([]);
    setMapping({});
    setPasteText('');
    setSourceError(null);
    setImportError(false);
    setIsImporting(false);
    setIsParsing(false);
    setIsDragging(false);
    setImportResult(null);
  };

  const handleOnClose = () => {
    onClose();
    setTimeout(resetState, 300);
  };

  const handleOnBack = () => {
    onBack?.();
    setTimeout(resetState, 300);
  };

  const advanceToMapping = (grid: string[][], label: string, fileSizeBytes?: number) => {
    const limitError = checkImportLimits({ grid, fileSizeBytes });
    if (limitError) {
      setSourceError(limitError);
      return;
    }

    setSourceError(null);
    setSourceLabel(label);
    setGridData(grid);
    setMapping(buildAutoMapping(grid[0] ?? [], schema));
    setStep('mapping');
  };

  const parseFile = async (file: File) => {
    setSourceError(null);
    setIsParsing(true);
    try {
      // Soft limit before any read — avoid loading oversized files into memory (QA Q1).
      if (file.size > IMPORT_MAX_FILE_BYTES) {
        setSourceError('too_large');
        return;
      }

      if (file.size > 0 && !isCsvFile(file) && !isXlsxFile(file)) {
        setSourceError('invalid_format');
        return;
      }

      if (isXlsxFile(file)) {
        const buffer = await file.arrayBuffer();
        const grid = await parseXlsxArrayBuffer(buffer);
        advanceToMapping(grid, file.name, file.size);
        return;
      }

      if (isCsvFile(file) || file.type === 'text/plain') {
        const text = await file.text();
        const grid = parseCSV(text);
        advanceToMapping(grid, file.name, file.size);
        return;
      }

      setSourceError('invalid_format');
    } catch {
      setSourceError('invalid_format');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void parseFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void parseFile(file);
    }
  };

  const handlePasteContinue = () => {
    setSourceError(null);
    const grid = parseTabularPaste(pasteText);
    advanceToMapping(grid, t('importWizard.pastedData'));
  };

  const requiredMapped = areRequiredFieldsMapped(schema, mapping);

  const handleStartImport = async () => {
    setIsImporting(true);
    setImportError(false);
    try {
      const data = mapGridToObjects(gridData, mapping);
      const result = await onImport(data);
      setImportResult({
        successCount: result?.successCount ?? data.length,
        failureCount: result?.failureCount ?? 0,
      });
      setStep('result');
    } catch {
      setImportError(true);
    } finally {
      setIsImporting(false);
    }
  };

  const sourceErrorMessage = (code: ImportLimitErrorCode | 'invalid_format') => {
    switch (code) {
      case 'too_large':
        return t('importWizard.errorTooLarge');
      case 'too_many_rows':
        return t('importWizard.errorTooManyRows', { max: IMPORT_MAX_DATA_ROWS });
      case 'empty':
        return t('importWizard.errorEmpty');
      case 'invalid_format':
      default:
        return t('importWizard.errorInvalidFormat');
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleOnClose()}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {title}
            <Badge variant="outline" className="text-[10px] font-extrabold uppercase">
              {step}
            </Badge>
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="py-2">
          {step === 'source' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={sourceMode === 'file' ? 'primary' : 'secondary'}
                  aria-pressed={sourceMode === 'file'}
                  onClick={() => {
                    setSourceMode('file');
                    setSourceError(null);
                  }}
                >
                  {t('importWizard.file')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={sourceMode === 'paste' ? 'primary' : 'secondary'}
                  aria-pressed={sourceMode === 'paste'}
                  onClick={() => {
                    setSourceMode('paste');
                    setSourceError(null);
                  }}
                >
                  {t('importWizard.paste')}
                </Button>
              </div>

              {sourceMode === 'file' && (
                <div
                  className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-xl space-y-4 ${
                    isDragging
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 dark:border-gray-800'
                  }`}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                  }}
                  onDrop={handleDrop}
                >
                  <Upload className="w-12 h-12 text-gray-400" />
                  <div className="text-center">
                    <p className="text-sm font-medium">{t('importWizard.selectFile')}</p>
                    <p className="text-xs text-gray-400 mt-1">{t('importWizard.fileHelp')}</p>
                    <p className="text-xs text-gray-400 mt-1">{t('importWizard.dragDropHint')}</p>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    disabled={isParsing}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isParsing ? t('importWizard.parsing') : t('importWizard.selectFileButton')}
                  </Button>
                </div>
              )}

              {sourceMode === 'paste' && (
                <div className="space-y-3">
                  <label htmlFor={pasteFieldId} className="text-sm font-medium">
                    {t('importWizard.pasteLabel')}
                  </label>
                  <Textarea
                    id={pasteFieldId}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={t('importWizard.pastePlaceholder')}
                    className="min-h-[160px]"
                  />
                </div>
              )}

              {sourceError && (
                <p className="text-sm text-destructive" role="alert">
                  {sourceErrorMessage(sourceError)}
                </p>
              )}
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg flex items-start gap-3 border border-blue-100 dark:border-blue-900/40">
                {sourceMode === 'paste' ? (
                  <ClipboardPaste className="w-5 h-5 text-blue-500 mt-0.5" />
                ) : (
                  <FileText className="w-5 h-5 text-blue-500 mt-0.5" />
                )}
                <div className="text-xs text-blue-700 dark:text-blue-400">
                  <div className="font-bold">{sourceLabel}</div>
                  <div>
                    {t('importWizard.rowsDetected', { count: Math.max(0, gridData.length - 1) })}
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
                            <Badge className="text-[10px] font-extrabold h-4 bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/50">
                              {t('importWizard.required')}
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
                          setMapping({ ...mapping, [field.key]: parseInt(e.target.value, 10) })
                        }
                        className="sm:w-48 text-sm h-9 bg-white dark:bg-gray-900"
                      >
                        <option value="-1">{t('importWizard.ignoreColumn')}</option>
                        {gridData[0]?.map((h, i) => (
                          <option key={h ?? `col-${i}`} value={i}>
                            {h || t('importWizard.columnIndex', { index: i + 1 })}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {!requiredMapped && (
                <p className="text-sm text-destructive" role="alert">
                  {t('importWizard.mapRequired')}
                </p>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="text-sm font-medium">{t('importWizard.previewTitle')}</div>
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
                    {mapGridToObjects(gridData, mapping)
                      .slice(0, 5)
                      .map((row, i) => (
                        <tr
                          // eslint-disable-next-line react/no-array-index-key -- preview rows have no stable id
                          key={`preview-${i}-${JSON.stringify(row).slice(0, 40)}`}
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
              {importError && (
                <p className="text-sm text-destructive" role="alert">
                  {t('importWizard.importFailed')}
                </p>
              )}
            </div>
          )}

          {step === 'result' && importResult && (
            <div className="flex flex-col items-center justify-center py-10 space-y-3 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-600" aria-hidden />
              <div className="text-sm font-medium">{t('importWizard.resultTitle')}</div>
              <p className="text-sm text-muted-foreground">
                {t('importWizard.resultSuccess', { count: importResult.successCount })}
              </p>
              {importResult.failureCount > 0 && (
                <p className="text-sm text-destructive">
                  {t('importWizard.resultFailed', { count: importResult.failureCount })}
                </p>
              )}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          {step !== 'result' && (
            <>
              {onBack && step === 'source' ? (
                <Button type="button" variant="ghost" onClick={handleOnBack}>
                  {t('common.back')}
                </Button>
              ) : null}
              <AlertDialogRoundCancel onClick={handleOnClose} />
            </>
          )}

          {step === 'source' && sourceMode === 'paste' && (
            <Button
              type="button"
              onClick={handlePasteContinue}
              disabled={!pasteText.trim()}
              icon={ChevronRight}
            >
              {t('importWizard.continue')}
            </Button>
          )}

          {step === 'mapping' && (
            <Button
              type="button"
              onClick={() => setStep('preview')}
              disabled={!requiredMapped}
              icon={ChevronRight}
            >
              {t('importWizard.nextPreview')}
            </Button>
          )}

          {step === 'preview' && (
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep('mapping')}>
                {t('importWizard.back')}
              </Button>
              <Button
                type="button"
                onClick={() => void handleStartImport()}
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={isImporting}
                icon={isImporting ? undefined : CheckCircle2}
              >
                {isImporting ? t('importWizard.importing') : t('importWizard.startImport')}
              </Button>
            </div>
          )}

          {step === 'result' && (
            <DialogCloseButton
              type="button"
              label={t('importWizard.done')}
              onClick={handleOnClose}
            />
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
