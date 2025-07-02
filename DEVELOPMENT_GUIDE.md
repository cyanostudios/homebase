# Development Guide & AI Instructions

## Project Overview
**Project Name:** Homebase  
**Repository:** cyanostudios/homebase  
**Current Status:** Transitioning from accounting app to core business template  
**Tech Stack:** React + TypeScript + Vite + Express + PostgreSQL + Drizzle ORM  

### Architecture Philosophy
**Internal Plugin-Based System** (for development teams & AI agents)
- **Core:** Essential functionality that every business app needs
- **Plugins:** Internal modules developed by teams following core standards
- **Team-Based Development:** Different teams can work on different plugins independently
- **Agent-Friendly:** AI agents can understand and extend the plugin system

### Core vs Plugin Separation
```
CORE (Essential - never remove):
├── Database layer & ORM
├── Authentication framework
├── Contacts management (core business entity)
├── API routing system
├── UI component library
├── Environment configuration
└── Plugin registration system

PLUGINS (Team-developed modules):
├── Invoices (first plugin - to be refactored from core)
├── Reporting 
├── Payment processing
├── [Future plugins by teams]
└── Custom business logic
```

### Development Roadmap
1. **Phase 1:** Complete Contacts as core functionality
2. **Phase 2:** Refactor Invoices into first plugin
3. **Phase 3:** Establish plugin development standards
4. **Phase 4:** Additional plugins by teams  

## Development Environment Setup

### Local Development
- **Database:** PostgreSQL via Docker (container: local-postgres)
- **Server:** Express on port 3001
- **Client:** React with Vite HMR
- **Environment:** `.env.local` with DATABASE_URL

### Production/Replit
- **Database:** Replit PostgreSQL (uses PGHOST, PGUSER, etc.)
- **Deployment:** Replit hosting
- **Environment:** Replit environment variables

## Architecture & Code Standards

### Folder Structure
```
/core                # Core system (protected - minimal changes)
  ├── /auth          # Authentication framework
  ├── /database      # Database layer & ORM
  ├── /contacts      # Contacts management (core entity)
  ├── /api           # Core API routing & plugin hooks
  ├── /ui            # Base UI components & layouts
  └── /config        # Environment & plugin registration

/plugins             # Team-developed modules
  ├── /invoices      # Invoice plugin (to be refactored)
  ├── /reporting     # Reporting plugin
  └── /[team-name]   # Custom team plugins

/client              # React frontend (core + plugin integration)
/server              # Express backend (core + plugin routes)
/shared              # Shared schemas/types between core & plugins
/migrations          # Drizzle migrations (core + plugins)
```

### Current Project Status
- **Name:** May change from "accounting" to more generic business app name
- **Current State:** Invoices mixed with core - needs refactoring
- **Next Priority:** Complete Contacts as stable core functionality
- **Plugin Migration:** Invoices will be first plugin extraction

### Database Layer
- **ORM:** Drizzle with PostgreSQL
- **Migrations:** Auto-generated via `drizzle-kit push`
- **Schema:** Defined in `/shared/schema.ts`

## AI Agent Instructions

### When Working with Claude in Cursor

#### Code Generation Principles
- **Senior-to-Junior Communication:** Write code as a senior developer but ensure it's readable and well-documented for junior developers
- **Clean Code:** Always remove unused imports, variables, and dead code
- **No Bloat:** Keep codebase lean - delete unnecessary files and dependencies
- **Documentation:** Include clear comments explaining complex logic and business rules
- **Variable-First Approach:** Use environment variables and configuration objects instead of hardcoded values
- **Plugin Architecture:** Build features as self-contained modules that can be enabled/disabled
- **Core Protection:** Never modify core files when adding features - use plugin system instead

#### Plugin Development Guidelines
- **Team Independence:** Teams can develop plugins without touching core files
- **Standard Interface:** All plugins follow the same registration and API patterns
- **Database Conventions:** Plugin tables use prefixes (e.g., `invoice_`, `report_`)
- **File-Based Configuration:** Plugin registration via config files, not UI
- **Core Integration:** Plugins hook into core via standardized endpoints
- **AI Agent Compatible:** Plugin structure should be clear for AI agents to understand and extend

#### Plugin Registration Process
1. **Development:** Team develops plugin following core standards
2. **Integration:** Plugin registers itself via config file
3. **Database:** Plugin manages its own schema/migrations
4. **API:** Plugin exposes standardized API endpoints
5. **Frontend:** Plugin provides React components that integrate with core UI

#### Database Operations
- **Environment Agnostic:** All database connections must use environment variables
- **No Hardcoded URLs:** Database connections should work across local/staging/production
- **Schema Management:** Keep schema definitions in shared folder for consistency

#### Frontend Development
- **Component Reusability:** Build components that can be easily moved or reused
- **Configuration Over Hardcoding:** API endpoints, URLs, and settings should be configurable
- **Clean Imports:** Regularly audit and remove unused dependencies

#### Error Handling
- **Environment-Aware Logging:** Different log levels for development vs production
- **Graceful Degradation:** Application should handle database/service failures gracefully

## Development Workflow

### Git Strategy
**Phase 1 - Core Development:**
- Work directly in `main` branch
- Focus on building stable core functionality
- Commits should be atomic and well-documented

**Phase 2 - Plugin Development:**
- Create feature branches for each plugin: `feature/plugin-invoices`, `feature/plugin-reporting`
- Teams work independently on their plugin branches
- Merge to `main` only after thorough testing
- Core remains protected - no direct core modifications in plugin branches

### Local Development Process
1. Clone Homebase repository
2. Set up local environment (Docker PostgreSQL + .env.local)
3. Develop and test locally
4. Push to appropriate branch (main for core, feature/* for plugins)
5. Merge to main when ready (post-core phase requires testing)

### Repository Migration
- **Current:** Working in cyanostudios/accounting
- **Target:** Migrate to cyanostudios/homebase
- **Process:** Clean migration focusing on core extraction

## Common Commands
```bash
# Start local development
npm run dev

# Database operations
npx drizzle-kit push      # Apply schema changes
npx drizzle-kit studio    # Open database browser

# Docker commands
docker start local-postgres    # Start database
docker stop local-postgres     # Stop database
```

## Troubleshooting

### Common Issues
- 

### Environment Variables
- **Local:** DATABASE_URL, PORT, NODE_ENV
- **Replit:** PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT

## Code Style & Conventions

### TypeScript
- **Strict Mode:** Use strict TypeScript settings
- **Type Safety:** Prefer interfaces over any types
- **Clear Naming:** Use descriptive variable names that explain purpose
- **Environment Variables:** Always type environment variables and provide fallbacks

### React Components
- **Functional Components:** Use functional components with hooks
- **Props Interface:** Define clear interfaces for all component props
- **Single Responsibility:** Each component should have one clear purpose
- **Reusable Logic:** Extract reusable logic into custom hooks

### API Endpoints
- **RESTful Design:** Follow REST conventions for API design
- **Environment Configuration:** API base URLs should be configurable
- **Error Responses:** Consistent error response format across all endpoints
- **Input Validation:** Validate all inputs with clear error messages

### General Principles
- **DRY (Don't Repeat Yourself):** Extract common functionality into utilities
- **KISS (Keep It Simple):** Simple solutions over complex architectures
- **Portable Code:** Write code that can easily migrate between platforms
- **Delete Mercilessly:** Remove unused code, files, and dependencies regularly

---
*Last Updated: [2 july 2025]*