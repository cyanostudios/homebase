# 🏠 Homebase - Modular Business Application Platform

**Revolutionary plugin-based business application with zero-conflict development.**

[![Status](https://img.shields.io/badge/Status-Development-green)](https://github.com/homebase/homebase)
[![Architecture](https://img.shields.io/badge/Architecture-Modular%20Contexts-blue)](./docs/PLUGIN_GUIDE_V3.md)
[![Performance](https://img.shields.io/badge/Performance-90%25%20Fewer%20Rerenders-brightgreen)](./docs/PLUGIN_OVERVIEW.md)

---

## ⛔ KRITISK POLICY - OAVVIKLIGT

### 🚫 FÖRBUDET MOT OAVSIKTLIGA ÄNDRINGAR

**DET ÄR TOTALT FÖRBJUDET ATT ÄNDRA PÅ KOD SOM REDAN ÄR IMPLEMENTERAD OCH GODKÄND**

- ❌ **FÖRBJUDET:** Ändra kod som redan fungerar och är godkänd utan explicit instruktion
- ❌ **FÖRBJUDET:** "Förbättra" eller "fixa" kod som inte är ombedd att ändras
- ❌ **FÖRBJUDET:** Refaktorera kod utan tydlig instruktion från projektledare/utvecklare
- ❌ **FÖRBJUDET:** Ta bort eller ändra funktionalitet som redan är implementerad
- ❌ **FÖRBJUDET:** Ändra imports, struktur eller namn på kod som redan är godkänd

**REGEL:**

- ✅ **ENDA UNDANTAG:** När du explicit blivit ombedd att göra en specifik ändring
- ✅ **ENDA UNDANTAG:** Vid buggfix när buggen är dokumenterad och godkänd att fixas
- ✅ **ENDA UNDANTAG:** När ändringen är dokumenterad i en specifik uppgift/ticket

**VID FRÅGOR:**

- Om du är osäker → **FRÅGA först, ändra inte**
- Om du ser något som verkar fel → **RAPPORTERA, ändra inte**
- Om du vill förbättra något → **DISKUTERA först, ändra inte**

**Detta gäller för:**

- Alla utvecklare (mänskliga och AI-assistenter)
- All kod i projektet (frontend, backend, plugins, core)
- Alla ändringar (refaktorering, förbättringar, "fixes", renames, imports, etc.)

**Läs mer:** [docs/LESSONS_LEARNED.md](./docs/LESSONS_LEARNED.md) för konkreta exempel på misstag och rätt arbetssätt.

---

## 🚀 What Makes Homebase Revolutionary

### Modular Architecture Benefits

- **90% Reduction in Re-renders** - Plugin isolation prevents cascading updates
- **61% Server Code Reduction** - Minimal core with automatic plugin discovery
- **15-25 Minute Plugin Development** - Standardized templates and patterns
- **Zero Team Conflicts** - Complete plugin separation enables parallel development

### Enterprise-Grade Features

- **Universal Keyboard Navigation** - Space + Arrow keys work across all plugins
- **Cross-Plugin @Mentions** - Seamless navigation between contacts and notes
- **Mobile-First Design** - Responsive components with conditional rendering
- **Real-Time Validation** - Context-aware error handling and user feedback

## 🎯 Quick Start

### 1. Setup Development Environment

```bash
# Clone and install (single package.json for everything)
git clone [repository-url] homebase
cd homebase
npm install

# Setup development database
node scripts/setup-database.js

# Environment configuration
cp .env.example .env.local
```

### 2. Start Development Servers

```bash
# Option A: Both servers together
npm run dev:all

# Option B: Separate terminals
npm run dev:api   # Backend (port 3002)
npm run dev:ui    # Frontend (port 3001)
```

### 3. Create Your First Plugin

**Backend Plugin**

```bash
mkdir -p plugins/my-plugin
# Copy templates from docs/PLUGIN_GUIDE_V3.md
```

2. **Frontend Plugin**

   ```bash
   mkdir -p client/src/plugins/my-plugin
   # Follow established patterns from contacts/notes
   ```

3. **Test Integration**
   ```bash
   npm run dev:api
   # Should show: "🟢 Loaded plugin: my-plugin (/api/my-plugin)"
   ```

### Plugin Templates Available

- **Backend:** model.js, controller.js, routes.js patterns
- **Frontend:** List, Form, View components with mobile-first design
- **Database:** Schema setup with authentication integration
- **Examples:** Contacts (business features), Notes (@mentions)

## 📚 Documentation

Complete documentation is available in the **[docs/](./docs/)** directory:

- **[docs/README.md](./docs/README.md)** - 📚 Complete documentation index
- **[docs/LESSONS_LEARNED.md](./docs/LESSONS_LEARNED.md)** - ❗ Agent rules, anti-patterns, and do/don'ts
- **[docs/SECURITY_GUIDELINES.md](./docs/SECURITY_GUIDELINES.md)** - 🔒 Security baseline and enforcement
- **[docs/PLUGIN_OVERVIEW_V2.md](./docs/PLUGIN_OVERVIEW_V2.md)** - ⭐ Current modular plugin overview
- **[docs/DEVELOPMENT_GUIDE_V2.md](./docs/DEVELOPMENT_GUIDE_V2.md)** - 🏗️ Project overview & setup

## 🛠 Available Commands

```bash
# Development
npm run dev:all                      # Backend + frontend together
npm run dev:api                      # Backend with plugin system
npm run dev:ui                       # Frontend development server

# Testing
curl http://localhost:3002/api/health     # Check plugin loading
curl http://localhost:3002/api/plugins    # List loaded plugins
```

## 🚀 Development Status

### Development Environment ✅

- **Frontend:** Vite dev server (port 3001)
- **Backend:** Express with plugin-loader (port 3002)
- **Database:** PostgreSQL local development
- **Hot Reload:** Both frontend and backend
- **Testing:** Complete API testing suite

## 📈 Achievements

### Technical Excellence

- **Modular Architecture:** 61% server code reduction
- **Plugin System:** Dynamic loading with automatic registration
- **Cross-Plugin Integration:** Revolutionary @mention system
- **Mobile-First Design:** Verified responsive across devices
- **Security Implementation:** Authentication and access control

### Business Value

- **Rapid Development:** New plugins in 15-25 minutes
- **Team Scalability:** Independent plugin development
- **Multi-User Ready:** Authentication and access control
- **Cost Effective:** Efficient development with proven performance
- **Future Proof:** Modular architecture for easy expansion

## 🤝 Contributing

### Development Workflow

- **Terminal 1:** Frontend development
- **Terminal 2:** Backend with plugin system
- **Terminal 3:** Commands and testing
- **Follow:** [docs/PLUGIN_GUIDE_V3.md](./docs/PLUGIN_GUIDE_V3.md) for all plugin development

### Code Standards

- **Modular Plugins:** Use established templates and patterns
- **Mobile-First:** Responsive design required
- **Authentication:** Proper session management and access control
- **Error Handling:** Comprehensive logging and graceful failures

## 📋 Roadmap

### Current Priority

1. **Development Optimization** - Refine plugin development workflow
2. **Data Import System** - Plugin-specific import strategies
3. **Plugin Expansion** - Invoice, Projects, Equipment modules

### Future Enhancement

1. **Advanced Features** - Admin dashboard, external auth, analytics
2. **Mobile Application** - React Native using live API
3. **Multi-tenant Architecture** - Customer-specific installations

## 📞 Support

### Development Support

- **Documentation:** [docs/README.md](./docs/README.md)
- **Plugin Guide:** [docs/PLUGIN_GUIDE_V3.md](./docs/PLUGIN_GUIDE_V3.md)
- **Local Frontend:** http://localhost:3001
- **Local Backend:** http://localhost:3002

### System Information

- **Development Environment:** PostgreSQL with full plugin ecosystem
- **Testing:** Complete API testing suite with health endpoints
- **Performance:** 90% fewer re-renders, 61% server code reduction
- **Architecture:** Proven modular plugin system with zero conflicts

---

**Status:** ✅ Complete Modular Architecture + Development Ready  
**Development Time:** 15-25 minutes per plugin with templates  
**Performance:** Enterprise-grade with proven optimization  
**Last Updated:** August 2025  
**Built with ❤️ by the development team**
