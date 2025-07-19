# Homebase Documentation

Complete documentation for the Homebase plugin-based business application platform.

## 📋 Documentation Overview

### Core Development Guides

#### [PLUGIN_GUIDE_V3.md](./PLUGIN_GUIDE_V3.md) ⭐ **CURRENT**
**Full-Stack Modular Plugin Architecture**
- Complete modular backend plugin system with plugin-loader
- Frontend plugin patterns with responsive design
- Production-ready examples (contacts, notes)
- 61% server code reduction (486 → 187 lines)
- Step-by-step plugin creation workflow
- **Status:** ✅ Implemented & Tested (July 19, 2025)

#### [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)
**Project Overview & AI Instructions**
- Complete project architecture and status (v5 → v6)
- Tech stack: React + TypeScript + Express + PostgreSQL/MySQL
- Authentication system and plugin access control
- Mobile-first design patterns
- AI collaboration guidelines for Cursor development
- **Status:** ✅ Production Ready (v6)

#### [Claude_Development_Guide.md](./Claude_Development_Guide.md)
**Effective Technical Collaboration Patterns**
- Proven methodologies for AI-assisted development
- Step-by-step troubleshooting workflows
- Communication patterns and anti-patterns
- Based on successful v6 production deployment
- **Status:** ✅ Established Best Practices

### Project Status & Deployment

#### [PROJECT_HANDOVER_V6.md](./PROJECT_HANDOVER_V6.md)
**Final Production Deployment Documentation**
- Complete v6 production deployment on app.beyondmusic.se
- MySQL conversion and live domain configuration
- Production security implementation
- File synchronization and backup strategies
- Business value delivered and technical achievements
- **Status:** ✅ Live Production System

### Legacy Documentation

#### [PLUGIN_GUIDE.md](./PLUGIN_GUIDE.md)
**Plugin Development Guide v5**
- Original plugin patterns with database integration
- Cross-plugin @mention system implementation
- Mobile-first responsive design
- **Status:** 📚 Reference (Superseded by v3)

#### [PLUGIN_GUIDE_V2.md](./PLUGIN_GUIDE_V2.md)
**Plugin Architecture Guide v2**
- Early modular plugin concepts
- Backend organization principles
- **Status:** 📚 Reference (Superseded by v3)

## 🚀 Quick Start

### For New Developers
1. Start with **[DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)** - Understand the project
2. Read **[PLUGIN_GUIDE_V3.md](./PLUGIN_GUIDE_V3.md)** - Learn the current architecture
3. Follow **[Claude_Development_Guide.md](./Claude_Development_Guide.md)** - Development workflow

### For Plugin Development
1. **[PLUGIN_GUIDE_V3.md](./PLUGIN_GUIDE_V3.md)** - Complete plugin creation guide
2. Use contacts/notes as reference implementations
3. Follow the modular backend + frontend patterns

### For Production Deployment
1. **[PROJECT_HANDOVER_V6.md](./PROJECT_HANDOVER_V6.md)** - Production setup
2. **[DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)** - Environment configuration

## 🏗️ Architecture Summary

### Current State (v6 + Modular Plugins)
```
Production: app.beyondmusic.se ✅ Live
Backend: Modular plugin system with plugin-loader
Frontend: React + TypeScript with responsive design
Database: MySQL (production) / PostgreSQL (development)
Plugins: Contacts, Notes with @mention system
Authentication: Complete session management
Security: Production-grade middleware
```

### Plugin Architecture (v3)
```
plugins/[name]/
├── plugin.config.js    # Configuration
├── model.js           # Database operations
├── controller.js      # Business logic
├── routes.js          # API endpoints
└── index.js           # Plugin initialization

client/src/plugins/[name]/
├── types/             # TypeScript interfaces
└── components/        # React components (List, Form, View)
```

## 📊 Project Metrics

- **Server Code Reduction:** 486 → 187 lines (61% less)
- **Plugin System:** Fully modular with dynamic loading
- **Production Uptime:** ✅ Live and operational
- **Authentication:** Complete user management
- **Mobile Support:** Responsive design across all components
- **Cross-Plugin References:** @mention system operational

## 🔧 Development Workflow

### Standard Terminal Setup
- **Terminal 1:** Frontend (`npx vite --config vite.config.ts`)
- **Terminal 2:** Backend (`npm run dev`)
- **Terminal 3:** Commands and testing

### Plugin Development Cycle
1. **Backend Plugin** (5-10 min) - Create modular plugin files
2. **Frontend Plugin** (15-20 min) - Build React components
3. **Integration Test** (5 min) - Verify full CRUD functionality

## 📈 Version History

| Version | Date | Major Changes | Status |
|---------|------|---------------|---------|
| v6 | July 2025 | Production deployment, MySQL conversion | ✅ Live |
| v5 | June 2025 | Complete authentication, @mentions | ✅ Complete |
| v3 (Plugins) | July 19, 2025 | Modular backend architecture | ✅ Implemented |
| v2 (Plugins) | Early 2025 | Plugin concepts | 📚 Reference |
| v1 | 2024 | Initial development | 📚 Archived |

## 🎯 Current Priorities

1. **Production Optimization** - Resolve any remaining save functionality issues
2. **Data Import System** - Plugin-specific import strategies
3. **Plugin Expansion** - Invoice, Projects, Equipment modules
4. **Multi-tenant Architecture** - Customer-specific installations

## 🤝 Contributing

### For AI Development (Claude/Cursor)
- Follow **[Claude_Development_Guide.md](./Claude_Development_Guide.md)** patterns
- Use step-by-step methodology
- Prioritize honesty over helpfulness
- Test each change incrementally

### For Human Developers
- Reference **[PLUGIN_GUIDE_V3.md](./PLUGIN_GUIDE_V3.md)** for all new plugins
- Maintain mobile-first responsive design
- Follow established authentication patterns
- Implement proper error handling

## 📞 Support

### Production Issues
- **Live System:** app.beyondmusic.se
- **Login:** admin@homebase.se / admin123
- **Health Check:** `curl https://app.beyondmusic.se/api/health`

### Development Environment
- **Local Frontend:** http://localhost:3001
- **Local Backend:** http://localhost:3002
- **Database:** PostgreSQL (dev) / MySQL (prod)

---

**Last Updated:** July 19, 2025  
**Documentation Status:** ✅ Complete and Current  
**Production Status:** ✅ Live and Operational