# Homebase

Plugin-based business application platform with modular full-stack architecture.

## 🏠 Overview

Homebase provides a robust foundation for building business applications with a core system that handles essential functionality and a modular plugin architecture for custom features. Perfect for development teams who need to build business apps quickly while maintaining code quality and scalability.

## ✨ Key Features

### Modular Plugin Architecture (v3)
- **Full-Stack Modularity** - Complete separation of frontend/backend plugin concerns
- **Dynamic Plugin Loading** - Automatic discovery and registration of plugins
- **Team Independence** - Multiple teams can develop plugins in parallel
- **Production Ready** - Live deployment at app.beyondmusic.se

### Core System
- **Complete Authentication** - Session management with role-based access control
- **Cross-Plugin References** - Revolutionary @mention system connecting different plugins
- **Mobile-First Design** - Responsive interface across all devices
- **Database Integration** - PostgreSQL (dev) / MySQL (prod) with native queries
- **Production Security** - Enterprise-grade middleware and protection

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (LTS recommended)
- PostgreSQL (local development)
- Git

### Development Setup

1. **Clone and install**
   ```bash
   git clone [repository-url]
   cd homebase
   npm install
   ```

2. **Start development servers**
   ```bash
   # Terminal 1: Frontend (Vite dev server)
   npx vite --config vite.config.ts
   
   # Terminal 2: Backend (Modular plugin system)
   npm run dev
   ```

3. **Access application**
   ```
   Local: http://localhost:3001
   Production: https://app.beyondmusic.se
   Login: admin@homebase.se / admin123
   ```

## 🔧 Tech Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Express.js + Modular Plugin System + CommonJS
- **Database:** PostgreSQL (dev) / MySQL (prod) with native queries
- **Authentication:** bcrypt + express-session + database sessions
- **Security:** Helmet, CORS, compression, input validation
- **Deployment:** Inleed Prime 3 (Node.js 22.16.0)

## 📁 Architecture (v3)

### Modular Backend Structure
```
plugins/[plugin-name]/
├── plugin.config.js         # Plugin metadata
├── model.js                 # Database operations
├── controller.js            # Business logic
├── routes.js                # API endpoints
└── index.js                 # Plugin initialization

plugin-loader.js             # Dynamic plugin loading system
server/index.ts              # Main server (187 lines vs 486 before)
```

### Frontend Structure
```
client/src/
├── core/
│   ├── ui/                  # Universal components
│   └── api/                 # AppContext with database integration
├── plugins/
│   ├── contacts/            # Contact management plugin
│   └── notes/               # Notes with @mention system
├── hooks/                   # Custom React hooks
└── utils/                   # Helper functions
```

## 🎯 Current Status (v6 + Modular v3)

### ✅ Production Live
- **Live System:** https://app.beyondmusic.se
- **Complete Authentication:** Login/logout with session management
- **Plugin System:** Contacts + Notes with cross-plugin @mentions
- **Mobile Interface:** Responsive design verified on live domain
- **Database:** MySQL backend fully operational
- **API Endpoints:** All CRUD operations tested and working

### ✅ Modular Architecture
- **Backend Refactored:** 61% code reduction (486 → 187 lines)
- **Dynamic Plugin Loading:** Automatic discovery and registration
- **Contacts Plugin:** Complete CRUD with business features
- **Notes Plugin:** @mention system with cross-plugin references
- **Plugin Templates:** Ready for rapid new plugin development

## 🔌 Plugin Development

### Create New Plugin (5-10 minutes)

1. **Backend Plugin**
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
   npm run dev
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
- **[docs/PLUGIN_GUIDE_V3.md](./docs/PLUGIN_GUIDE_V3.md)** - ⭐ Current modular plugin guide
- **[docs/DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md)** - 🏗️ Project overview & setup
- **[docs/Claude_Development_Guide.md](./docs/Claude_Development_Guide.md)** - 🤖 AI collaboration patterns
- **[docs/PROJECT_HANDOVER_V6.md](./docs/PROJECT_HANDOVER_V6.md)** - 🚀 Production deployment

## 🛠 Available Commands

```bash
# Development
npm run dev                          # Backend with plugin system
npx vite --config vite.config.ts     # Frontend development server

# Testing
curl http://localhost:3002/api/health     # Check plugin loading
curl http://localhost:3002/api/plugins    # List loaded plugins

# Production
# System runs at https://app.beyondmusic.se
```

## 🚀 Deployment Status

### Production Environment ✅
- **Domain:** app.beyondmusic.se (HTTPS enabled)
- **Server:** Inleed Prime 3 (Node.js 22.16.0)
- **Database:** MySQL with session store
- **Authentication:** Complete user management
- **File Sync:** Local ↔ Production synchronized
- **Monitoring:** Health endpoints + error logging

### Development Environment ✅
- **Frontend:** Vite dev server (port 3001)
- **Backend:** Express with plugin-loader (port 3002)
- **Database:** PostgreSQL local development
- **Hot Reload:** Both frontend and backend
- **Testing:** Complete API testing suite

## 📈 Achievements

### Technical Excellence
- **Modular Architecture:** 61% server code reduction
- **Production Deployment:** Complete development-to-live pipeline
- **Plugin System:** Dynamic loading with automatic registration
- **Cross-Plugin Integration:** Revolutionary @mention system
- **Mobile-First Design:** Verified responsive across devices
- **Security Implementation:** Production-grade protection

### Business Value
- **Rapid Development:** New plugins in 5-10 minutes
- **Team Scalability:** Independent plugin development
- **Customer Ready:** Multi-user authentication and access control
- **Cost Effective:** Efficient hosting with proven performance
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
1. **Production Optimization** - Resolve any remaining issues
2. **Data Import System** - Plugin-specific import strategies
3. **Plugin Expansion** - Invoice, Projects, Equipment modules

### Future Enhancement
1. **Multi-tenant Architecture** - Customer-specific installations
2. **Advanced Features** - Admin dashboard, external auth, analytics
3. **Mobile Application** - React Native using live API

## 📞 Support

### Production Access
- **Live System:** https://app.beyondmusic.se
- **Login:** admin@homebase.se / admin123
- **API Health:** https://app.beyondmusic.se/api/health

### Development Support
- **Documentation:** [docs/README.md](./docs/README.md)
- **Plugin Guide:** [docs/PLUGIN_GUIDE_V3.md](./docs/PLUGIN_GUIDE_V3.md)
- **Local Frontend:** http://localhost:3001
- **Local Backend:** http://localhost:3002

---

**Status:** ✅ Production Live + Modular Architecture Implemented  
**Last Updated:** July 19, 2025  
**Built with ❤️ by the development team**