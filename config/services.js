// config/services.js
// Service configuration for core infrastructure
// Environment-specific configurations

const env = process.env.NODE_ENV || 'development';

const configs = {
  development: {
    // Service Providers
    DATABASE_PROVIDER: process.env.DATABASE_PROVIDER || 'postgres',
    TENANT_PROVIDER: process.env.TENANT_PROVIDER || 'local', // Use 'local' for dev (no Neon API key needed)
    POOL_PROVIDER: process.env.POOL_PROVIDER || 'postgres',
    LOGGER_PROVIDER: process.env.LOGGER_PROVIDER || 'console',
    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'local',
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'smtp',
    QUEUE_PROVIDER: process.env.QUEUE_PROVIDER || 'memory',
    CACHE_PROVIDER: process.env.CACHE_PROVIDER || 'memory',
    
    database: {
      provider: process.env.DATABASE_PROVIDER || 'postgres',
      // Uses DATABASE_URL from environment
      connectionString: process.env.DATABASE_URL,
    },
    
    tenant: {
      provider: process.env.TENANT_PROVIDER || 'local',
      local: {
        connectionString: process.env.DATABASE_URL,
      },
      neon: {
        apiKey: process.env.NEON_API_KEY,
        region: process.env.NEON_REGION || 'aws-eu-central-1',
      },
    },
    
    connectionPool: {
      provider: process.env.POOL_PROVIDER || 'postgres',
      postgres: {
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        cleanupInterval: 60 * 60 * 1000, // 1 hour
        maxPoolAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    },
    
    logger: {
      provider: process.env.LOGGER_PROVIDER || 'console',
      console: {
        level: process.env.LOG_LEVEL || 'debug',
        enableColors: true,
      },
      // Sentry configuration (if using)
      sentry: {
        dsn: process.env.SENTRY_DSN,
        environment: 'development',
      },
    },
    
    storage: {
      provider: process.env.STORAGE_PROVIDER || 'local',
      local: {
        uploadDir: process.env.UPLOAD_DIR || './server/uploads',
      },
      // R2 configuration (if using)
      r2: {
        accountId: process.env.R2_ACCOUNT_ID,
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        bucket: process.env.R2_BUCKET,
        endpoint: process.env.R2_ENDPOINT,
      },
      // S3 configuration (if using)
      s3: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1',
        bucket: process.env.AWS_S3_BUCKET,
      },
    },
    
    email: {
      provider: process.env.EMAIL_PROVIDER || 'smtp',
      smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        from: process.env.SMTP_FROM || 'noreply@homebase.se',
      },
      resend: {
        apiKey: process.env.RESEND_API_KEY,
      },
      sendgrid: {
        apiKey: process.env.SENDGRID_API_KEY,
      },
    },
    
    queue: {
      provider: process.env.QUEUE_PROVIDER || 'memory',
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    },
    
    cache: {
      provider: process.env.CACHE_PROVIDER || 'memory',
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    },
  },
  
  production: {
    // Service Providers
    DATABASE_PROVIDER: process.env.DATABASE_PROVIDER || 'postgres',
    TENANT_PROVIDER: process.env.TENANT_PROVIDER || 'neon', // Use 'neon' for production
    POOL_PROVIDER: process.env.POOL_PROVIDER || 'postgres',
    LOGGER_PROVIDER: process.env.LOGGER_PROVIDER || 'console',
    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'r2',
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'resend',
    QUEUE_PROVIDER: process.env.QUEUE_PROVIDER || 'redis',
    CACHE_PROVIDER: process.env.CACHE_PROVIDER || 'redis',
    
    database: {
      provider: process.env.DATABASE_PROVIDER || 'postgres',
      connectionString: process.env.DATABASE_URL,
    },
    
    tenant: {
      provider: process.env.TENANT_PROVIDER || 'neon',
      neon: {
        apiKey: process.env.NEON_API_KEY,
        region: process.env.NEON_REGION || 'aws-eu-central-1',
      },
      local: {
        connectionString: process.env.DATABASE_URL,
      },
    },
    
    connectionPool: {
      provider: process.env.POOL_PROVIDER || 'postgres',
      postgres: {
        max: parseInt(process.env.POOL_MAX_SIZE || '10'),
        idleTimeoutMillis: parseInt(process.env.POOL_IDLE_TIMEOUT || '30000'),
        connectionTimeoutMillis: parseInt(process.env.POOL_CONNECTION_TIMEOUT || '2000'),
        cleanupInterval: parseInt(process.env.POOL_CLEANUP_INTERVAL || '3600000'),
        maxPoolAge: parseInt(process.env.POOL_MAX_AGE || '86400000'),
      },
    },
    
    logger: {
      provider: process.env.LOGGER_PROVIDER || 'sentry',
      console: {
        level: process.env.LOG_LEVEL || 'info',
        enableColors: false,
      },
      sentry: {
        dsn: process.env.SENTRY_DSN,
        environment: 'production',
      },
    },
    
    storage: {
      provider: process.env.STORAGE_PROVIDER || 'r2',
      r2: {
        accountId: process.env.R2_ACCOUNT_ID,
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        bucket: process.env.R2_BUCKET,
        endpoint: process.env.R2_ENDPOINT,
      },
      s3: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1',
        bucket: process.env.AWS_S3_BUCKET,
      },
    },
    
    email: {
      provider: process.env.EMAIL_PROVIDER || 'resend',
      resend: {
        apiKey: process.env.RESEND_API_KEY,
      },
      sendgrid: {
        apiKey: process.env.SENDGRID_API_KEY,
      },
    },
    
    queue: {
      provider: process.env.QUEUE_PROVIDER || 'redis',
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    },
    
    cache: {
      provider: process.env.CACHE_PROVIDER || 'redis',
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    },
  },
  
  test: {
    // Service Providers (use mocks in tests)
    DATABASE_PROVIDER: 'postgres',
    TENANT_PROVIDER: 'local', // Always use local for tests
    POOL_PROVIDER: 'postgres',
    LOGGER_PROVIDER: 'console',
    STORAGE_PROVIDER: 'local',
    EMAIL_PROVIDER: 'smtp',
    QUEUE_PROVIDER: 'memory',
    CACHE_PROVIDER: 'memory',
    
    database: {
      provider: 'postgres',
      connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    },
    
    tenant: {
      provider: 'local',
      local: {
        connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
      },
    },
    
    connectionPool: {
      provider: 'postgres',
      postgres: {
        max: 5, // Smaller pool for tests
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 1000,
      },
    },
    
    logger: {
      provider: 'console',
      console: {
        level: 'error', // Only show errors in tests
        enableColors: false,
      },
    },
    
    storage: {
      provider: 'local',
      local: {
        uploadDir: './test-uploads',
      },
    },
    
    email: {
      provider: 'smtp',
      smtp: {
        host: 'localhost',
        port: 1025, // Test mail server
      },
    },
    
    queue: {
      provider: 'memory',
    },
    
    cache: {
      provider: 'memory',
    },
  },
};

module.exports = configs[env] || configs.development;
