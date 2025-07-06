# Homebase

A plugin-based business application template for rapid development of custom business solutions.

## 🏠 Overview

Homebase provides a robust foundation for building business applications with a core system that handles essential functionality and a plugin architecture for custom features. Perfect for development teams who need to build business apps quickly while maintaining code quality and scalability.

## ✨ Features

### Core System (v3)
- **Enterprise Contact Management** - Complete CRUD operations with advanced business features
- **Professional UX Patterns** - Unsaved changes protection, consistent confirmation dialogs
- **Comprehensive Validation** - Field-level validation with duplicate prevention
- **Database Layer** - PostgreSQL with Drizzle ORM, works locally and in production
- **API Foundation** - RESTful APIs with plugin integration hooks
- **UI Component Library** - Reusable React components (UniversalPanel, ConfirmDialog, Button standards)

### Plugin Architecture
- **Independent Development** - Teams can build plugins without touching core
- **Standardized Integration** - All plugins follow established v3 patterns
- **Database Isolation** - Plugin data is properly namespaced
- **Hot-Pluggable** - Enable/disable features via configuration

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (LTS recommended)
- Docker (for local PostgreSQL - planned)
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

3. **Start development servers**
   ```bash
   # Terminal 1: Frontend (Vite dev server)
   npx vite --config vite.config.ts
   
   # Terminal 2: Backend (Express server)
   npx tsx server/index.ts
   ```

4. **Open in browser**
   ```
   http://localhost:3001
   ```

## 🔧 Tech Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + Lucide React icons
- **Backend:** Express.js + TypeScript
- **Database:** PostgreSQL + Drizzle ORM (planned)
- **State Management:** React Context + Custom Hooks (useUnsavedChanges)
- **Development:** Cursor IDE with AI assistance (GPT-4.1, Gemini, Claude)
- **Deployment:** Cloudways (planned) + Local development

## 📁 Project Structure (v3)

```
/client/src/
  ├── core/
  │   ├── ui/              # UniversalPanel, ConfirmDialog, Button, Typography
  │   └── api/             # AppContext, global state management
  ├── plugins/
  │   └── contacts/
  │       └── components/  # ContactList, ContactForm
  ├── hooks/               # useUnsavedChanges, custom hooks
  ├── lib/                 # Utilities
  └── utils/               # Helper functions

/server/
  ├── core/                # Core server functionality
  └── plugins/             # Plugin-specific API routes

/shared/                   # Types/schemas shared between client/server
/preservation/             # Backup of working components from v1
```

## 🎯 Current Status (v3)

### ✅ Completed Features
- **Enterprise Contact Management**
  - Company/Private person toggle with conditional fields
  - Repeatable contact persons and addresses
  - Tax & business settings (F-Tax, payment terms, etc.)
  - Comprehensive notes and contact details
  
- **Professional UX Features**
  - Unsaved changes protection with warning dialogs
  - Consistent ConfirmDialog for dangerous actions (delete, etc.)
  - Form reset functionality in create mode
  - Field-level validation with error highlighting
  
- **Technical Excellence**
  - useCallback optimizations preventing infinite loops
  - Custom useUnsavedChanges hook for form state management
  - TypeScript interfaces for all components and data structures
  - Reusable UI components following design standards

### 🔄 Next Phase: Database Integration
- PostgreSQL + Drizzle ORM implementation
- Persistent data storage
- Production-ready data layer

## 🔌 Plugin Development

### Established v3 Patterns

#### Form Components
```typescript
// Use useUnsavedChanges hook for form state management
const { isDirty, showWarning, markDirty, markClean, attemptAction, confirmDiscard, cancelDiscard } = useUnsavedChanges();

// Stabilize handlers with useCallback to prevent loops
const handleSubmit = useCallback(() => {
  // handler logic
}, [dependencies]);

// Global window functions for cross-component communication
useEffect(() => {
  window.submitForm = handleSubmit;
  window.cancelForm = handleCancel;
  return () => {
    delete window.submitForm;
    delete window.cancelForm;
  };
}, [handleSubmit, handleCancel]);
```

#### UI Components
```typescript
// Use established component patterns
<UniversalPanel>       // 672px-wide right panel with header/footer
<ConfirmDialog>        // Consistent confirmation dialogs
<Button variant="primary" icon={Plus}>  // Standardized buttons with Lucide icons
<Card padding="md">    // Content containers
```

### Plugin Guidelines

