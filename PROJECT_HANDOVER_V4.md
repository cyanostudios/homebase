# Homebase v4 - Project Handover Summary

## Project Overview
**Homebase** is a plugin-based business application template designed for rapid development of custom business solutions. The core system handles essential functionality while plugins provide specialized features with cross-plugin reference capabilities.

## Architecture Philosophy
- **Core System:** Essential business app infrastructure (contacts, auth, database, API, UI)
- **Plugin System:** Self-contained modules that extend functionality without modifying core
- **Cross-Plugin References:** Advanced @mention system creating connections between different plugins
- **Team Independence:** Different teams can develop plugins independently while maintaining integration capabilities
- **Universal Components:** Shared UI/UX patterns across all plugins

## Current State: v4 - Mobile-Optimized Contact System + Cross-Plugin Reference Architecture

### Major Improvements from v3
- ✅ **Complete mobile optimization** - All forms and views responsive for mobile-first design
- ✅ **Enhanced ContactForm mobile UX** - Vertical stacking on mobile, grid on desktop
- ✅ **Improved ContactView mobile layout** - Logical information hierarchy (number+type, name, org number on separate rows)
- ✅ **Delete confirmation restored** - Professional ConfirmDialog for delete operations in view mode
- ✅ **Consistent field sizing** - Company/Full Name fields match other field widths on desktop
- ✅ **Clean repeater sections** - Removed backgrounds and borders from addresses/contact persons
- ✅ **Perfect spacing and alignment** - Consistent padding and margins throughout application
- ✅ **FIRST WORKING PLUGIN** - Notes plugin fully implemented following v4 patterns
- ✅ **Plugin navigation system** - Working sidebar navigation between different plugins
- ✅ **Unified panel system** - Single UniversalPanel handles both contacts and notes seamlessly
- ✅ **CROSS-PLUGIN REFERENCE SYSTEM** - Advanced @mention system connecting plugins
- ✅ **Bidirectional relationships** - Notes mention contacts, contacts show mentioned notes
- ✅ **Auto-complete @mentions** - Type @ to get dropdown of available contacts
- ✅ **Clickable cross-references** - Navigate between plugins via @mentions

### Why v4?
Successfully implemented comprehensive mobile optimization across the entire contact management system AND created the first fully functional plugin (Notes) with revolutionary cross-plugin reference system. The @mention system demonstrates how different plugins can seamlessly reference and connect to each other, creating a truly integrated business application ecosystem.

### Project Structure
```
/
├── client/src/
│   ├── core/
│   │   ├── ui/
│   │   │   ├── UniversalPanel.tsx      # Unified panel for all plugins
│   │   │   ├── Sidebar.tsx             # Navigation with working plugin switching
│   │   │   └── MainLayout.tsx          # Layout with navigation props
│   │   └── api/AppContext.tsx          # Global state + cross-plugin references
│   ├── plugins/
│   │   ├── contacts/
│   │   │   └── components/
│   │   │       ├── ContactList.tsx     # Mobile-optimized contact list
│   │   │       ├── ContactForm.tsx     # Mobile-optimized contact form
│   │   │       └── ContactView.tsx     # Shows cross-plugin mentions
│   │   └── notes/                      # ✅ CROSS-PLUGIN REFERENCE PLUGIN
│   │       ├── types/notes.ts          # Mention interfaces
│   │       └── components/
│   │           ├── NotesList.tsx       # Notes list following contact patterns
│   │           ├── NoteForm.tsx        # @mention auto-complete form
│   │           ├── NoteView.tsx        # Clickable @mentions + summary
│   │           ├── MentionTextarea.tsx # Auto-complete @mention input
│   │           └── MentionContent.tsx  # Renders clickable @mentions
│   ├── hooks/                          # useUnsavedChanges, custom hooks
│   ├── lib/                            # Utilities
│   └── utils/                          # Helper functions
├── server/
│   ├── core/                           # Core server functionality
│   └── plugins/                        # Plugin-specific API routes
├── shared/                             # Types/schemas shared between client/server
└── preservation/                       # Backup of working components from v1
```

## Technical Stack
- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Express.js + TypeScript
- **Database:** PostgreSQL + Drizzle ORM (planned for next phase)
- **Styling:** Tailwind CSS + Lucide React icons
- **Development:** Cursor IDE with AI assistance
- **Deployment:** Local development → Cloudways production (planned)

## Configuration

