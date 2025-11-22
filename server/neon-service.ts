// server/neon-service.ts
import axios from 'axios';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

class NeonService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://console.neon.tech/api/v2';
  }

  async createTenantDatabase(userId: number, userEmail: string) {
    try {
      // 1. Create Neon project
      const projectName = `homebase-tenant-${userId}`;
      const project = await this.createProject(projectName);
      
      // 2. Get default database connection string
      const connectionString = project.connection_uris[0].connection_uri;
      
      // 3. Run migrations on new database
      await this.runMigrations(connectionString);
      
      return {
        projectId: project.project.id,
        databaseName: project.databases[0].name,
        connectionString: connectionString,
      };
    } catch (error: any) {
      console.error('Failed to create tenant database:', error.response?.data || error.message);
      throw error;
    }
  }

  async createProject(projectName: string) {
    const response = await axios.post(
      `${this.baseUrl}/projects`,
      {
        project: {
          name: projectName,
          region_id: 'aws-eu-north-1', // Stockholm region
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return response.data;
  }

  async runMigrations(connectionString: string) {
    const pool = new Pool({ connectionString });
    
    try {
      // Get all migration files
      const migrationsDir = path.join(__dirname, 'migrations');
      
      // Skip if migrations folder doesn't exist
      if (!fs.existsSync(migrationsDir)) {
        console.log('⚠️  No migrations folder found, skipping migrations');
        return;
      }
      
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      console.log(`Running ${migrationFiles.length} migrations...`);

      for (const file of migrationFiles) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        console.log(`Executing migration: ${file}`);
        await pool.query(sql);
      }

      console.log('✅ All migrations completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    } finally {
      await pool.end();
    }
  }

  async deleteTenantDatabase(projectId: string) {
    try {
      await axios.delete(
        `${this.baseUrl}/projects/${projectId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );
      console.log(`Deleted Neon project: ${projectId}`);
    } catch (error: any) {
      console.error('Failed to delete project:', error.response?.data || error.message);
      throw error;
    }
  }
}

export default NeonService;