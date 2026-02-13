/**
 * Optional plugin contract for the global Duplicate flow.
 * Plugins that support duplicate can expose these on their context;
 * core uses them to show the Duplicate button and dialog and to execute the duplicate.
 */

/** Config for the Duplicate dialog. Return null if the plugin does not support duplicate. */
export interface DuplicateConfig {
  defaultName: string;
  nameLabel: string;
  confirmOnly?: boolean;
}

/** Result of executeDuplicate: core calls closePanel() and may use highlightId for list highlight. */
export interface ExecuteDuplicateResult {
  closePanel: () => void;
  highlightId?: string;
}

/**
 * Optional duplicate contract on plugin context.
 * - getDuplicateConfig(item): null = no duplicate (e.g. contacts); otherwise dialog config.
 * - executeDuplicate(item, newName): creates copy, returns closePanel + optional highlightId.
 */
export interface DuplicateContract {
  getDuplicateConfig?: (item: any) => DuplicateConfig | null;
  executeDuplicate?: (item: any, newName: string) => Promise<ExecuteDuplicateResult>;
}
