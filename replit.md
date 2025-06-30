# Referee Admin - System Architecture Documentation

## Overview

Referee Admin is a comprehensive sports club management system designed for managing referee assignments, matches, and administrative tasks. The application supports dual-mode operation - both club administration and referee self-service interfaces. Built with a modern full-stack architecture using React/TypeScript frontend, Express.js backend, and PostgreSQL database.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: React Query (TanStack Query) for server state and React Context for global app state
- **Styling**: Tailwind CSS with Radix UI components for consistent design system
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL with connection pooling
- **API Design**: RESTful endpoints with JSON responses
- **Development**: Hot reload with tsx for TypeScript execution

### Database Design
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Centralized schema definition in `shared/schema.ts`
- **Tables**: Users, Clubs, Referees, Matches, Referee Assignments, Activities, Notifications, Settings
- **Relationships**: Foreign key constraints with proper cascading
- **Enums**: TypeScript enums for status management

## Key Components

### Layout System
- **Modular Design**: Independently styled layout blocks (TopBar, LeftColumn, MidColumn, RightColumn)
- **Responsive**: Mobile-first design with tablet and desktop breakpoints
- **Panel System**: Sliding panels for detail views and edit forms (right-hand column)
- **Navigation**: Context-aware navigation with view mode switching

### Authentication & Authorization
- **Dual Mode**: Club administration mode and referee self-service mode
- **Session Management**: localStorage-based session persistence
- **View Mode Context**: Global state management for switching between club/referee views
- **Protected Routes**: Conditional rendering based on authentication state

### Data Management
- **Query Client**: Centralized API request handling with error management
- **Caching**: Intelligent caching with React Query for optimal performance
- **Optimistic Updates**: Immediate UI feedback with server reconciliation
- **Batch Operations**: Optimized database queries to reduce N+1 problems

### UI/UX Features
- **Shadcn/ui Components**: Consistent design system with accessibility
- **Time/Date Formatting**: Configurable 12/24-hour and US/European date formats
- **Status Management**: Color-coded status indicators with hover states
- **Mobile Responsive**: Touch-friendly interfaces with appropriate breakpoints

## Data Flow

### Client-Server Communication
1. **API Requests**: Centralized through `apiRequest` utility with credential handling
2. **Error Handling**: Consistent error responses with user-friendly messages
3. **Loading States**: Managed through React Query's loading indicators
4. **Real-time Updates**: Query invalidation for data consistency

### State Management Flow
1. **Server State**: React Query manages API data with automatic caching
2. **Global State**: React Context providers for app-wide settings and preferences
3. **Form State**: React Hook Form manages form data with validation
4. **URL State**: Wouter manages routing state and navigation history

### Database Operations
1. **Schema Migrations**: Drizzle Kit handles database schema changes
2. **Connection Pooling**: PostgreSQL connection pool for performance
3. **Transaction Management**: Proper transaction handling for data consistency
4. **Query Optimization**: Batch loading and strategic indexing

## External Dependencies

### Core Framework Dependencies
- **@tanstack/react-query**: Server state management and caching
- **@radix-ui/react-***: Accessible UI component primitives
- **drizzle-orm**: Type-safe database ORM
- **zod**: Runtime type validation
- **react-hook-form**: Form state management
- **wouter**: Lightweight routing

### Development Dependencies
- **tsx**: TypeScript execution for development
- **vite**: Build tool and development server
- **tailwindcss**: Utility-first CSS framework
- **typescript**: Type system for JavaScript

### Database Dependencies
- **pg**: PostgreSQL client for Node.js
- **drizzle-kit**: Database migration and schema management

## Deployment Strategy

### Development Environment
- **Replit Integration**: Configured for Replit development environment
- **Hot Reload**: Vite development server with instant feedback
- **Database**: Replit PostgreSQL with SSL configuration
- **Environment Variables**: Separate development and production configs

### Production Build
- **Build Process**: Vite builds client assets, esbuild bundles server
- **Asset Optimization**: Minification and tree-shaking for optimal performance
- **Server Bundle**: Single JavaScript file with external dependencies
- **Static Assets**: Served from `dist/public` directory

### Replit Deployment
- **Autoscale Target**: Configured for automatic scaling
- **Port Configuration**: External port 80 mapping to internal port 5000
- **Process Management**: npm scripts for development and production modes
- **Database Connection**: Replit PostgreSQL with connection pooling

## Changelog

```
Changelog:
- June 25, 2025. Initial setup
- June 25, 2025. Renamed all references from "match/matches" to "invoice/invoices" throughout the entire application including database schema, API routes, types, and frontend components
- June 25, 2025. Updated navigation and systematically renamed all "referee/referees" references to "contact/contacts" throughout the application, including navigation links, routing, and view mode context
- June 25, 2025. Completed contact management system conversion with fully functional API endpoints, updated all button labels from "Add Referee" to "Add Contact" and "Assign Referee" to "Assign Contact", added "Add Contact" buttons to both desktop and mobile contact views
- June 26, 2025. Fixed TypeScript compilation errors in invoice detail panel and resolved runtime error in invoice creation (matchCategories undefined). Contact management system fully operational with working invoice creation functionality.
- June 26, 2025. Completed removal of all referee-specific functionality, converting the application to a purely admin/contact-facing invoicing system. Removed referee login pages, referee dashboard, referee roles context, and all dual-mode functionality.
- June 26, 2025. Enhanced right-hand side panel (slide-over drawer) by increasing width by 30% from 576px to 748px on desktop viewports for better content visibility while maintaining responsive mobile behavior.
- June 26, 2025. Completed comprehensive contact management system cleanup and debugging. Removed all console logs and unwanted debug code. Enhanced contact form now includes full company information fields: Company Information, Address Information, Contact Persons (repeater), Payment Information, and Invoicing Information. Fixed Tailwind CSS configuration to support custom panel width properly.
- June 26, 2025. Fixed critical application startup issues: Updated database table references from "matches" to "invoices", corrected notification table column from "referee_id" to "contact_id", resolved TypeScript import errors, and fixed enum references from Referee* to Contact* types. Application now starts successfully with proper database connectivity.
- June 27, 2025. Removed all required field validations from both invoice and contact creation systems. Made all form fields optional at the frontend validation level, backend API validation level, and database schema level. This enables flexible restructuring of both invoice and contact forms without mandatory field constraints.
- June 28, 2025. Enhanced contact form with structured JSON data organization. Added VAT rates dropdown with Swedish tax rates (25%, 12%, 6%, 0%), logical data grouping (company info, address, contactInfo, paymentInfo, invoiceInfo, professional), additional addresses repeater functionality, and Address Type fields. Updated backend API to handle both structured and flat data formats for compatibility. Fixed date field validation for contact creation.
- June 28, 2025. Updated contact detail panel to display the new structured data format with organized sections matching the enhanced contact form. Replaced legacy field layout with grouped sections: Contact Information, Company Information, Address Information, Contact Persons, Payment Information, Invoice Information, Professional Information, and Additional Addresses. Fixed JSON parsing issues for contact persons and additional addresses data.
- June 28, 2025. Cleaned up contact detail panel by removing Contact Information and Professional Information sections as requested. Removed e-invoice address and reference person fields from Invoice Information section. Cleaned up database by removing empty contact records. Updated enhanced contact form and form schema to remove einvoiceAddress and referencePerson fields, maintaining consistency across the application.
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```