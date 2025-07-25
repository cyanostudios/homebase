# Development Guide & AI Instructions

## Project Overview
**Project Name:** Homebase  
**Repository:** cyanostudios/homebase  
**Current Status:** v5 - Production Ready with Complete Authentication  
**Tech Stack:** React + TypeScript + Vite + Express + PostgreSQL (Native SQL) + CommonJS  

### Architecture Philosophy
**Plugin-Based Business Application Template**
- **Core System:** Essential business app infrastructure (contacts, auth, database, API, UI)
- **Plugin System:** Self-contained modules that extend functionality without modifying core
- **Cross-Plugin References:** Advanced @mention system creating connections between plugins
- **Team Independence:** Different teams can develop plugins independently
- **Universal Components:** Shared UI/UX patterns across all plugins

### Core vs Plugin Architecture (v5)
```
CORE (Production Ready):
├── Authentication system (login/logout/sessions) ✅
├── Database layer (PostgreSQL native) ✅
├── API framework (Express with middleware) ✅
├── Session management (PostgreSQL store) ✅
├── Plugin access control ✅
├── Universal UI components ✅
├── Mobile-first responsive design ✅
├── Cross-plugin @mention system ✅
└── Production security (helmet, CORS, bcrypt) ✅

PLUGINS (Following established patterns):
├── Contacts (Complete - production ready) ✅
├── Notes (Complete - with @mention system) ✅
├── Import system (Planned - plugin-specific) 📋
├── Invoices (Future plugin) 📋
├── Projects (Future plugin) 📋
└── Equipment (Future plugin) 📋
```

### Development Roadmap
1. **Phase 1:** ✅ Complete database integration + authentication
2. **Phase 2:** ✅ Plugin system with cross-references (@mentions)
3. **Phase 3:** ✅ Production-ready deployment (Inleed Prime 3)
4. **Phase 4:** 📋 Data import strategies per plugin
5. **Phase 5:** 📋 Additional plugins following established patterns

## Development Environment Setup

### Local Development (v5)
- **Database:** PostgreSQL on localhost:5432/homebase_dev
- **Frontend:** Vite dev server on port 3001
- **Backend:** Express server on port 3002
- **Proxy:** Vite proxies `/api/*` requests to backend
- **Environment:** `.env.local` with DATABASE_URL
- **Authentication:** admin@homebase.se / admin123

### Production/Inleed Prime 3 (Ready)
- **Database:** PostgreSQL on Inleed server
- **Deployment:** CommonJS compatible Node.js application
- **Environment:** Production environment variables
- **SSL:** Configured domain with HTTPS
- **Security:** Production middleware stack

## Architecture & Code Standards

### Current Folder Structure (v5)
```
/client/src
  ├── /core
  │   ├── /ui                # UniversalPanel, LoginComponent, TopBar, etc.
  │   └── /api              # AppContext with database integration
  ├── /plugins
  │   ├── /contacts
  │   │   └── /components   # ContactList, ContactForm, ContactView
  │   └── /notes
  │       ├── /types        # Note and NoteMention interfaces
  │       └── /components   # NotesList, NoteForm, NoteView, MentionTextarea
  ├── /hooks               # useUnsavedChanges, custom hooks
  ├── /lib                 # Utilities
  └── /utils               # Helper functions

/server
  └── index.ts             # Complete API server with auth + CRUD

/scripts
  └── setup-database.js    # Database setup with sample data

/preservation              # Backup of working components from v1
```

### Current Project Status (v5)
- **Name:** Homebase - Production-ready plugin-based business application
- **Authentication:** ✅ Complete login/logout with session management
- **Database:** ✅ PostgreSQL with native SQL queries
- **API Integration:** ✅ All components use database backend
- **Plugin System:** ✅ Working contacts + notes with cross-references
- **Mobile Design:** ✅ Mobile-first responsive interface maintained
- **Production Ready:** ✅ CommonJS, security middleware, error handling

### Database Layer (Implemented)
- **Database:** PostgreSQL with native SQL queries
- **Setup:** `scripts/setup-database.js` with sample data
- **Schema:** Users, contacts, notes, sessions, plugin access control
- **Security:** Parameterized queries, bcrypt password hashing
- **Sessions:** PostgreSQL-backed session store

## v5 Achievements & Standards

### Complete Authentication System (Implemented)
- **Login Component:** Responsive login screen with error handling
- **Session Management:** HTTP-only cookies with PostgreSQL store
- **User Interface:** TopBar with user info and logout button
- **API Integration:** All endpoints protected with authentication
- **Plugin Access Control:** User-based plugin permissions

