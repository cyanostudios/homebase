export interface Cup {
  id: string;
  name: string;
  organizer: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  categories: string | null;
  visible: boolean;
  featured: boolean;
  sanctioned: boolean;
  /** Approximate number of teams (e.g. Småland "Antal lag"). */
  team_count: number | null;
  /** Match format in English (e.g. "5 vs 5"), derived from ingest "Spelform". */
  match_format: string | null;
  description: string | null;
  registration_url: string | null;
  source_url: string | null;
  source_type: string | null;
  ingest_source_id: string | null;
  ingest_run_id: string | null;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CupValidationError {
  field: string;
  message: string;
}
