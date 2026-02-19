import { Copy } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DuplicateDialogProps {
  isOpen: boolean;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
  defaultName: string;
  /** Label shown above the input field, e.g. "Company Name" or "Title" */
  nameLabel: string;
  /** If true, hides the name input (for auto-numbered entities like estimates/invoices) */
  confirmOnly?: boolean;
  /** Optional dialog title (default: "Duplicate Item") */
  title?: string;
  /** Optional confirm button text (default: "Save") */
  confirmText?: string;
}

export const DuplicateDialog: React.FC<DuplicateDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  defaultName,
  nameLabel,
  confirmOnly = false,
  title = 'Duplicate Item',
  confirmText = 'Save',
}) => {
  const [name, setName] = useState(defaultName);

  // Reset name when dialog opens with new defaultName
  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
    }
  }, [isOpen, defaultName]);

  const handleConfirm = () => {
    onConfirm(confirmOnly ? defaultName : name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <Copy className="w-5 h-5 flex-shrink-0 text-primary" />
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            {confirmOnly
              ? 'A new copy will be created with an auto-generated number.'
              : 'Enter a name for the duplicate.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!confirmOnly && (
          <div className="py-2">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {nameLabel}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="text-sm"
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="default"
              onClick={handleConfirm}
              disabled={!confirmOnly && !name.trim()}
            >
              {confirmText}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