### Development Environment
- **Frontend:** Vite dev server on port 3001
- **Backend:** Express server on port 3002
- **Proxy:** Vite proxies `/api/*` requests to backend
- **Hot Reload:** Both frontend and backend support live reloading

### Key Files
- `vite.config.ts` - Frontend build config with path aliases and proxy
- `tsconfig.json` - TypeScript config with path mapping (`@/*` → `./client/src/*`)
- `package.json` - Dependencies and scripts
- `.env.local` - Environment variables (preserved from v1)

## Design System & Mobile Optimization (v4)

### Mobile-First Design Principles
- **Vertical stacking:** All form fields stack vertically on mobile for better usability
- **Logical information hierarchy:** Contact number + type, name, organization number on separate rows
- **Touch-friendly interactions:** Adequate spacing and button sizes for mobile devices
- **Responsive breakpoints:** `md:` breakpoint (768px) for desktop layouts
- **Consistent field sizing:** All input fields maintain proper proportions across devices

### Button Standards (Enhanced v4)
- **Primary buttons:** Solid blue background + white text + icon (important actions)
- **Secondary buttons:** Blue background with 20% opacity + blue text + icon (other actions)
- **Mobile adaptations:** Compressed text on smaller buttons (Company → Co., Private → Priv.)
- **All buttons:** Must include lucide-react icons + consistent sizing

### Mobile UX Patterns (v4)
- **Contact Number & Type:** Side-by-side on desktop, stacked on mobile
- **Form fields:** `space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3` pattern
- **Company/Full Name:** Single column width matching other fields
- **Repeater sections:** Clean design without background colors or excessive borders
- **Contact View:** Optimized information hierarchy for mobile reading

### Component Architecture
- **UniversalPanel:** Reusable 672px-wide right panel with header/footer and scrollable content
- **Plugin Pattern:** Each plugin provides components that integrate with UniversalPanel
- **State Management:** React Context for global state, local useState for component state
- **Responsive Design:** Mobile-first approach with desktop enhancements

## Current Implementation

### Working Components (v4)
1. **Enhanced UniversalPanel** - Unified panel handling contacts, notes, and cross-plugin navigation
2. **AppContext with Cross-Plugin Support** - Global state management + bidirectional reference tracking
3. **Working Plugin Navigation** - Sidebar with highlighted active page and seamless plugin switching
4. **ContactList** - Responsive table/card view with sortable columns and mobile cards
5. **ContactForm** - Mobile-optimized business contact form with advanced features
6. **ContactView** - Mobile-optimized display + **cross-plugin mentions section**
7. **Notes Plugin (COMPLETE + CROSS-PLUGIN)** - Revolutionary plugin with reference system:
   - **NotesList** - Table/card view following contact patterns with sorting
   - **NoteForm** - **@mention auto-complete system** with dropdown contact selection
   - **NoteView** - **Clickable @mentions** + mentioned contacts summary
   - **MentionTextarea** - Auto-complete input component with keyboard navigation
   - **MentionContent** - Renders content with clickable cross-plugin references
   - **Complete CRUD** - Create, Read, Update, Delete with mention tracking
   - **Mobile optimization** - Responsive design matching contact patterns
8. **Cross-Plugin Reference System** - Industry-leading plugin integration:
   - **@mention Auto-complete** - Type @ in notes to see contact dropdown
   - **Bidirectional References** - Notes show mentioned contacts, contacts show mentioning notes
   - **Clickable Navigation** - Click @mentions to navigate between plugins
   - **Real-time Updates** - Add/remove mentions updates both plugins instantly
   - **Mention Validation** - Ensures referenced contacts exist and removes broken references
9. **Delete Confirmation** - Consistent ConfirmDialog for all delete operations across plugins
10. **Plugin Architecture** - Proven working system for rapid plugin development with cross-references

### Integration Flow
```
App.tsx
├── AppProvider (global state for all plugins)
├── Navigation State (currentPage: contacts | notes)
└── AppContent
    ├── MainLayout (with navigation props)
    │   ├── Sidebar (highlighted active page, working navigation)
    │   └── Main Content Area
    │       ├── ContactList (when currentPage === 'contacts')
    │       └── NotesList (when currentPage === 'notes')
    └── UniversalPanel (shared between all plugins)
        ├── ContactView/ContactForm (when contact panel open)
        └── NoteView/NoteForm (when note panel open)
```

## Development Workflow

### How We Work Together

