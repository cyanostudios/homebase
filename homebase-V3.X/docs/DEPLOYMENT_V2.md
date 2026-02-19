# Deployment Guide - Homebase V2

This guide covers deployment of Homebase V2 with the new service abstraction architecture.

## Prerequisites

- Node.js >= 22.18
- PostgreSQL database (or Neon, MySQL)
- Environment variables configured
- SSL certificate (for production)

## Environment Setup

### 1. Copy Environment Template

```bash
cp .env.example .env.local
```

### 2. Configure Environment Variables

Edit `.env.local` and set the following required variables:

#### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Session
SESSION_SECRET=your-secret-key-minimum-32-characters

# Application
NODE_ENV=production
PORT=3002
```

#### Service Providers (V2)

```bash
# Choose your providers
DATABASE_PROVIDER=postgres  # or neon, mysql
LOGGER_PROVIDER=console     # or sentry
STORAGE_PROVIDER=r2         # or s3, local
EMAIL_PROVIDER=resend       # or sendgrid, smtp
QUEUE_PROVIDER=redis        # or memory
CACHE_PROVIDER=redis        # or memory
```

#### Cloud Storage (if using R2 or S3)

```bash
# R2 (Cloudflare)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET=your-bucket-name
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com

# OR S3 (AWS)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
```

#### Email Service (if using Resend or SendGrid)

```bash
# Resend
RESEND_API_KEY=re_xxxxxxxxxxxxx

# OR SendGrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
```

#### Monitoring (if using Sentry)

```bash
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
SENTRY_ENVIRONMENT=production
```

## Build Process

### 1. Install Dependencies

```bash
npm ci
```

### 2. Build Application

```bash
npm run build
```

This will:

- Build the frontend (Vite)
- Compile TypeScript server code
- Copy static assets

### 3. Run Database Migrations

```bash
# Ensure DATABASE_URL is set in .env.local
node scripts/setup-database.js
```

## Deployment Platforms

### Railway

1. **Connect Repository**
   - Link your GitHub repository to Railway
   - Railway will auto-detect Node.js

2. **Set Environment Variables**
   - Go to Variables tab
   - Add all required variables from `.env.example`
   - Set `NODE_ENV=production`

3. **Configure Build**
   - Build command: `npm run build`
   - Start command: `npm start`

4. **Database**
   - Add PostgreSQL service
   - Railway will provide `DATABASE_URL` automatically
   - Run migrations: `npm run setup-database` (or use Railway's post-deploy script)

5. **Storage**
   - **Important**: Railway has ephemeral filesystem
   - **Must use cloud storage** (R2 or S3) for file uploads
   - Set `STORAGE_PROVIDER=r2` or `STORAGE_PROVIDER=s3`

### Vercel

1. **Import Project**
   - Import from GitHub
   - Framework: Other

2. **Build Settings**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm ci`

3. **Environment Variables**
   - Add all variables from `.env.example`
   - Set `NODE_ENV=production`

4. **Serverless Functions**
   - Vercel uses serverless functions
   - Ensure your Express app is compatible
   - May need to adjust routing

### Heroku

1. **Create App**

   ```bash
   heroku create your-app-name
   ```

2. **Set Environment Variables**

   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set DATABASE_URL=your-database-url
   heroku config:set SESSION_SECRET=your-secret
   # ... add all other variables
   ```

3. **Deploy**

   ```bash
   git push heroku main
   ```

4. **Run Migrations**
   ```bash
   heroku run npm run setup-database
   ```

### Docker

1. **Create Dockerfile**

   ```dockerfile
   FROM node:22-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   RUN npm run build
   EXPOSE 3002
   CMD ["npm", "start"]
   ```

2. **Build and Run**
   ```bash
   docker build -t homebase .
   docker run -p 3002:3002 --env-file .env.local homebase
   ```

## Post-Deployment Checklist

### 1. Verify Services

- [ ] Database connection working
- [ ] Storage service accessible (if using cloud)
- [ ] Email service configured (if using)
- [ ] Logger service working (check logs)

### 2. Security

- [ ] HTTPS enabled
- [ ] `SESSION_COOKIE_SECURE=true` (if using HTTPS)
- [ ] CSRF protection enabled
- [ ] Rate limiting configured
- [ ] Environment variables secured (not in code)

### 3. Performance

- [ ] Database connection pooling configured
- [ ] Redis configured (if using for cache/queue)
- [ ] CDN configured (if using for static assets)
- [ ] File upload limits set appropriately

### 4. Monitoring

- [ ] Sentry configured (if using)
- [ ] Error logging working
- [ ] Health check endpoint accessible
- [ ] Uptime monitoring configured

## Health Checks

The application should respond to health checks:

```bash
curl https://your-domain.com/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Check database is accessible from deployment platform
- Verify SSL settings if required

### Storage Issues

- Verify cloud storage credentials
- Check bucket permissions
- Ensure bucket exists and is accessible

### Email Issues

- Verify API keys are correct
- Check email service account status
- Verify sender email is verified (for Resend/SendGrid)

### Session Issues

- Ensure `SESSION_SECRET` is set and secure
- Check session store configuration
- Verify cookies are working (check browser)

## Rollback Procedure

1. **Revert Code**

   ```bash
   git revert HEAD
   git push
   ```

2. **Revert Database** (if needed)
   - Restore from backup
   - Or run reverse migrations

3. **Revert Environment Variables**
   - Restore previous values
   - Restart application

## Backup Strategy

### Database

- Automated backups (daily)
- Point-in-time recovery enabled
- Test restore procedures regularly

### Files

- Cloud storage with versioning enabled
- Regular backups of critical files
- Cross-region replication (if available)

## Scaling

### Horizontal Scaling

- Use load balancer
- Ensure session store is shared (Redis)
- Database connection pooling
- Stateless application design

### Vertical Scaling

- Increase server resources
- Optimize database queries
- Enable caching (Redis)
- Use CDN for static assets

## Support

For issues or questions:

- Check logs: `heroku logs --tail` (Heroku) or platform equivalent
- Review error tracking (Sentry)
- Check application health endpoint
- Review database connection pool status