- ✅ **DO:** Follow v3 UX patterns (unsaved changes, confirmations)
- ✅ **DO:** Use established UI components (UniversalPanel, ConfirmDialog)
- ✅ **DO:** Implement useCallback for function stability
- ✅ **DO:** Use TypeScript interfaces for type safety

- ❌ **DON'T:** Modify core system files
- ❌ **DON'T:** Create direct dependencies between plugins
- ❌ **DON'T:** Bypass established validation patterns

## 🚀 Deployment

### Current Configuration
- **Frontend:** Vite dev server on port 3001
- **Backend:** Express server on port 3002
- **Proxy:** Vite proxies `/api/*` requests to backend
- **Hot Reload:** Both frontend and backend support live reloading

### Environment Variables

**Local (.env.local):**
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/homebase
PORT=3001
NODE_ENV=development
```

**Production (Cloudways - planned):**
```
DATABASE_URL=<production-db-url>
PORT=<production-port>
NODE_ENV=production
```

## 📖 Documentation

- **[Development Guide](./DEV_GUIDE.md)** - Complete v3 development instructions and patterns
- **[Project Handover](./PROJECT_HANDOVER.md)** - v3 milestone summary and next steps
- **[Plugin API Docs](./docs/plugin-api.md)** - Plugin development reference *(coming soon)*

## 🔄 Development Workflow (v3)

### Established Patterns
- **Three Terminal Setup:**
  - Terminal 1: `npx vite --config vite.config.ts` (frontend)
  - Terminal 2: `npx tsx server/index.ts` (backend)  
  - Terminal 3: Commands (git, file operations, curl tests)

- **AI-Assisted Development:**
  - Cursor IDE with GPT-4.1, Gemini agents (use sparingly)
  - Claude for planning, step-by-step guidance, architecture decisions
  - Direct commands only - minimal explanations
  - Code artifacts for longer files requiring manual copy/paste

### Core Development (Current)
- Work in `fresh-start-v3` branch
- Focus on database integration and plugin extraction
- All changes follow established v3 patterns

### Future Plugin Development
- Create feature branches: `feature/plugin-name`
- Independent team development using v3 patterns
- Merge to main after following established testing procedures

## 🛠 Available Commands

```bash
# Development
npm run dev              # Start both frontend and backend
npx vite --config vite.config.ts    # Frontend only (Terminal 1)
npx tsx server/index.ts             # Backend only (Terminal 2)

# Database (Planned)
npx drizzle-kit push    # Apply schema changes
npx drizzle-kit studio  # Database browser

# Git
git add .
git commit -m "Descriptive commit message"
git push origin fresh-start-v3
```

## 🤝 Contributing

### v3 Code Standards
- **Clean Code:** No code bloat, thoughtful changes only
- **TypeScript:** Complete type safety with proper interfaces
- **React Patterns:** Functional components with hooks, useCallback for stability
- **UI Consistency:** Follow Button, Card, UniversalPanel design standards
- **Error Handling:** Use ConfirmDialog and validation patterns

### AI Assistant Guidelines
- **Direct Communication:** "Write this in terminal 1" format
- **Code Artifacts:** Use for longer files requiring manual copy/paste
- **Established Patterns:** Follow v3 UX and component patterns
- **Testing:** Test each step before proceeding to next

## 📋 Roadmap

### ✅ Phase 1: Core Foundation (v3 COMPLETE)
- [x] Complete enterprise contact management system
- [x] Professional UX patterns (unsaved changes, confirmations)
- [x] Comprehensive validation framework
- [x] Reusable UI component library
- [x] Stable React patterns with useCallback optimizations

### 🔄 Phase 2: Database Integration (CURRENT)
- [ ] PostgreSQL + Drizzle ORM implementation
- [ ] Persistent data storage for contacts
- [ ] Environment-agnostic database connections
- [ ] Migration system for schema changes

### 🎯 Phase 3: Plugin Architecture
- [ ] Refactor existing features into plugin pattern
- [ ] Plugin registration and management system
- [ ] Standardized plugin development API
- [ ] Plugin isolation and testing framework

### 🚀 Phase 4: Additional Plugins
- [ ] Invoice management plugin
- [ ] Calendar/Equipment plugins
- [ ] Reporting and analytics plugins
- [ ] Custom business logic plugins

## 📄 License

Internal use only - Cyanostudios

## 📞 Support

For questions about Homebase development:
- Check the [Development Guide](./DEV_GUIDE.md) for v3 patterns
- Review established component and UX patterns
- Use Cursor IDE with Claude for architectural guidance

---

**Built with ❤️ by the Cyanostudios team**
*Current Status: v3 Enterprise Contact Management Complete*