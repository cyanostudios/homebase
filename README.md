# Homebase

A plugin-based business application template for rapid development of custom business solutions.

## 🏠 Overview

Homebase provides a robust foundation for building business applications with a core system that handles essential functionality and a plugin architecture for custom features. Perfect for development teams who need to build business apps quickly while maintaining code quality and scalability.

## ✨ Features

### Core System
- **Contact Management** - Complete CRUD operations for business contacts
- **Authentication Framework** - Secure user management with extensible auth options
- **Database Layer** - PostgreSQL with Drizzle ORM, works locally and in production
- **API Foundation** - RESTful APIs with plugin integration hooks
- **UI Components** - Reusable React components with consistent styling

### Plugin Architecture
- **Independent Development** - Teams can build plugins without touching core
- **Standardized Integration** - All plugins follow the same patterns
- **Database Isolation** - Plugin data is properly namespaced
- **Hot-Pluggable** - Enable/disable features via configuration

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (LTS recommended)
- Docker (for local PostgreSQL)
- Git

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone git@github.com:cyanostudios/homebase.git
   cd homebase
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start local PostgreSQL**
   ```bash
   docker run --name local-postgres \
     -e POSTGRES_PASSWORD=devpassword \
     -e POSTGRES_DB=homebase \
     -p 5432:5432 -d postgres:15
   ```

4. **Configure environment**
   ```bash
   # Create .env.local
   echo "DATABASE_URL=postgresql://postgres:devpassword@localhost:5432/homebase" > .env.local
   echo "PORT=3001" >> .env.local
   echo "NODE_ENV=development" >> .env.local
   ```

5. **Setup database**
   ```bash
   npx drizzle-kit push
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

7. **Open in browser**
   ```
   http://localhost:3001
   ```

## 🔧 Tech Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Express.js + TypeScript
- **Database:** PostgreSQL + Drizzle ORM
- **Development:** Cursor IDE with AI assistance
- **Deployment:** Replit (production) + Docker (local)

## 📁 Project Structure

```
/core/               # Core system (protected)
  ├── auth/          # Authentication framework
  ├── contacts/      # Contact management
  ├── database/      # Database layer & ORM
  ├── api/           # Core API & plugin hooks
  └── ui/            # Base UI components

/plugins/            # Plugin modules
  ├── invoices/      # Invoice management (first plugin)
  └── [future]/      # Additional team-developed plugins

/client/             # React frontend
/server/             # Express backend
/shared/             # Shared types & schemas
/migrations/         # Database migrations
```

## 🔌 Plugin Development

### Creating a Plugin

1. **Create plugin directory**
   ```bash
   mkdir plugins/my-plugin
   cd plugins/my-plugin
   ```

2. **Follow plugin structure**
   ```
   /my-plugin/
   ├── schema.ts        # Database schema
   ├── routes.ts        # API endpoints
   ├── components/      # React components
   ├── config.ts        # Plugin configuration
   └── README.md        # Plugin documentation
   ```

3. **Register plugin**
   - Add to plugin configuration
   - Export required interfaces
   - Follow naming conventions

### Plugin Guidelines

- ✅ **DO:** Use plugin-specific database table prefixes
- ✅ **DO:** Follow core UI component patterns
- ✅ **DO:** Handle errors gracefully
- ✅ **DO:** Write tests for your plugin

- ❌ **DON'T:** Modify core system files
- ❌ **DON'T:** Create tight coupling with other plugins
- ❌ **DON'T:** Bypass authentication or security measures

## 🚀 Deployment

### Local to Production
1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

2. **Deploy to Replit**
   - Pull changes in Replit
   - Environment variables auto-configured
   - PostgreSQL instance provided by Replit

### Environment Variables

**Local (.env.local):**
```
DATABASE_URL=postgresql://postgres:devpassword@localhost:5432/homebase
PORT=3001
NODE_ENV=development
```

**Production (Replit - auto-configured):**
```
PGHOST=<replit-provided>
PGUSER=<replit-provided>
PGPASSWORD=<replit-provided>
PGDATABASE=<replit-provided>
PGPORT=<replit-provided>
```

## 📖 Documentation

- **[Development Guide](./DEV_GUIDE.md)** - Detailed development instructions
- **[Product Requirements](./PRD.md)** - Product vision and requirements
- **[Plugin API Docs](./docs/plugin-api.md)** - Plugin development reference *(coming soon)*

## 🔄 Development Workflow

### Core Development (Current Phase)
- Work directly in `main` branch
- Focus on stability and plugin hooks
- All changes thoroughly tested

### Plugin Development (Future Phase)
- Create feature branches: `feature/plugin-name`
- Independent team development
- Merge to `main` after testing

## 🛠 Available Commands

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production

# Database
npx drizzle-kit push    # Apply schema changes
npx drizzle-kit studio  # Database browser

# Docker
docker start local-postgres   # Start local database
docker stop local-postgres    # Stop local database
```

## 🤝 Contributing

1. **For Core Features:** Work in `main` branch during core development phase
2. **For Plugins:** Create feature branch following naming convention
3. **Code Standards:** Follow the guidelines in DEV_GUIDE.md
4. **AI Assistance:** Use Cursor IDE with Claude for development

## 📋 Roadmap

### ✅ Phase 1: Core Foundation
- [x] Database layer with environment switching
- [x] Basic authentication framework
- [ ] Complete contact management system
- [ ] Plugin registration system
- [ ] Core UI component library

### 🔄 Phase 2: First Plugin
- [ ] Refactor invoices to plugin architecture
- [ ] Validate plugin integration patterns
- [ ] Document plugin development process
- [ ] Test plugin isolation

### 🎯 Phase 3: Expansion
- [ ] Additional plugins by development teams
- [ ] Advanced plugin features and hooks
- [ ] Performance optimizations
- [ ] Comprehensive documentation

## 📄 License

Internal use only - Cyanostudios

## 📞 Support

For questions about Homebase development:
- Check the [Development Guide](./DEV_GUIDE.md)
- Review the [PRD](./PRD.md) for product context
- Use Cursor IDE with Claude for coding assistance

---

**Built with ❤️ by the Cyanostudios team**