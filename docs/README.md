# Homebase Documentation Index

## Project Overview

Homebase is a modular plugin-based platform with service abstraction architecture. The system enables parallel team development with zero conflicts while maintaining enterprise-grade security and performance.
🏗️ ARCHITECTURE: Service abstraction with automated plugin integration
📊 STATUS: Production-ready with security enforcement
KEY ACHIEVEMENTS

Service Abstraction - Infrastructure swappable via configuration
Security By Default - Multiple layers of enforcement
90% Reduction in Re-renders - Plugin isolation prevents cascading updates
Zero Manual Core Updates - Automated plugin integration
Testing Simplified - Mock adapters for fast unit tests
Deployment Flexible - Same code, different infrastructure

Core Features

Universal Keyboard Navigation - Space + Arrow keys across all plugins
Cross-Plugin References - Seamless navigation between plugins (@mentions, assignments)
Mobile-First Design - Responsive components with conditional rendering
Multi-Tenant Isolation - Automatic tenant filtering at core level
CSRF Protection - Required on all state-changing operations
Rate Limiting - Configurable per endpoint
Audit Logging - Built-in for all operations

📚 COMPLETE DOCUMENTATION
🎯 Core Architecture & Services
Start here for system understanding:

CORE_SERVICES_ARCHITECTURE.md

Service abstraction principles
Adapter pattern implementation
All core services (Database, Storage, Email, Queue, Cache, Realtime, Search, Logging)
Configuration-driven architecture
Extension points

CORE_ARCHITECTURE_V2.md

Plugin registry system
AppContext integration
Panel coordination
Cross-plugin features
Performance optimizations

ARCHITECTURE_REFACTOR.md

Core + plugins refactor summary
Provider switching and SDK overview
Entry point and route extraction

SECURITY_GUIDELINES.md

Security layers (middleware, adapter, plugin, database)
Authentication & authorization
Input validation patterns
CSRF protection
Rate limiting
Audit logging
Common vulnerabilities & prevention

🔧 Plugin Development Guides
Follow these for building plugins:

PLUGIN_OVERVIEW_V2.md

Quick start workflow
Automated benefits
Critical requirements
Common patterns
Testing strategy
Success checklist

PLUGIN_DEVELOPMENT_STANDARDS_V2.md

MANDATORY naming conventions
Context implementation pattern
Backend integration with core services
Security requirements
Component props patterns
Testing requirements

BACKEND_PLUGIN_GUIDE_V2.md

Backend development with ServiceManager
Model layer using core services
Controller with security & validation
Routes with security middleware
Advanced patterns (file upload, email, queues, caching)
Testing with mock adapters

FRONTEND_PLUGIN_GUIDE_V2.md

Frontend development with CSRF
API layer with security
Context implementation
Component patterns (List, Form, View)
Security best practices
Testing

REFACTORING_EXISTING_PLUGINS.md

Migration from direct calls to core services
Adding security layers
Plugin-specific refactoring (contacts, notes, tasks, estimates)
Files plugin critical updates
Testing refactored plugins
Deployment checklist

🎨 UI/UX & Layout

LAYOUT_REFACTORING_V2.md

3-column layout rationale
Sidebar + list + detail patterns
Grouped list patterns
Scroll behavior and layout constraints

💡 Lessons Learned & Troubleshooting

LESSONS_LEARNED.md

Common mistakes and how to avoid them
Database SDK pitfalls
Layout & UI patterns
API & Context issues
Development workflow tips
Plugin development anti-patterns

🚀 Development & Deployment

DEVELOPMENT_GUIDE_V2.md

Project structure
Environment setup
Service configuration
Plugin development workflow
Database management
Testing
Deployment
Performance optimization
Monitoring
Troubleshooting (see LESSONS_LEARNED.md)

🤖 AI & Agent Rules

LESSONS_LEARNED.md

Agent rules and anti-patterns
No guessing, no looping, follow explicit instructions
Common mistakes and fixes

📋 Migration & Integration

MIGRATION_GUIDE_V1_TO_V2.md (legacy examples)

Migration steps and breaking changes (legacy)
Current migration flow: REFACTORING_EXISTING_PLUGINS.md
Service abstraction requirements
Security enforcement checklist

🗺️ Documentation Roadmap

For New Developers

Understanding the system:

- Read CORE_SERVICES_ARCHITECTURE.md - Understand service abstraction
- Read CORE_ARCHITECTURE_V2.md - Understand plugin system
- Read SECURITY_GUIDELINES.md - Understand security layers

Development setup:

- Read DEVELOPMENT_GUIDE_V2.md - Setup environment
- Run existing plugins locally
- Explore codebase with understanding

Building your first plugin:

- Read PLUGIN_OVERVIEW_V2.md - Quick start
- Read PLUGIN_DEVELOPMENT_STANDARDS_V2.md - Conventions
- Read BACKEND_PLUGIN_GUIDE_V2.md - Backend implementation
- Read FRONTEND_PLUGIN_GUIDE_V2.md - Frontend implementation
- Build simple CRUD plugin following guides

For AI Agents/LLMs
Mandatory reading order:

CORE_SERVICES_ARCHITECTURE.md - Service abstraction
SECURITY_GUIDELINES.md - Security requirements
PLUGIN_DEVELOPMENT_STANDARDS_V2.md - Naming conventions
BACKEND_PLUGIN_GUIDE_V2.md - Backend patterns
FRONTEND_PLUGIN_GUIDE_V2.md - Frontend patterns
LAYOUT_REFACTORING_V2.md - UI patterns
LESSONS_LEARNED.md - Agent rules and anti-patterns

