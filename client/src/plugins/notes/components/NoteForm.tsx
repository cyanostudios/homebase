import React, { useState, useEffect, useCallback } from 'react';
import { Heading } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { useNotes } from '../hooks/useNotes';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { MentionTextarea } from './MentionTextarea';

interface NoteFormProps {
  currentNote?: any;
  onSave: (data: any) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const NoteForm: React.FC<NoteFormProps> = ({ 
  currentNote, 
  onSave, 
  onCancel, 
  isSubmitting = false 
}) => {
  const { validationErrors } = useNotes();
  const { 
    isDirty, 
    showWarning, 
    markDirty, 
    markClean, 
    attemptAction, 
    confirmDiscard, 
    cancelDiscard 
  } = useUnsavedChanges();

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    mentions: []
  });

  // Load currentNote data when editing
  useEffect(() => {
    if (currentNote) {
      // Edit mode - load existing data
      setFormData({
        title: currentNote.title || '',
        content: currentNote.content || '',
        mentions: currentNote.mentions || []
      });
      markClean();
    } else {
      // Create mode - reset to empty form
      resetForm();
    }
  }, [currentNote, markClean]);

  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      content: '',
      mentions: []
    });
    markClean();
  }, [markClean]);

  const handleSubmit = useCallback(async () => {
    console.log('Form submitting with data:', formData);
    const success = await onSave(formData);
    if (success) {
      markClean();
      if (!currentNote) {
        resetForm();
      }
    }
    if (!success) {
      console.log('Save failed due to validation errors');
    }
  }, [formData, onSave, markClean, currentNote, resetForm]);

  const handleCancel = useCallback(() => {
    attemptAction(() => {
      onCancel();
    });
  }, [attemptAction, onCancel]);

  // FIXED: Global functions with correct plural naming
  useEffect(() => {
    window.submitNotesForm = handleSubmit; // PLURAL!
    window.cancelNotesForm = handleCancel; // PLURAL!
    
    return () => {
      delete window.submitNotesForm;
      delete window.cancelNotesForm;
    };
  }, [handleSubmit, handleCancel]);

  const handleDiscardChanges = () => {
    if (!currentNote) {
      resetForm();
      setTimeout(() => {
        confirmDiscard();
      }, 0);
    } else {
      confirmDiscard();
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    markDirty();
  };

  const handleContentChange = (content: string, mentions: any[]) => {
    setFormData(prev => ({ ...prev, content, mentions }));
    markDirty();
  };

  // Helper function to get error for a specific field
  const getFieldError = (fieldName: string) => {
    return validationErrors.find(error => error.field === fieldName);
  };

  // Check if there are any blocking errors (non-warning)
  const hasBlockingErrors = validationErrors.some(error => !error.message.includes('Warning'));

  return (
    <div className="space-y-4">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        
        {/* Validation Summary */}
        {hasBlockingErrors && (
          <Card padding="sm" className="shadow-none px-0">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Cannot save note
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>Please fix the following errors before saving:</p>
                    <ul className="list-disc list-inside mt-1">
                      {validationErrors
                        .filter(error => !error.message.includes('Warning'))
                        .map((error, index) => (
                          <li key={index}>{error.message}</li>
                        ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}
        
        {/* Note Title */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">Note Title</Heading>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Enter note title..."
              className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                getFieldError('title') ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            />
            {getFieldError('title') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('title')?.message}</p>
            )}
          </div>
        </Card>

        {/* Note Content with @mentions */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">Note Content</Heading>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content <span className="text-xs text-gray-500">(Type @ to mention contacts)</span>
            </label>
            <MentionTextarea
              value={formData.content}
              onChange={handleContentChange}
              placeholder="Write your note here... Type @ to mention contacts"
              rows={12}
              className={getFieldError('content') ? 'border-red-500' : ''}
            />
            {getFieldError('content') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('content')?.message}</p>
            )}
            
            {/* Show mentions preview */}
            {formData.mentions.length > 0 && (
              <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                <span className="font-medium text-blue-800">Mentions:</span>{' '}
                {formData.mentions.map((mention: any, index: number) => (
                  <span key={index} className="text-blue-600">
                    @{mention.contactName}{index < formData.mentions.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>
      </form>
      
      {/* Unsaved Changes Warning Dialog */}
      <ConfirmDialog
        isOpen={showWarning}
        title="Unsaved Changes"
        message={currentNote 
          ? "You have unsaved changes. Do you want to discard your changes and return to view mode?" 
          : "You have unsaved changes. Do you want to discard your changes and close the form?"
        }
        confirmText="Discard Changes"
        cancelText="Continue Editing"
        onConfirm={handleDiscardChanges}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </div>
  );
};