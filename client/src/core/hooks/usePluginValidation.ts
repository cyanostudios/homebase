import { useCallback, useState } from 'react';

export interface PluginValidationError {
  field: string;
  message: string;
}

/**
 * Shared validation state hook for plugin contexts.
 *
 * Manages the `validationErrors` array and exposes a stable
 * `clearValidationErrors` callback and a direct `setValidationErrors` setter.
 *
 * Usage inside a plugin context:
 *
 *   const { validationErrors, setValidationErrors, clearValidationErrors } =
 *     usePluginValidation<ValidationError>();
 */
export function usePluginValidation<T extends PluginValidationError = PluginValidationError>() {
  const [validationErrors, setValidationErrors] = useState<T[]>([]);

  const clearValidationErrors = useCallback(() => {
    setValidationErrors([]);
  }, []);

  return { validationErrors, setValidationErrors, clearValidationErrors };
}