#### User Working Style
- **IDE:** Cursor IDE with AI assistance (GPT-4.1, Gemini)
- **Terminal Management:** Three terminal setup with explicit guidance
  - Terminal 1: Frontend (Vite dev server)
  - Terminal 2: Backend (Express server)  
  - Terminal 3: Commands (git, file operations, curl tests)
- **File Management:** Manual copy/paste from artifacts for longer code files
- **Testing:** Progressive testing after each change
- **Agent Usage:** Minimal - only when absolutely necessary

#### Claude (AI Assistant) Response Style
- **Direct commands only** - "Write this in terminal 1" format, no lengthy explanations
- **Code artifacts** - For longer code files requiring manual copy/paste
- **Concise communication** - Trust user judgment, provide direct solutions
- **Explicit instructions** - Always specify terminal numbers and full file paths
- **Mobile-first mindset** - Always consider mobile UX in recommendations

#### Quality Standards (v4)
- **Mobile-first design** - All components must work excellently on mobile devices
- **Consistent responsive patterns** - Use established `space-y-3 md:space-y-0 md:grid` patterns
- **Clean code only** - No unnecessary complexity or bloat
- **Professional UX** - Every interaction should feel polished and intuitive
- **TypeScript safety** - Complete type definitions for all components

### Command Structure
Minimal terminal commands without unnecessary explanations:

#### Example Correct Response:
```bash
git add .
git commit -m "Add mobile optimization"
git push origin fresh-start-v4
```

#### Example Incorrect Response:
```bash
# Stage all changes for the mobile optimization work
git add .
# Commit with descriptive message about the mobile improvements
git commit -m "Add mobile optimization"
```

### Git Strategy
- **Current Branch:** `fresh-start-v4` (mobile-optimized contact system)
- **Previous:** `fresh-start-v3` (enterprise contact management)
- **Backup:** `backup-legacy-state` tag contains v1 state
- **Preservation:** `/preservation/` folder contains working v1 components
- **Commit Style:** Functional, descriptive commits after each working feature

### AI Agent Usage
- **GPT-4.1:** Complex architecture, systematic refactoring, comprehensive debugging
- **Gemini:** Simple single-task changes, styling updates, file modifications
- **Claude:** Planning, step-by-step guidance, mobile UX decisions, architecture
- **Key Rule:** Agents must follow explicit instructions - no assumptions or package installations
- **Mobile Focus:** All AI assistance considers mobile-first design principles

## Current Status: v4 - Mobile-Optimized System + Revolutionary Cross-Plugin Architecture ✅

### Major Milestone Achieved
**Complete mobile-first contact management system + Revolutionary cross-plugin reference system** that sets new standards for plugin integration:

#### Cross-Plugin Reference System (v4 BREAKTHROUGH)
- ✅ **@mention Auto-complete** - Type @ in notes to get dropdown of contacts with keyboard navigation
- ✅ **Bidirectional References** - Notes track mentioned contacts, contacts show mentioning notes
- ✅ **Clickable Cross-Navigation** - Click @Jane Cooper in note → navigate to ContactView
- ✅ **Real-time Updates** - Add/remove mentions instantly updates both plugins
- ✅ **Mention Validation** - Broken references automatically detected and handled
- ✅ **Visual Integration** - Mentioned contacts highlighted in notes, mentioning notes shown in contacts
- ✅ **Standard for Future Plugins** - Established pattern for any plugin to reference any other plugin

#### Plugin Architecture Success (Enhanced v4)
- ✅ **Working Notes Plugin** - Complete CRUD functionality with cross-plugin capabilities
- ✅ **Unified Panel System** - Single UniversalPanel handles multiple plugin types seamlessly
- ✅ **Plugin Navigation** - Working sidebar with highlighted active states
- ✅ **Shared State Management** - AppContext supports multiple plugins with cross-references
- ✅ **Consistent UX Patterns** - All plugins follow same mobile-first design principles
- ✅ **Rapid Development** - New plugins can be built following established patterns with optional cross-references

#### Mobile Optimization Features (Maintained v4)
- ✅ **Responsive ContactForm** - Vertical stacking on mobile, grid on desktop
- ✅ **Mobile-optimized ContactView** - Logical information hierarchy + cross-plugin mentions section
- ✅ **Mobile ContactList** - Card-based layout with touch-friendly interactions
- ✅ **Consistent field sizing** - All input fields properly proportioned across breakpoints
- ✅ **Clean repeater sections** - Addresses and contact persons without visual clutter
- ✅ **Professional mobile navigation** - Optimized button placement and sizing

