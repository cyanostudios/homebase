import React, { useState, useEffect, useCallback } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useInspections } from '../hooks/useInspections';
import { FilePicker } from './FilePicker';

interface InspectionFormProps {
  currentInspectionProject?: any;
  currentInspection?: any;
  currentItem?: any;
  onSave: (data: any) => Promise<boolean>;
  onCancel: () => void;
}

export const InspectionForm: React.FC<InspectionFormProps> = (props) => {
  const currentInspectionProject = props.currentInspectionProject ?? props.currentInspection ?? props.currentItem;
  const { onSave, onCancel } = props;
  const { validationErrors, clearValidationErrors } = useInspections();
  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } = useGlobalNavigationGuard();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const formKey = `inspection-form-${currentInspectionProject?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => isDirty);
    return () => unregisterUnsavedChangesChecker(formKey);
  }, [isDirty, currentInspectionProject?.id, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    clearValidationErrors();
    setSaving(true);
    try {
      const ok = await onSave({ name, description, adminNotes });
      if (ok) setIsDirty(false);
      if (!ok) setSaving(false);
    } catch {
      setSaving(false);
    }
  }, [name, description, adminNotes, onSave, saving, clearValidationErrors]);

  useEffect(() => {
    const onSubmit = () => handleSave();
    const onCancelEv = () => onCancel();
    window.addEventListener('submitInspectionForm', onSubmit);
    window.addEventListener('cancelInspectionForm', onCancelEv);
    return () => {
      window.removeEventListener('submitInspectionForm', onSubmit);
      window.removeEventListener('cancelInspectionForm', onCancelEv);
    };
  }, [handleSave, onCancel]);

  useEffect(() => {
    if (currentInspectionProject) {
      setName(currentInspectionProject.name || '');
      setDescription(currentInspectionProject.description || '');
      setAdminNotes(currentInspectionProject.adminNotes || '');
      setIsDirty(false);
    } else {
      setName(new Date().toISOString().slice(0, 10));
      setDescription('');
      setAdminNotes('');
      setIsDirty(false);
    }
  }, [currentInspectionProject]);

  const markDirty = useCallback(() => setIsDirty(true), []);

  return (
    <div className="p-4 space-y-4">
      <div>
        <Label htmlFor="name">Namn</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => { setName(e.target.value); markDirty(); }}
          placeholder="T.ex. 2025-01-31"
        />
      </div>
      <div>
        <Label htmlFor="description">Beskrivning</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => { setDescription(e.target.value); markDirty(); }}
          placeholder="Vad ska besiktigas?"
          rows={5}
        />
      </div>
      <div>
        <Label htmlFor="adminNotes">Admin-kommentarer</Label>
        <Textarea
          id="adminNotes"
          value={adminNotes}
          onChange={(e) => { setAdminNotes(e.target.value); markDirty(); }}
          placeholder="Egna anteckningar..."
          rows={3}
        />
      </div>
      {validationErrors.map((e) => (
        <div key={e.field} className="text-sm text-destructive">
          {e.message}
        </div>
      ))}
    </div>
  );
};
