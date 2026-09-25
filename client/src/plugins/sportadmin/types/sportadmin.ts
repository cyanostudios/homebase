// client/src/plugins/sportadmin/types/sportadmin.ts

export type SportadminConnectionStatus =
  | 'not_configured'
  | 'connected'
  | 'partial'
  | 'error'
  | 'syncing';

export type SportadminConnectionTestItem = {
  key: string;
  ok: boolean;
  warning?: boolean;
  label: string;
  detail?: string;
};

export type SportadminCounts = {
  pages: number;
  teams: number;
  news: number;
  matches: number;
  events: number;
  links: number;
};

export type SportadminStatus = {
  siteUrl: string | null;
  status: SportadminConnectionStatus;
  lastSuccessfulSync: string | null;
  lastAttemptedSync: string | null;
  nextSync: string | null;
  lastError: string | null;
  counts: SportadminCounts;
  connectionTest: SportadminConnectionTestItem[] | null;
  organizationName?: string | null;
  cronEnabled?: boolean;
  refreshIntervalMinutes?: number;
};

export type SportadminSyncError = {
  at: string;
  resource: string;
  status?: number | null;
  message: string;
};

export type SportadminDiscoveryNode = {
  label: string;
  count?: number;
  warning?: boolean;
  children?: SportadminDiscoveryNode[];
};

export type SportadminDiscovery = {
  siteUrl: string | null;
  tree: SportadminDiscoveryNode | null;
  resources?: Array<{ id: string; type: string; source_url?: string }>;
  errors?: SportadminSyncError[];
};

export type SportadminNewsItem = {
  id: string;
  title: string;
  excerpt?: string | null;
  published_at?: string | null;
  source_image_url?: string | null;
  source_url?: string | null;
};

export type SportadminMatchItem = {
  id: string;
  team?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  opponent?: string | null;
  is_home?: boolean | null;
  date?: string | null;
  time?: string | null;
  venue?: string | null;
  category?: string | null;
  source_url?: string | null;
};

export type SportadminTeamMatchSnippet = {
  title: string;
  when?: string | null;
};

export type SportadminTeamNewsSnippet = {
  title: string;
  when?: string | null;
  nid?: string | null;
  source_url?: string | null;
  image_url?: string | null;
  body?: string | null;
};

export type SportadminPageItem = {
  id: string;
  title: string;
  kind?: string | null;
  heading?: string | null;
  description?: string | null;
  description_image_url?: string | null;
  news_items?: SportadminTeamNewsSnippet[];
  sort_index?: number;
  source_url?: string | null;
  source_image_url?: string | null;
  imported_at?: string | null;
  updated_at?: string | null;
};

export type SportadminTeamPerson = {
  name: string;
  age?: string | null;
  description?: string | null;
  source_user_id?: string | null;
};

export type SportadminTeamModules = {
  news?: string | null;
  calendar?: string | null;
  matches?: string | null;
  roster?: string | null;
  contact?: string | null;
};

export type SportadminTeamItem = {
  id: string;
  name: string;
  category?: string | null;
  age_group?: string | null;
  heading?: string | null;
  description?: string | null;
  description_image_url?: string | null;
  upcoming_matches?: SportadminTeamMatchSnippet[];
  played_matches?: SportadminTeamMatchSnippet[];
  news_items?: SportadminTeamNewsSnippet[];
  modules?: SportadminTeamModules | null;
  players?: SportadminTeamPerson[];
  leaders?: SportadminTeamPerson[];
  contact?: string | null;
  source_url?: string | null;
  source_image_url?: string | null;
  imported_at?: string | null;
  updated_at?: string | null;
};