For specific tasks:

Building new plugin: PLUGIN_OVERVIEW_V2.md → Specific guides
Refactoring existing: REFACTORING_EXISTING_PLUGINS.md
Security review: SECURITY_GUIDELINES.md
Debugging and common mistakes: LESSONS_LEARNED.md

For Refactoring Existing Code
Existing plugins (contacts, notes, tasks, estimates):

Read REFACTORING_EXISTING_PLUGINS.md - Migration strategy
Read CORE_SERVICES_ARCHITECTURE.md - Service usage
Read SECURITY_GUIDELINES.md - Security additions
Refactor one plugin at a time
Test thoroughly before moving to next

🛠️ TECH STACK
Frontend: React 18 + TypeScript + Vite + Modular Contexts
Backend: Express.js + PostgreSQL + ServiceManager
Infrastructure: Configurable via config/services.js
Security: Multi-layer enforcement (middleware + adapters + business logic)
Performance: Sub-second response times with 90% fewer re-renders

⚙️ Service Configuration
Development (default):
DATABASE_PROVIDER: 'postgres' // Local PostgreSQL
STORAGE_PROVIDER: 'local' // Local filesystem
EMAIL_PROVIDER: 'smtp' // Local SMTP
QUEUE_PROVIDER: 'memory' // In-memory queue
CACHE_PROVIDER: 'memory' // In-memory cache
Production (example):
DATABASE_PROVIDER: 'neon' // Neon PostgreSQL
STORAGE_PROVIDER: 'r2' // Cloudflare R2
EMAIL_PROVIDER: 'resend' // Resend API
QUEUE_PROVIDER: 'bullmq' // Redis-backed queue
CACHE_PROVIDER: 'redis' // Redis cache
Change providers: Update config/services.js + environment variables → No code changes needed

🚨 CRITICAL RULES FOR DEVELOPMENT

1. ALWAYS Use Core Services
   // ✅ CORRECT
   const database = ServiceManager.get('database');
   const storage = ServiceManager.get('storage');
   const logger = ServiceManager.get('logger');

// ❌ WRONG
const db = require('../../server/database');
const fs = require('fs');
console.log('...'); 2. ALWAYS Include Security Middleware
// ✅ CORRECT
router.post('/', requirePlugin('my-plugin'), csrfProtection, [validation], controller.create);

// ❌ WRONG
router.post('/', controller.create); 3. ALWAYS Validate User Input
// ✅ CORRECT
body('title').trim().notEmpty().isLength({ max: 255 }).escape()

// ❌ WRONG
// No validation 4. ALWAYS Handle Errors Properly
// ✅ CORRECT
try {
await database.query(...);
} catch (error) {
logger.error('Operation failed', error, { context });
throw new AppError('User-friendly message', 500, 'ERROR_CODE');
}

// ❌ WRONG
await database.query(...); // No error handling 5. ALWAYS Include CSRF Token (Frontend)
// ✅ CORRECT
headers: { 'X-CSRF-Token': await this.getCsrfToken() }

// ❌ WRONG
// No CSRF token

📊 Architecture Benefits
Service Abstraction

Infrastructure swappable - Change providers via config
Testing simplified - Mock adapters for unit tests
Vendor independence - No lock-in to specific providers
Cost optimization - Choose providers based on needs

Plugin Isolation

Zero conflicts - Plugins don't interfere
Parallel development - Teams work independently
Performance - Only affected components re-render
Scalability - Add plugins without core changes

Security By Default

Multiple layers - Middleware, adapters, business logic
Automatic enforcement - Can't bypass security
Standardized - Same patterns across all plugins
Audit trail - Built-in logging

🎯 Quick Reference
Plugin Development Checklist
Backend:

Copy templates/plugin-backend-template
Configure plugin.config.js
Implement model using ServiceManager
Add security middleware to routes
Add input validation
Write tests with mock adapters

Frontend:

Copy templates/plugin-frontend-template
Define TypeScript types
Create API layer with CSRF
Implement context with panel registration
Build responsive components
Add keyboard navigation attributes

Integration:

Add to pluginRegistry.ts
Grant plugin access in database
Test CRUD operations
Test keyboard navigation
Test security (auth, CSRF, validation)
Test mobile responsive

📈 Success Metrics
Plugin is production-ready when:

✅ Zero console errors/warnings
✅ All CRUD operations work
✅ Security middleware on all routes
✅ Input validation implemented
✅ CSRF protection working
✅ Keyboard navigation functional
✅ Mobile/desktop responsive
✅ Core services used (no direct infrastructure)
✅ Tests passing (unit + integration + security)
✅ Tenant isolation verified
✅ Performance acceptable

🤝 Contributing
When contributing:

Read relevant documentation sections
Follow naming conventions exactly
Use core services for all infrastructure
Include security middleware
Write tests (unit + integration)
Update documentation if needed

📞 Support
For questions or issues:

Check LESSONS_LEARNED.md - Common mistakes and solutions
Review relevant guide for specific topic
Check existing plugins for reference implementation
Use COLLABORATION_GUIDE.md for AI assistance patterns

## System Status

✅ **Production-Ready** - Service abstraction with automated plugin integration  
✅ **Development Ready** - Complete guides with security enforcement  
✅ **Architecture** - Service abstraction + plugin isolation + security by default  
✅ **Team Ready** - Zero-conflict parallel development workflow

Use these standards for secure, efficient, professional development.
