export interface Tenant {
  id: number;
  email: string;
  role: string;
  neon_project_id?: string;
  neon_database_name: string;
  neon_connection_string: string;
}
