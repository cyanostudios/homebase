import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface MobileActions {
  onAdd?: () => void;
  onSettings?: () => void;
}

/** When set, MobileBottomBar shows Close (+ optional Save) instead of Search/Add/Settings. */
export interface MobileBarOverride {
  onClose: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  saveDisabled?: boolean;
}

export interface MobileSearchBinding {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Pure update used by setSearch — closing only when binding is cleared (unmount). */
export function applyMobileSearchUpdate(
  prevOpen: boolean,
  next: MobileSearchBinding | null,
): { search: MobileSearchBinding | null; searchOpen: boolean } {
  if (!next) {
    return { search: null, searchOpen: false };
  }
  return { search: next, searchOpen: prevOpen };
}

interface MobileActionsContextValue {
  actions: MobileActions;
  setActions: (actions: MobileActions | null) => void;
  search: MobileSearchBinding | null;
  setSearch: (search: MobileSearchBinding | null) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  barOverride: MobileBarOverride | null;
  setBarOverride: (override: MobileBarOverride | null) => void;
}

const MobileActionsContext = createContext<MobileActionsContextValue | null>(null);

export function MobileActionsProvider({ children }: { children: React.ReactNode }) {
  const [actions, setActionsState] = useState<MobileActions>({});
  const [search, setSearchState] = useState<MobileSearchBinding | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [barOverride, setBarOverrideState] = useState<MobileBarOverride | null>(null);

  const setActions = useCallback((next: MobileActions | null) => {
    setActionsState(next ?? {});
  }, []);

  const setSearch = useCallback((next: MobileSearchBinding | null) => {
    setSearchState(next);
    setSearchOpen((prevOpen) => applyMobileSearchUpdate(prevOpen, next).searchOpen);
  }, []);

  const setBarOverride = useCallback((next: MobileBarOverride | null) => {
    setBarOverrideState(next);
  }, []);

  const value = useMemo(
    () => ({
      actions,
      setActions,
      search,
      setSearch,
      searchOpen,
      setSearchOpen,
      barOverride,
      setBarOverride,
    }),
    [actions, setActions, search, setSearch, searchOpen, barOverride, setBarOverride],
  );

  return <MobileActionsContext.Provider value={value}>{children}</MobileActionsContext.Provider>;
}

/** Register Add / Settings handlers for the mobile bottom bar. Clears on unmount. */
export function useMobileActions(actions: MobileActions) {
  const ctx = useContext(MobileActionsContext);
  const setActions = ctx?.setActions;
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const hasAdd = Boolean(actions.onAdd);
  const hasSettings = Boolean(actions.onSettings);

  useEffect(() => {
    if (!setActions) {
      return;
    }
    setActions({
      onAdd: hasAdd ? () => actionsRef.current.onAdd?.() : undefined,
      onSettings: hasSettings ? () => actionsRef.current.onSettings?.() : undefined,
    });
    return () => {
      setActions(null);
    };
  }, [setActions, hasAdd, hasSettings]);
}

/**
 * Register the active list search field so MobileBottomBar can show it above the bar.
 * Depends on stable `setSearch` only — do not depend on the whole context value, or
 * opening the panel (searchOpen change) would re-run cleanup and close it again.
 */
export function useRegisterMobileSearch(binding: MobileSearchBinding) {
  const ctx = useContext(MobileActionsContext);
  const setSearch = ctx?.setSearch;
  const onChangeRef = useRef(binding.onChange);
  onChangeRef.current = binding.onChange;

  // Keep binding value/placeholder in sync without unmount cleanup.
  useEffect(() => {
    if (!setSearch) {
      return;
    }
    setSearch({
      value: binding.value,
      onChange: (value: string) => onChangeRef.current(value),
      placeholder: binding.placeholder,
    });
  }, [setSearch, binding.value, binding.placeholder]);

  // Clear only when the search field unmounts (leave list / bulk takeover).
  useEffect(() => {
    if (!setSearch) {
      return;
    }
    return () => {
      setSearch(null);
    };
  }, [setSearch]);
}

/** Read-only access for MobileBottomBar. */
export function useMobileActionsBar(): MobileActions {
  const ctx = useContext(MobileActionsContext);
  return ctx?.actions ?? {};
}

/**
 * Replace Search/Add/Settings with Close (+ optional Save) while mounted.
 * Used by plugin settings pages so Close sits in the bottom chrome slot.
 */
export function useMobileBarOverride(override: MobileBarOverride | null) {
  const ctx = useContext(MobileActionsContext);
  const setBarOverride = ctx?.setBarOverride;
  const overrideRef = useRef(override);
  overrideRef.current = override;

  const hasClose = Boolean(override?.onClose);
  const hasSave = Boolean(override?.onSave);
  const isSaving = Boolean(override?.isSaving);
  const saveDisabled = Boolean(override?.saveDisabled);

  useEffect(() => {
    if (!setBarOverride) {
      return;
    }
    if (!hasClose) {
      setBarOverride(null);
      return;
    }
    setBarOverride({
      onClose: () => overrideRef.current?.onClose(),
      onSave: hasSave ? () => overrideRef.current?.onSave?.() : undefined,
      isSaving,
      saveDisabled,
    });
    return () => {
      setBarOverride(null);
    };
  }, [setBarOverride, hasClose, hasSave, isSaving, saveDisabled]);
}

export function useMobileBarOverrideBar(): MobileBarOverride | null {
  const ctx = useContext(MobileActionsContext);
  return ctx?.barOverride ?? null;
}

export function useMobileSearchBar(): {
  search: MobileSearchBinding | null;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
} {
  const ctx = useContext(MobileActionsContext);
  return {
    search: ctx?.search ?? null,
    searchOpen: ctx?.searchOpen ?? false,
    setSearchOpen: ctx?.setSearchOpen ?? (() => undefined),
  };
}
