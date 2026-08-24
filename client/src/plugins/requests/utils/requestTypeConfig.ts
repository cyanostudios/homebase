/**
 * Coerce settings.requests.requestTypes (legacy string[] or RequestTypeConfig[])
 * to match backend plugins/requests/requestTypeConfig.js.
 */

export type RequestPluginId = 'garments';

export interface IntakeSchemaField {
  key: string;
  required?: boolean;
}

export interface RequestTypeConfig {
  key: string;
  plugin?: RequestPluginId | null;
  targetListId?: string | null;
  intakeSchema?: IntakeSchemaField[] | null;
}

/** Public branding shape — never includes targetListId. */
export interface PublicRequestType {
  key: string;
  plugin?: RequestPluginId;
  intakeSchema?: IntakeSchemaField[];
}

const SUPPORTED_PLUGINS = new Set<string>(['garments']);

/** Default intake when first linking a type to garments. */
export const DEFAULT_GARMENTS_INTAKE_SCHEMA: IntakeSchemaField[] = [
  { key: 'name', required: true },
  { key: 'shirtSize' },
  { key: 'shortsSize' },
  { key: 'socksSize' },
  { key: 'jerseyNumber' },
  { key: 'jerseyName' },
];

export function coerceRequestTypeConfig(entry: unknown): RequestTypeConfig | null {
  if (typeof entry === 'string') {
    const key = entry.trim().slice(0, 100);
    return key ? { key } : null;
  }
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }
  const raw = entry as Record<string, unknown>;
  const key = typeof raw.key === 'string' ? raw.key.trim().slice(0, 100) : '';
  if (!key) {
    return null;
  }

  const config: RequestTypeConfig = { key };
  const pluginRaw =
    raw.plugin === null || raw.plugin === undefined || raw.plugin === ''
      ? null
      : String(raw.plugin).trim();

  if (pluginRaw && SUPPORTED_PLUGINS.has(pluginRaw)) {
    config.plugin = pluginRaw as RequestPluginId;
    if (
      raw.targetListId !== null &&
      raw.targetListId !== undefined &&
      String(raw.targetListId).trim()
    ) {
      config.targetListId = String(raw.targetListId).trim().slice(0, 50);
    }
    if (Array.isArray(raw.intakeSchema)) {
      config.intakeSchema = raw.intakeSchema
        .map((field) => {
          if (!field || typeof field !== 'object') {
            return null;
          }
          const fieldKey =
            typeof (field as { key?: unknown }).key === 'string'
              ? (field as { key: string }).key.trim()
              : '';
          if (!fieldKey) {
            return null;
          }
          const out: IntakeSchemaField = { key: fieldKey };
          if ((field as { required?: unknown }).required === true) {
            out.required = true;
          }
          return out;
        })
        .filter((f): f is IntakeSchemaField => f !== null)
        .slice(0, 50);
    }
  }

  return config;
}

export function coerceRequestTypes(raw: unknown): RequestTypeConfig[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const out: RequestTypeConfig[] = [];
  for (const entry of raw) {
    const config = coerceRequestTypeConfig(entry);
    if (!config || seen.has(config.key)) {
      continue;
    }
    seen.add(config.key);
    out.push(config);
  }
  return out;
}

export function coercePublicRequestType(entry: unknown): PublicRequestType | null {
  if (typeof entry === 'string') {
    const key = entry.trim().slice(0, 100);
    return key ? { key } : null;
  }
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }
  const raw = entry as Record<string, unknown>;
  const key = typeof raw.key === 'string' ? raw.key.trim().slice(0, 100) : '';
  if (!key) {
    return null;
  }

  const out: PublicRequestType = { key };
  const plugin =
    raw.plugin === null || raw.plugin === undefined || raw.plugin === ''
      ? null
      : String(raw.plugin).trim();
  if (plugin && SUPPORTED_PLUGINS.has(plugin)) {
    out.plugin = plugin as RequestPluginId;
    if (Array.isArray(raw.intakeSchema)) {
      const schema = raw.intakeSchema
        .map((field) => {
          if (!field || typeof field !== 'object') {
            return null;
          }
          const fieldKey =
            typeof (field as { key?: unknown }).key === 'string'
              ? (field as { key: string }).key.trim()
              : '';
          if (!fieldKey) {
            return null;
          }
          const item: IntakeSchemaField = { key: fieldKey };
          if ((field as { required?: unknown }).required === true) {
            item.required = true;
          }
          return item;
        })
        .filter((f): f is IntakeSchemaField => f !== null);
      if (schema.length > 0) {
        out.intakeSchema = schema;
      }
    }
  }
  return out;
}

export function requestTypeKeys(types: RequestTypeConfig[]): string[] {
  return types.map((t) => t.key);
}

export function findRequestTypeConfig(
  types: RequestTypeConfig[],
  key: string | null | undefined,
): RequestTypeConfig | null {
  const trimmed = (key || '').toString().trim();
  if (!trimmed) {
    return null;
  }
  return types.find((t) => t.key === trimmed) ?? null;
}

/** Soft-group garment lists: preferred team first, then other. Never hides lists. */
export function groupGarmentListsForSelect<T extends { id: string; teamId: string | null }>(
  lists: T[],
  preferredTeamId?: string | null,
): { matching: T[]; other: T[] } {
  const preferred =
    preferredTeamId !== null && preferredTeamId !== undefined ? String(preferredTeamId).trim() : '';
  if (preferred) {
    const matching: T[] = [];
    const other: T[] = [];
    for (const list of lists) {
      if (list.teamId !== null && list.teamId !== undefined && String(list.teamId) === preferred) {
        matching.push(list);
      } else {
        other.push(list);
      }
    }
    return { matching, other };
  }

  const matching: T[] = [];
  const other: T[] = [];
  for (const list of lists) {
    if (list.teamId !== null && list.teamId !== undefined && String(list.teamId).trim() !== '') {
      matching.push(list);
    } else {
      other.push(list);
    }
  }
  return { matching, other };
}

export function intakeFieldLabelKey(fieldKey: string): string {
  const map: Record<string, string> = {
    name: 'garments.personName',
    shirtSize: 'garments.shirtSize',
    shortsSize: 'garments.shortsSize',
    socksSize: 'garments.socksSize',
    jerseyNumber: 'garments.jerseyNumber',
    jerseyName: 'garments.jerseyName',
    initials: 'garments.initials',
    comment: 'garments.comment',
  };
  return map[fieldKey] ?? `garments.${fieldKey}`;
}