### Cross-Plugin Reference System (Revolutionary)
- **@mention System:** Type @ in notes to reference contacts
- **Auto-complete:** Dropdown with keyboard navigation
- **Bidirectional References:** Notes show mentioned contacts, contacts show mentioning notes
- **Clickable Navigation:** Click @mentions to navigate between plugins
- **Database Storage:** All mentions stored with position and metadata

### Production Security (Implemented)
- **Password Hashing:** bcrypt with salt rounds
- **Session Security:** HTTP-only cookies with expiration
- **CORS Protection:** Configured for development/production
- **Security Headers:** Helmet.js implementation
- **Input Validation:** Express body parsing limits
- **SQL Injection Prevention:** Parameterized queries

### Professional UX Patterns (Maintained from v4)
- **Mobile-First Design:** All components responsive across devices
- **Unsaved Changes Protection:** Warning dialogs when leaving forms
- **Consistent Confirmations:** ConfirmDialog component for dangerous actions
- **Form State Management:** useUnsavedChanges hook with validation
- **Loading States:** Proper feedback during API operations

### Component Architecture (v5)
- **UniversalPanel:** 672px-wide right panel handling multiple plugin types
- **LoginComponent:** Complete authentication UI with error states
- **TopBar:** User info, logout, and responsive mobile menu
- **Plugin Components:** Contacts and Notes following established patterns
- **Button Standards:** Primary/secondary/danger variants with icons

## AI Agent Instructions

### When Working with Claude in Cursor

#### Communication Style (v5)
- **Direct Commands Only:** "Write this in terminal 1" - no long explanations
- **Code Artifacts:** Use artifacts for longer code files requiring manual copy/paste
- **Clean Code Focus:** No code bloat, maintain production quality
- **Best Practices:** Senior-level coding standards assumed
- **Minimal Reasoning:** Trust user's judgment, provide direct solutions

#### Development Workflow Patterns (v5)
- **Step-by-Step:** Break complex tasks into small, testable steps
- **Terminal Management:** Always specify which terminal (1: frontend, 2: backend, 3: commands)
- **Agent Usage:** Use Cursor agents (GPT-4.1, Gemini) sparingly - only when necessary
- **File Management:** Manual copy/paste from artifacts for longer code files
- **Testing:** Test each step before proceeding to next
- **CommonJS:** All server code uses require/module.exports (no ESM)

#### Code Generation Principles (v5)
- **Follow Established Patterns:** Use Notes plugin as template for new plugins
- **Database Integration:** All data operations through PostgreSQL API calls
- **Authentication Required:** All plugin routes protected with authentication
- **Cross-Plugin References:** Use @mention pattern for plugin-to-plugin connections
- **Mobile-First:** All new components must be responsive
- **TypeScript Safety:** Complete type definitions for all interfaces

#### Plugin Development Guidelines (v5)
- **Plugin Structure:** Follow notes plugin pattern exactly
- **Database Integration:** Use API endpoints, not direct database access
- **Cross-Plugin References:** Implement @mention system for connections
- **Mobile Responsive:** All plugin components must work on mobile
- **Authentication:** Respect plugin access control system
- **Component Reuse:** Use UniversalPanel, established UI patterns

### Established v5 Patterns to Follow

#### Plugin Development Template
```typescript
// Plugin structure (follow notes plugin exactly)
/plugins/[plugin-name]/
├── types/[plugin-name].ts          # TypeScript interfaces
└── components/
    ├── [Name]List.tsx              # List view with mobile cards
    ├── [Name]Form.tsx              # Form with useUnsavedChanges
    └── [Name]View.tsx              # View with cross-plugin references

// API integration pattern
const api = {
  async get[Items]() {
    return fetch('/api/[plugin-name]', { credentials: 'include' });
  },
  async create[Item](data) {
    return fetch('/api/[plugin-name]', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }
};
```

#### Authentication Integration
```typescript
// App.tsx pattern for authentication
function AppContent() {
  const { isAuthenticated, isLoading } = useApp();
  
  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <LoginComponent />;
  
  return <MainAppContent />;
}
```

#### Cross-Plugin References
```typescript
// @mention system pattern
import { MentionTextarea } from '@/core/ui/MentionTextarea';
import { MentionContent } from '@/core/ui/MentionContent';

// In form components
<MentionTextarea 
  value={content}
  onChange={(content, mentions) => updateField('content', content, mentions)}
/>

// In view components
<MentionContent content={item.content} mentions={item.mentions} />
```

## Development Workflow

