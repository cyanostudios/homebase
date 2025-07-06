# Development Guide & AI Instructions

## Project Overview
**Project Name:** Homebase  
**Repository:** cyanostudios/homebase  
**Current Status:** v3 - Enterprise-grade Contact Management System  
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
├── Contacts management (complete - v3)
├── API routing system
├── UI component library (UniversalPanel, ConfirmDialog, etc.)
├── Environment configuration
├── Validation framework
├── State management (AppContext)
└── Plugin registration system

PLUGINS (Team-developed modules):
├── Invoices (next priority - to be refactored from core)
├── Reporting 
├── Payment processing
├── Calendar/Equipment (future plugins)
└── Custom business logic
```

### Development Roadmap
1. **Phase 1:** ✅ Complete Contacts as core functionality (v3 DONE)
2. **Phase 2:** Refactor Invoices into first plugin
3. **Phase 3:** Establish plugin development standards
4. **Phase 4:** Additional plugins by teams  

## Development Environment Setup

### Local Development
- **Database:** PostgreSQL via Docker (container: local-postgres)
- **Frontend:** Vite dev server on port 3001
- **Backend:** Express server on port 3002
- **Proxy:** Vite proxies `/api/*` requests to backend
- **Environment:** `.env.local` with DATABASE_URL

### Production/Replit
- **Database:** Replit PostgreSQL (uses PGHOST, PGUSER, etc.)
- **Deployment:** Replit hosting
- **Environment:** Replit environment variables

## Architecture & Code Standards

### Current Folder Structure (v3)
```
/client/src
  ├── /core
  │   ├── /ui                # UniversalPanel, ConfirmDialog, Button, etc.
  │   └── /api              # AppContext, global state management
  ├── /plugins
  │   └── /contacts
  │       └── /components   # ContactList, ContactForm
  ├── /hooks               # useUnsavedChanges, custom hooks
  ├── /lib                 # Utilities
  └── /utils               # Helper functions

/server
  ├── /core                # Core server functionality
  └── /plugins             # Plugin-specific API routes

/shared                    # Types/schemas shared between client/server
/preservation              # Backup of working components from v1
```

### Current Project Status (v3)
- **Name:** Homebase - Plugin-based business application template
- **Contacts System:** ✅ Complete enterprise-grade implementation
- **Next Priority:** Database integration (PostgreSQL + Drizzle)
- **Plugin Migration:** Invoices will be first plugin extraction after DB layer

### Database Layer (Planned)
- **ORM:** Drizzle with PostgreSQL
- **Migrations:** Auto-generated via `drizzle-kit push`
- **Schema:** Defined in `/shared/schema.ts`

## v3 Achievements & Standards

### Professional UX Patterns (Implemented)
- **Unsaved Changes Protection:** Warning dialogs when leaving forms with unsaved data
- **Consistent Confirmations:** ConfirmDialog component replaces browser alerts
- **Form State Management:** Custom useUnsavedChanges hook with useCallback optimizations
- **Smart Reset Logic:** Form resets cleanly in create mode after discard
- **Validation Framework:** Comprehensive error handling with field-level feedback

### Component Architecture (v3)
- **UniversalPanel:** 672px-wide right panel with header/footer and scrollable content
- **ConfirmDialog:** Reusable confirmation dialog for dangerous actions
- **ContactForm:** Enterprise-grade form with company/private toggle, repeatable sections
- **ContactList:** Professional table with action buttons and consistent styling
- **Button Standards:** Primary/secondary/danger variants with consistent icons

### Working Code Patterns
- **useCallback Optimization:** Prevents infinite loops in React hooks
- **Global Window Functions:** `window.submitContactForm`, `window.cancelContactForm`
- **State Management:** React Context for global state, useState for component state
- **TypeScript Interfaces:** Complete type safety for complex business data

## AI Agent Instructions

### When Working with Claude in Cursor

#### Communication Style
- **Direct Commands Only:** "Write this in terminal 1" - no long explanations
- **Code Artifacts:** Use artifacts for longer code files that need manual copy/paste
- **Clean Code Focus:** No code bloat, thoughtful changes only
- **Best Practices:** Senior-level coding standards assumed
- **Minimal Reasoning:** Trust user's judgment, provide direct solutions

#### Development Workflow Patterns (v3)
- **Step-by-Step:** Break complex tasks into small, testable steps
- **Terminal Management:** Always specify which terminal (1: frontend, 2: backend, 3: commands)
- **Agent Usage:** Use Cursor agents (GPT-4.1, Gemini) sparingly - only when necessary
- **File Management:** Manual copy/paste from artifacts for longer code files
- **Testing:** Test each step before proceeding

#### Code Generation Principles
- **Reuse Established Patterns:** Follow v3 patterns for new components
- **useCallback for Handlers:** Stabilize function references to prevent loops
- **Consistent Imports:** React imports, Lucide icons, core UI components
- **TypeScript Interfaces:** Define clear interfaces for component props
- **Error Handling:** Follow ConfirmDialog and validation patterns

#### Plugin Development Guidelines
- **Team Independence:** Teams can develop plugins without touching core files
- **Standard Interface:** All plugins follow the same registration and API patterns
- **Database Conventions:** Plugin tables use prefixes (e.g., `invoice_`, `report_`)
- **Core Integration:** Plugins hook into core via standardized endpoints
- **Component Reuse:** Use UniversalPanel, ConfirmDialog, Button standards

### Established v3 Patterns to Follow

#### Form Components
```typescript
// Use useUnsavedChanges hook
const { isDirty, showWarning, markDirty, markClean, attemptAction, confirmDiscard, cancelDiscard } = useUnsavedChanges();

// Stabilize handlers with useCallback
const handleSubmit = useCallback(() => {
  // handler logic
}, [dependencies]);

// Global window functions for footer buttons
useEffect(() => {
  window.submitForm = handleSubmit;
  window.cancelForm = handleCancel;
  return () => {
    delete window.submitForm;
    delete window.cancelForm;
  };
}, [handleSubmit, handleCancel]);
```

#### Confirmation Dialogs
```typescript
// Use ConfirmDialog component
<ConfirmDialog
  isOpen={showConfirm}
  title="Delete Item"
  message="Are you sure?"
  confirmText="Delete"
  cancelText="Cancel"
  onConfirm={handleConfirm}
  onCancel={handleCancel}
  variant="danger"
/>
```

#### Component Structure
- **UniversalPanel** for right-side panels
- **Card** components for content sections
- **Button** with consistent variants and Lucide icons
- **Heading** and **Text** from Typography for consistent text styles

## Development Workflow

### Git Strategy (v3)
- **Branch:** `fresh-start-v3` (current working branch)
- **Backup:** Previous versions tagged and preserved
- **Commit Style:** Functional, descriptive commits after each working feature
- **Preservation:** `/preservation/` folder contains working v1 components

### Local Development Process
1. **Terminal 1:** `npx vite --config vite.config.ts` (frontend)
2. **Terminal 2:** `npx tsx server/index.ts` (backend)
3. **Terminal 3:** Commands (git, file operations, curl tests)
4. Test each step before proceeding
5. Use artifacts for longer code files
6. Commit working states frequently

### Database Integration (Next Phase)
```bash
# Future commands for database setup
npx drizzle-kit push      # Apply schema changes
npx drizzle-kit studio    # Open database browser
docker start local-postgres    # Start database
```

## Code Style & Conventions (v3 Standards)

### TypeScript
- **Strict Mode:** Complete type safety implemented
- **Interface Definitions:** All components have proper TypeScript interfaces
- **useCallback:** Stabilize function references to prevent React loops
- **Import Organization:** React imports first, then UI components, then hooks

### React Components
- **Functional Components:** All components use hooks pattern
- **Custom Hooks:** useUnsavedChanges pattern for form state management
- **Global Functions:** Window-attached functions for cross-component communication
- **Consistent Styling:** Follow Button, Card, UniversalPanel patterns

### UI/UX Standards
- **Font Sizes:** Reduced globally (16px→15px, 14px→13px) for better density
- **Icon Standards:** Lucide React icons for all buttons and UI elements
- **Color Scheme:** Blue primary, gray secondary, red danger variants
- **Spacing:** Consistent gap and padding using Tailwind classes

### File Organization
- **Core Components:** `/client/src/core/ui/` for reusable UI
- **Plugin Components:** `/client/src/plugins/[name]/components/`
- **Custom Hooks:** `/client/src/hooks/` for reusable logic
- **Type Definitions:** Clear interfaces in component files

## Troubleshooting Patterns (v3)

### Common v3 Patterns
- **Infinite Loops:** Use useCallback to stabilize function references
- **Form Reset:** Use dedicated resetForm function with proper timing
- **Global Functions:** Attach/detach window functions in useEffect cleanup
- **TypeScript Errors:** Check import paths and interface definitions

### Environment Variables
- **Local:** Frontend port 3001, Backend port 3002
- **Vite Config:** Proxy setup for `/api/*` requests
- **Path Aliases:** `@/*` maps to `./client/src/*`

## Current Status Summary

### ✅ Completed (v3)
- **Enterprise Contact Management:** Complete CRUD with business features
- **Professional UX:** Unsaved changes protection, consistent confirmations
- **Clean Architecture:** Reusable components, custom hooks, stable patterns
- **TypeScript Safety:** Complete type definitions and error handling
- **Production Ready:** Code quality suitable for enterprise deployment

### 🎯 Next Priorities
1. **Database Integration:** PostgreSQL + Drizzle ORM implementation
2. **Plugin System:** Refactor existing code into plugin architecture
3. **Additional Plugins:** Calendar, Equipment, Invoice modules

---
*Last Updated: July 2025 - v3 Complete*