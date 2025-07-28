# Homebase - Enterprise Plugin-Based Business Application

## PROJECT OVERVIEW

Homebase is a production-ready business application with revolutionary modular plugin architecture. The system enables parallel team development with zero conflicts while maintaining enterprise-grade performance and user experience.

**🚀 LIVE PRODUCTION SYSTEM:** [app.beyondmusic.se](https://app.beyondmusic.se)  
**📊 STATUS:** Operational with enterprise-grade functionality  
**🏗️ ARCHITECTURE:** Complete modular context system (v7+)  

## KEY ACHIEVEMENTS

- **90% Reduction in Re-renders** - Plugin isolation prevents cascading updates
- **61% Server Code Reduction** - Minimal core with automatic plugin discovery  
- **15-25 Minute Plugin Development** - Standardized templates and patterns
- **Zero Team Conflicts** - Parallel plugin development with complete isolation
- **Enterprise Production** - Live system with professional UI/UX standards

## CURRENT PLUGIN ECOSYSTEM

### Working Plugins
- **Contacts** ✅ Complete modular context + enhanced responsive UI
- **Notes** ✅ Complete modular context + cross-plugin @mention system
- **Estimates** ✅ Complete modular context + status management workflow + PDF generation

### Core Features
- **Universal Keyboard Navigation** - Space + Arrow keys across all plugins
- **Cross-Plugin @Mentions** - Seamless navigation between contacts and notes
- **Mobile-First Design** - Responsive components with conditional rendering
- **Real-Time Validation** - Context-aware error handling and feedback

## COMPLETE DOCUMENTATION MATRIX

### 📚 Development Guides
- **[DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md)** - Project architecture, setup, and production deployment
- **[PLUGIN_GUIDE.md](./docs/PLUGIN_GUIDE.md)** - Complete plugin development workflow (15-25 min per plugin)
- **[PLUGIN_OVERVIEW.md](./docs/PLUGIN_OVERVIEW.md)** - Plugin system architecture and performance metrics
- **[BACKEND_PLUGIN_GUIDE.md](./docs/BACKEND_PLUGIN_GUIDE.md)** - Backend plugin development templates and patterns
- **[FRONTEND_PLUGIN_GUIDE.md](./docs/FRONTEND_PLUGIN_GUIDE.md)** - Frontend plugin development with modular contexts

### 🎨 UI/UX Standards
- **[STYLE_GUIDE.md](./docs/STYLE_GUIDE.md)** - Complete UI component patterns and responsive design standards

### 🤖 AI Collaboration & Enforcement
- **[COLLABORATION_GUIDE.md](./docs/COLLABORATION_GUIDE.md)** - Proven patterns for effective AI/Claude collaboration
- **[AI_AGENT_INSTRUCTIONS.md](./docs/AI_AGENT_INSTRUCTIONS.md)** - **CRITICAL: Absolute rules and enforcement for AI development**

### 📋 Documentation Index
- **[docs/README.md](./docs/README.md)** - Documentation overview and project roadmap

## TECH STACK

**Frontend:** React 18 + TypeScript + Vite + Modular Contexts  
**Backend:** Express.js + MySQL (prod) / PostgreSQL (dev) + Plugin-loader system  
**Infrastructure:** Node.js 22.16.0 on Inleed Prime 3 hosting  
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
- **USE CONTACTS PLUGIN** as template for ALL new plugins
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
- Use contacts plugin as template - demonstrates ALL patterns
- Follow guides exactly - tested in production
- Copy complete templates - backend/frontend available
- Test each step before proceeding

### MANDATORY READING ORDER
1. **AI_AGENT_INSTRUCTIONS.md** - Absolute rules
2. **COLLABORATION_GUIDE.md** - Systematic workflow  
3. **PLUGIN_GUIDE.md** - Implementation patterns
4. **STYLE_GUIDE.md** - Component standards
5. Specific plugin template - Exact code to copy

## PLUGIN ARCHITECTURE

### Backend Structure (5 minutes)
```
plugins/[name]/
├── plugin.config.js    # Plugin metadata and routing
├── model.js           # Database operations (copy from contacts)
├── controller.js      # Business logic (copy from contacts)
├── routes.js          # Express routes (copy from contacts)
└── index.js          # Plugin initialization
```

### Frontend Structure (15-20 minutes)
```
client/src/plugins/[name]/
├── types/[name].ts           # TypeScript interfaces
├── context/[Name]Context.tsx # CRITICAL: Copy ContactContext pattern exactly
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
1. **Backend Plugin** (5 min) - Copy contacts template from [BACKEND_PLUGIN_GUIDE.md](./docs/BACKEND_PLUGIN_GUIDE.md)
2. **Frontend Context** (5 min) - Copy ContactContext.tsx pattern from [FRONTEND_PLUGIN_GUIDE.md](./docs/FRONTEND_PLUGIN_GUIDE.md)
3. **UI Components** (8 min) - Follow ContactList/Form/View patterns from [STYLE_GUIDE.md](./docs/STYLE_GUIDE.md)
4. **Registration** (5 min) - Add to pluginRegistry.ts following [PLUGIN_GUIDE.md](./docs/PLUGIN_GUIDE.md)
5. **Testing** (2 min) - Verify CRUD operations + keyboard navigation

## CRITICAL NAMING CONVENTIONS

### Context Properties (REQUIRED)
- **Panel state:** `is[Plugin]PanelOpen` (e.g., `isContactsPanelOpen`)
- **Panel mode:** `[plugin]PanelMode` (e.g., `contactsPanelMode`)
- **Current item:** `current[Plugin]Item` (e.g., `currentContactsItem`)

### Global Functions (REQUIRED)
- **Submit function:** `submit[Plugin]sForm` (e.g., `submitContactsForm`) - PLURAL!
- **Cancel function:** `cancel[Plugin]sForm` (e.g., `cancelContactsForm`) - PLURAL!

### Plugin Registry (REQUIRED)
- **Plugin name:** Use plural form (e.g., `'contacts'`, `'notes'`, `'estimates'`)
- **Panel key:** Must match context boolean exactly

## PERFORMANCE CONSIDERATIONS

### Context Isolation Benefits
- Plugin changes only affect that plugin's components
- Other plugins remain completely unaffected
- 90% reduction in unnecessary re-renders achieved
- Parallel team development with zero conflicts

### Mobile-First Requirements
- ALL components must support mobile/desktop conditional rendering
- Use `isMobileView` state with window resize listener
- Desktop: Table layout with sortable headers
- Mobile: Card layout with touch-friendly interactions

## QUALITY ASSURANCE

### Before Making Any Changes
1. **Read the relevant documentation** completely
2. **Ask for current file contents** before modifying
3. **Understand the plugin structure** you're working with
4. **Identify dependencies** that might be affected
5. **Plan changes systematically** - one component at a time

### Testing Requirements
- **CRUD operations** - Create, read, update, delete must all work
- **Keyboard navigation** - Tab through lists, Space to open items
- **Responsive design** - Test mobile and desktop layouts
- **Cross-plugin features** - Ensure @mentions and references work
- **Error handling** - Test validation and network error scenarios

## SUCCESS METRICS

### Architecture Quality
✅ **All existing functionality preserved** after changes  
✅ **Performance improvements measurable** (re-render reduction)  
✅ **Development time reduced** (15-25 minutes per plugin)  
✅ **Zero team conflicts** during parallel development  
✅ **Production stability maintained** throughout development  

### Code Quality  
✅ **Follow established patterns** documented in guides  
✅ **Complete TypeScript coverage** with proper interfaces  
✅ **Mobile-first responsive design** in all components  
✅ **Universal keyboard navigation** support  
✅ **Comprehensive error handling** and validation  

## PRODUCTION ENVIRONMENT

**Database:** MySQL 8.0 with cross-plugin reference tables  
**Authentication:** bcrypt + express-session with role-based access  
**Security:** Production-grade middleware and input validation  
**Performance:** Sub-second response times across all features  
**Monitoring:** Health check endpoint and error logging  

---

## 🔑 AI ASSISTANT REQUIREMENTS

### MANDATORY RESPONSE CHECKS:
1. Do I know current file contents? → Request if NO
2. Following exact template? → Copy contacts plugin if NO  
3. One specific action? → Break down if NO
4. Preserves functionality? → Ask user if UNSURE
5. Under 3 paragraphs? → Shorten if NO

### REQUIRED FORMAT:
```
"Show me complete contents of: [full/path/to/file]
Once I see current implementation, I'll [next action]."
```

### FORBIDDEN:
❌ "Let me update your files..."  
❌ "The problem might be..."  
❌ "This should work"  
❌ Long explanations without actions

### WHEN STUCK (after 2 attempts):
```
"Need to see [specific file/state] for accurate guidance."
```

### STOP IMMEDIATELY IF:
- User says "not working" repeatedly
- Guessing at file contents
- Repeating failed solutions  
- User frustrated with progress

---

**PRODUCTION SYSTEM - Accuracy over helpfulness**  
**Violating rules wastes user time**

*Last Updated: July 28, 2025*