#### Business Structure Features (Maintained from v3)
- ✅ **Company/Private Toggle** - Enhanced with mobile-responsive design
- ✅ **Comprehensive Business Data** - All fields optimized for mobile input
- ✅ **Repeatable Sections** - Mobile-friendly address and contact person management
- ✅ **Advanced Validation** - Real-time error handling on all devices
- ✅ **Professional UX** - Consistent confirmation dialogs and unsaved changes protection

#### Technical Excellence (Revolutionary v4)
- ✅ **Cross-Plugin Architecture** - Industry-leading plugin integration with references
- ✅ **Plugin System** - Proven architecture with working Notes plugin + cross-references
- ✅ **Mobile-first CSS patterns** - Consistent responsive design implementation
- ✅ **Touch-optimized interactions** - Proper button sizing and spacing for mobile
- ✅ **Responsive typography** - Appropriate text sizes across all screen sizes
- ✅ **Efficient layouts** - Optimal information density for each device class
- ✅ **Cross-device consistency** - Seamless experience from mobile to desktop
- ✅ **Unified state management** - Single AppContext handling multiple plugin types with cross-references
- ✅ **Real-time reference tracking** - Instant updates across plugin boundaries

### Current Focus
Complete mobile-first enterprise system with revolutionary cross-plugin reference architecture. Both contact management and notes functionality work perfectly across all device types, with seamless cross-plugin navigation and bidirectional references that demonstrate the future of integrated business applications.

### Next Steps Options
1. **Database integration** - PostgreSQL + Drizzle ORM for persistent storage of all plugins + references
2. **Additional plugins** - Invoice, Projects, Equipment following established Notes + cross-reference patterns
3. **Advanced cross-plugin features** - Search across all plugins, global mention search, reference analytics
4. **Production deployment** - Cloudways setup with multi-plugin architecture + cross-reference indexing

## Important Files Preserved
- `/preservation/ContactPanel.tsx` - Complete working contact system from v1
- `/preservation/schema.ts` - Database schema definitions  
- `/preservation/PLUGIN_GUIDE.md` - Plugin development documentation
- `/preservation/package.json` - Working dependencies list

## Development Goals (Updated v4)
1. **Priority 1:** ✅ **COMPLETED** - Mobile-first interface with excellent UX across all devices
2. **Priority 2:** ✅ **COMPLETED** - Core business functionality with professional validation
3. **Priority 3:** Database integration and persistent storage
4. **Priority 4:** Plugin system for extensibility
5. **Focus:** Maintain mobile-first design excellence while building advanced features

## Configuration Details

### Vite Config
- Port 3001 for frontend
- Proxy `/api/*` to port 3002
- Path alias `@/*` maps to `./client/src/*`
- React plugin enabled

### TypeScript Config
- Strict mode enabled
- Path mapping configured
- React JSX support
- Client-side only (no server TS compilation yet)

## Working Terminal Setup
- **Terminal 1:** `npx vite --config vite.config.ts` (frontend)
- **Terminal 2:** `npx tsx server/index.ts` (backend)
- **Terminal 3:** Command terminal for git, file operations

## Cross-Plugin Reference System (v4 Innovation)

### Revolutionary @mention Architecture
The v4 cross-plugin reference system establishes a new standard for plugin integration in business applications:

#### Core @mention Components
```
/plugins/notes/components/
├── MentionTextarea.tsx     # Auto-complete @mention input with dropdown
└── MentionContent.tsx      # Renders clickable @mentions in view mode

/plugins/notes/types/
└── notes.ts               # NoteMention interface for tracking references
```

#### Cross-Plugin Integration Pattern
```typescript
// 1. Plugin defines mention interface
interface NoteMention {
  contactId: string;
  contactName: string;
  companyName?: string;
  position: number;    // Character position in content
  length: number;      // Length of mention text
}

// 2. AppContext provides cross-reference functions
const { getNotesForContact, getContactsForNote } = useApp();

// 3. Auto-complete during editing
<MentionTextarea 
  value={content}
  onChange={(content, mentions) => updateField('content', content, mentions)}
/>

// 4. Clickable mentions in view mode
<MentionContent content={note.content} mentions={note.mentions} />

// 5. Bidirectional display in referenced plugin
const mentionedInNotes = getNotesForContact(contact.id);
```