### Git Strategy (v5)
- **Branch:** `fresh-start-v4` (current working branch - being updated to v5)
- **Backup:** Previous versions tagged and preserved
- **Commit Style:** Functional, descriptive commits after each working feature
- **Preservation:** `/preservation/` folder contains working v1 components

### Local Development Process (v5)
1. **Terminal 1:** `npx vite --config vite.config.ts` (frontend)
2. **Terminal 2:** `npx tsx server/index.ts` (backend)
3. **Terminal 3:** Commands (git, file operations, curl tests)
4. Test authentication: http://localhost:3001 → login → test functionality
5. Use artifacts for longer code files
6. Commit working states frequently

### Database Operations (v5)
```bash
# Database setup (already configured)
node scripts/setup-database.js

# Health check
curl http://localhost:3002/api/health

# Test authentication
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@homebase.se","password":"admin123"}'
```

## Code Style & Conventions (v5 Standards)

### TypeScript
- **Strict Mode:** Complete type safety implemented
- **Interface Definitions:** All components have proper TypeScript interfaces
- **API Integration:** All data operations through fetch with proper error handling
- **Authentication:** All API calls include credentials for session management

### React Components
- **Functional Components:** All components use hooks pattern
- **Custom Hooks:** useUnsavedChanges pattern for form state management
- **Authentication Integration:** useApp() hook for user state and auth functions
- **Mobile-First:** All components responsive with mobile-first approach
- **Loading States:** Proper loading indicators during API operations

### Database Integration
- **CommonJS:** All server code uses require/module.exports
- **Native SQL:** Direct PostgreSQL queries with parameterized statements
- **Session Management:** PostgreSQL-backed session store
- **Authentication:** bcrypt password hashing with secure sessions
- **Plugin Access Control:** User-based plugin permissions

### UI/UX Standards (v5)
- **Mobile-First Design:** All components work excellently on mobile
- **Authentication UI:** Login screen with error handling and loading states
- **User Interface:** TopBar with user info and logout functionality
- **Cross-Plugin Navigation:** @mention system for plugin-to-plugin connections
- **Consistent Styling:** Button, Card, UniversalPanel patterns maintained

## Plugin Development (v5)

### Plugin Creation Process
1. **Follow Notes Plugin Pattern:** Use as exact template for structure
2. **Database Integration:** Create API endpoints following established patterns
3. **Authentication:** Ensure all routes protected with authentication middleware
4. **Cross-Plugin References:** Implement @mention system if applicable
5. **Mobile Responsive:** Test on mobile devices and responsive design
6. **AppContext Integration:** Add plugin state to global context

### Plugin Import Strategy (Planned)
```typescript
// Plugin-specific import strategies
interface ImportStrategy<T> {
  pluginName: string;
  supportedFormats: string[]; // ['csv', 'xlsx', 'json']
  validateData: (data: any[]) => ImportValidationResult;
  transformData: (data: any[]) => T[];
  importData: (data: T[]) => Promise<ImportResult>;
}

// Implementation examples
ContactsImportStrategy: CSV/Excel with business field validation
NotesImportStrategy: Text files with @mention auto-detection
InvoicesImportStrategy: Excel with invoice numbers, amounts, dates
```

## Troubleshooting Patterns (v5)

### Common v5 Issues
- **Authentication Errors:** Check session cookies and API authentication
- **Database Errors:** Verify PostgreSQL connection and schema
- **API Integration:** Ensure all endpoints use proper authentication
- **Mobile Issues:** Test responsive design on actual mobile devices
- **Cross-Plugin References:** Verify @mention system and navigation

### Environment Variables (v5)
- **Local:** Frontend port 3001, Backend port 3002
- **Database:** PostgreSQL on localhost:5432/homebase_dev
- **Authentication:** admin@homebase.se / admin123
- **Session:** PostgreSQL session store with 24h expiry

## Current Status Summary

### ✅ Completed (v5)
- **Complete Authentication System:** Login, session management, logout
- **Database Integration:** PostgreSQL with native SQL queries
- **API Integration:** All components use database backend
- **Cross-Plugin References:** @mention system connecting plugins
- **Mobile-First Design:** Responsive interface across all devices
- **Production Security:** Comprehensive security middleware
- **Plugin System:** Working contacts + notes plugins
- **Production Ready:** CommonJS compatible for Inleed Prime 3

### 🎯 Next Priorities
1. **Production Deployment:** Deploy to Inleed Prime 3
2. **Data Import System:** Plugin-specific import strategies
3. **Additional Plugins:** Invoice, Projects, Equipment modules
4. **Multi-tenant Architecture:** Customer-specific installations

---
*Last Updated: July 2025 - v5 Production Ready*