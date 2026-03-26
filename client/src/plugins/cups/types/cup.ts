export interface Cup {
  id: string;
  name: string;
  organizer: string | null;
  region: string | null;
  location: string | null;
  sport_type: string;
  start_date: string | null;
  end_date: string | null;
  age_groups: string | null;
  registration_url: string | null;
  source_url: string | null;
  source_id: string | null;
  raw_snippet: string | null;
  scraped_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CupSource {
  id: string;
  type: 'url' | 'file';
  url: string | null;
  filename: string | null;
  label: string | null;
  enabled: boolean;
  last_scraped_at: string | null;
  last_result: string | null;
  created_at: string;
  updated_at: string | null;
}
