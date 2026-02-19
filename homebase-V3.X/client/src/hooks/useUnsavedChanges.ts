import { useState, useRef, useCallback } from 'react';

export function useUnsavedChanges() {
  const [isDirty, setIsDirty] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  const markClean = useCallback(() => {
    setIsDirty(false);
  }, []);

  const attemptAction = useCallback(
    (action: () => void) => {
      if (isDirty) {
        pendingActionRef.current = action;
        setShowWarning(true);
      } else {
        action();
      }
    },
    [isDirty],
  );

  const confirmDiscard = useCallback(() => {
    if (pendingActionRef.current) {
      pendingActionRef.current();
      pendingActionRef.current = null;
    }
    setIsDirty(false);
    setShowWarning(false);
  }, []);

  const cancelDiscard = useCallback(() => {
    pendingActionRef.current = null;
    setShowWarning(false);
  }, []);

  return {
    isDirty,
    showWarning,
    markDirty,
    markClean,
    attemptAction,
    confirmDiscard,
    cancelDiscard,
  };
}
