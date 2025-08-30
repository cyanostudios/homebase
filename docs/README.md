# Homebase Documentation Index

## Project Overview

Homebase is a revolutionary modular plugin-based business application. The system enables parallel team development with zero conflicts while maintaining enterprise-grade performance and user experience.

**🏗️ ARCHITECTURE:** Complete modular context system (v7+)  
**📊 STATUS:** Proven in development with enterprise-grade functionality  

## KEY ACHIEVEMENTS

- **90% Reduction in Re-renders** - Plugin isolation prevents cascading updates
- **61% Server Code Reduction** - Minimal core with automatic plugin discovery  
- **15-25 Minute Plugin Development** - Standardized templates and patterns
- **Zero Team Conflicts** - Parallel plugin development with complete isolation
- **Enterprise Standards** - Professional UI/UX with modern architecture

## Core Features

- **Universal Keyboard Navigation** - Space + Arrow keys across all plugins
- **Cross-Plugin @Mentions** - Seamless navigation between contacts and notes
- **Mobile-First Design** - Responsive components with conditional rendering
- **Real-Time Validation** - Context-aware error handling and feedback

## COMPLETE DOCUMENTATION MATRIX

### 📚 Development Guides
- **[DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)** - Project architecture, setup, and deployment
- **[PLUGIN_OVERVIEW.md](./PLUGIN_OVERVIEW.md)** - Complete plugin development workflow (15-25 min per plugin)
- **[PLUGIN_OVERVIEW.md](./PLUGIN_OVERVIEW.md)** - Plugin system architecture and performance metrics
- **[BACKEND_PLUGIN_GUIDE.md](./BACKEND_PLUGIN_GUIDE.md)** - Backend plugin development templates and patterns
- **[FRONTEND_PLUGIN_GUIDE.md](./FRONTEND_PLUGIN_GUIDE.md)** - Frontend plugin development with modular contexts

### 🎨 UI/UX Standards
- **[STYLE_GUIDE.md](./STYLE_GUIDE.md)** - Complete UI component patterns and responsive design standards

### 🤖 AI Collaboration & Enforcement
- **[COLLABORATION_GUIDE.md](./COLLABORATION_GUIDE.md)** - Proven patterns for effective AI/Claude collaboration
- **[AI_AGENT_INSTRUCTIONS.md](./AI_AGENT_INSTRUCTIONS.md)** - **CRITICAL: Absolute rules and enforcement for AI development**

### 📋 Documentation Index
- **[docs/README.md](./docs/README.md)** - Documentation overview and project roadmap

## TECH STACK

**Frontend:** React 18 + TypeScript + Vite + Modular Contexts  
**Backend:** Express.js + PostgreSQL + Plugin-loader system  
**Infrastructure:** Node.js with professional development standards  
**Performance:** Sub-second response times with 90% fewer unnecessary re-renders  

## 🚨 ABSOLUTE RULES FOR AI AGENTS

### 1. ZERO GUESSING
- **ASK FOR FILE CONTENTS** before ANY modification
- **ADMIT "I DON'T KNOW"** when uncertain
- **STOP** if guessing required

### 2. CORE FILE PROTECTION
**Production-critical files:** `App.tsx`, `AppContext.tsx`, `pluginRegistry.ts`, `server/plugin-loader.js`, `core/`
- Show exact contents first
- Get explicit confirmation
- Triple-check impact

### 3. TEMPLATE-ONLY DEVELOPMENT
- **USE TEMPLATES** from `templates/` directory for ALL new plugins
- **COPY COMPLETE IMPLEMENTATIONS** - no variations
- **FOLLOW DOCS EXACTLY** - no improvisation

### 4. ONE ACTION PER RESPONSE
Format: "Step X: [Specific action] - What result do you get?"

### 5. MAX 2 ATTEMPTS
- After 2 failed attempts: **ESCALATE**
- Never repeat same failed solution

### 6. SHORT RESPONSES
- Max 3 paragraphs
- One clear action
- Get to the point

### PLUGIN DEVELOPMENT STANDARDS
- Use templates from `templates/` directory - demonstrates ALL patterns
- Follow guides exactly - tested in development
- Copy complete templates - backend/frontend available
- Test each step before proceeding

### MANDATORY READING ORDER
1. **AI_AGENT_INSTRUCTIONS.md** - Absolute rules
2. **COLLABORATION_GUIDE.md** - Systematic workflow  
3. **PLUGIN_OVERVIEW.md** - Implementation patterns
4. **STYLE_GUIDE.md** - Component standards
5. Specific plugin template - Exact code to copy

## PLUGIN ARCHITECTURE

### Backend Structure (5 minutes)
```
plugins/[name]/
├── plugin.config.js    # Plugin metadata and routing
├── model.js           # Database operations (copy from templates)
├── controller.js      # Business logic (copy from templates)
├── routes.js          # Express routes (copy from templates)
└── index.js          # Plugin initialization
```

### Frontend Structure (15-20 minutes)
```
client/src/plugins/[name]/
├── types/[name].ts           # TypeScript interfaces
├── context/[Name]Context.tsx # CRITICAL: Copy template pattern exactly
├── hooks/use[Name].ts        # Plugin-specific hook
├── api/[name]Api.ts          # Isolated API calls
└── components/               # Responsive React components
    ├── [Name]List.tsx        # Mobile-first responsive list
    ├── [Name]Form.tsx        # Validation and form handling
    └── [Name]View.tsx        # Display with cross-plugin support
```

### Integration Requirements
- **Register in pluginRegistry.ts** - Add plugin metadata (plural naming critical)
- **Test keyboard navigation** - Space + Arrow keys must work
- **Verify responsive design** - Mobile/desktop conditional rendering
- **Confirm cross-plugin features** - Don't break existing @mentions or references

## DEVELOPMENT WORKFLOW

### Standard Terminal Setup
```bash
Terminal 1: npx vite --config vite.config.ts    # Frontend dev server
Terminal 2: npm run dev                          # Backend API server
Terminal 3: git, commands, testing              # General commands
```

### Plugin Development Process (Tested Pattern)
1. **Create Backend Plugin** (5 min) - Copy `templates/plugin-backend-template` exactly
2. **Test Backend API** (2 min) - Verify endpoints work with curl
3. **Create Frontend Context** (5 min) - Copy `templates/plugin-frontend-template` pattern exactly
4. **Build UI Components** (8 min) - Copy template List/Form/View patterns
5. **Register Plugin** (3 min) - Add to pluginRegistry.ts with plural naming
6. **Integration Testing** (2 min) - Verify keyboard navigation + responsive design

### Quality Checkpoints
- Backend API responds correctly to all CRUD operations
- Frontend context manages state without breaking other plugins
- UI components are responsive and follow style guide
- Keyboard navigation works (Space + Arrow keys)
- Cross-plugin features preserved (@mentions, references)
- No performance regressions (check re-render behavior)

---

**System Status:** ✅ Complete Modular Architecture Implemented  
**Development Ready:** Templates and patterns proven in development  
**Performance:** 90% fewer re-renders, 61% server code reduction  
**Team Ready:** Zero-conflict parallel development workflow

*Use these standards for efficient, professional development.*