#### User Experience Flow
1. **Type @** in any note → Dropdown shows available contacts with keyboard navigation
2. **Select contact** → Auto-inserts @ContactName and tracks mention metadata
3. **View note** → @mentions are clickable links to contact pages
4. **View contact** → Shows "Mentioned in Notes" section with links back to notes
5. **Edit/Delete** → Mentions automatically update across all references

#### Benefits for Plugin Development
- **Instant Integration:** Any new plugin can reference existing plugins using @mention pattern
- **Bidirectional Awareness:** Referenced plugins automatically show incoming references
- **Type Safety:** Full TypeScript support for all cross-plugin references
- **Real-time Updates:** Changes in one plugin instantly reflect in all referencing plugins
- **Standard Pattern:** Consistent @mention UX across all future plugins

## Plugin Development Success (v4)

### Established Plugin Patterns
The Notes plugin demonstrates all key v4 patterns that future plugins should follow:

#### Plugin Structure (Proven)
```
/plugins/[plugin-name]/
├── types/[plugin-name].ts      # TypeScript interfaces
└── components/
    ├── [Name]List.tsx          # List view with sorting, mobile cards
    ├── [Name]Form.tsx          # Form with useUnsavedChanges, mobile-first
    └── [Name]View.tsx          # View component with clean layout
```

#### Plugin Integration Checklist (Enhanced v4)
- ✅ **AppContext Integration** - Add plugin state and actions to AppContext
- ✅ **UniversalPanel Support** - Form and View components work in shared panel
- ✅ **Mobile-First Design** - All components follow v4 responsive patterns
- ✅ **useUnsavedChanges** - Form state management with warning dialogs
- ✅ **ConfirmDialog** - Consistent delete confirmations
- ✅ **Navigation Integration** - Add to Sidebar with highlighting
- ✅ **Validation Framework** - Field-level validation with error display
- ✅ **CRUD Operations** - Complete Create, Read, Update, Delete functionality
- ✅ **Cross-Plugin References** - @mention system for referencing other plugins (NEW v4)
- ✅ **Bidirectional Display** - Show incoming references from other plugins (NEW v4)
- ✅ **Auto-complete Integration** - Type @ to reference other plugin items (NEW v4)

#### Code Patterns for New Plugins (Enhanced v4)
```typescript
// Follow Notes plugin patterns exactly:
// 1. Create types in /plugins/[name]/types/[name].ts
//    - Include mention interfaces if plugin should reference others
// 2. Build List component following NotesList.tsx
// 3. Build Form component following NoteForm.tsx
//    - Add MentionTextarea if plugin should reference others
// 4. Build View component following NoteView.tsx  
//    - Add MentionContent for clickable references
//    - Add cross-plugin reference sections
// 5. Add state to AppContext following notes pattern
//    - Include cross-reference helper functions
// 6. Update App.tsx panel handling
// 7. Add navigation to Sidebar
```

### Plugin Development Speed (Enhanced v4)
With established v4 patterns + cross-plugin references, new plugins can be built rapidly:
- **Notes Plugin:** 10 components + integration + cross-references in ~3 hours
- **Future Plugins:** Estimated 45-90 minutes each following Notes template
- **Cross-Plugin Integration:** Automatic with MentionTextarea/MentionContent components
- **Mobile Optimization:** Automatic with established responsive patterns
- **UX Consistency:** Guaranteed by following v4 component patterns
- **Reference Capabilities:** Built-in @mention system for any plugin-to-plugin references

## Mobile Design Patterns (v4 Reference)

### Established Mobile-First Patterns
```typescript
// Mobile-first responsive layout pattern
<div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
  // Fields stack vertically on mobile, side-by-side on desktop
</div>

// Mobile-optimized button text
<span className="hidden sm:inline">Company</span>
<span className="sm:hidden">Co.</span>

// Mobile contact information hierarchy
// Row 1: Contact number + type badge
// Row 2: Company/person name  
// Row 3: Organization/personal number
```

### Mobile UX Guidelines (v4)
- **Touch targets:** Minimum 44px height for interactive elements
- **Vertical spacing:** `space-y-3` for mobile form fields
- **Information hierarchy:** Most important info first, logical reading flow
- **Field sizing:** Full width on mobile, appropriate grid on desktop
- **Visual clarity:** Minimal borders and backgrounds, focus on content

The project has successfully achieved comprehensive mobile optimization AND revolutionary cross-plugin reference architecture with working @mention system. Ready for database integration or rapid development of additional plugins following established v4 + cross-reference patterns.