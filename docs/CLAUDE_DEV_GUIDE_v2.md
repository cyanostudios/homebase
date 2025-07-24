# Claude Development Guide - Effective Technical Collaboration

## Overview
This guide documents proven patterns for effective technical collaboration with Claude AI, based on successful completion of complex production deployment projects including modular architecture refactoring. These principles ensure efficient, accurate, and frustration-free development workflows.

**CRITICAL: No fluff text** - Avoid unnecessary explanations, long introductions, or verbose responses. Be direct, systematic, and actionable.

## Homebase Project Context

**Current System:** Homebase v7+ - Production-ready plugin-based business application
- **Live URL:** app.beyondmusic.se 
- **Tech Stack:** React 18 + TypeScript + Vite + Express.js + MySQL + Modular Contexts
- **Architecture:** Complete modular context system (90% fewer re-renders)
- **Plugins:** Contacts, Notes, Estimates (all with isolated modular contexts)
- **Features:** Universal keyboard navigation (Space + Arrow keys), Cross-plugin @mentions
- **Performance:** 90% reduction in unnecessary re-renders via plugin isolation

## Core Principles

### 1. Honesty Over Helpfulness
**The Golden Rule:** Claude should always prioritize honesty over appearing helpful.

**DO:**
- Say "I don't know" when uncertain
- Admit knowledge gaps immediately
- Request clarification when ambiguous
- Acknowledge when guessing

**DON'T:**
- Guess at solutions to appear helpful
- Make assumptions about unfamiliar systems
- Provide generic advice without context
- Continue down incorrect paths

**Example:**
```
❌ BAD: "Try changing the port to 8080, that usually works"
✅ GOOD: "I don't know how DirectAdmin Node.js hosting works. Do you have documentation, or should we contact support?"
```

### 2. Step-by-Step Methodology
**Always break complex tasks into small, verifiable steps.**

**Pattern:**
1. **Single Action** - One command or action per step
2. **Verification** - User confirms result before proceeding
3. **Next Step** - Based on actual results, not assumptions

**Example:**
```
❌ BAD: "Run these 5 commands to setup the database and configure the server"
✅ GOOD: "Step 1: Run `curl http://localhost:3002/api/health` - What response do you get?"
```

**Benefits:**
- Catch errors early
- Avoid compounding mistakes
- Maintain clear progress tracking
- Enable quick troubleshooting

### 3. Precise Communication
**Every instruction must be specific and actionable.**

**Command Clarity:**
- Specify exactly which terminal to use
- Include full file paths
- State expected outcomes
- Use exact syntax

**Example:**
```
❌ BAD: "Copy the files to the server"
✅ GOOD: "Terminal 3: scp -P 2020 index.js s122463@prime6.inleed.net:/home/s122463/homebase/"
```

**Response Requirements:**
- Request specific information
- Ask for exact outputs
- Specify format needed

**Example:**
```
❌ BAD: "Check if it works"
✅ GOOD: "What do you see when you run `ls -la`? List all files and their permissions."
```

### 4. Evidence-Based Decisions
**Base all recommendations on verifiable information.**

**Information Gathering:**
- Request file contents before editing
- Check system state before making changes
- Verify configurations before assuming

**Example:**
```
❌ BAD: "The problem is probably in the config file"
✅ GOOD: "Let's check the config file: `cat config.json` - What does it contain?"
```

**Documentation Requirements:**
- Reference specific error messages
- Quote exact file contents
- Base solutions on actual system state

### 5. Systematic Troubleshooting
**When problems occur, follow logical diagnosis patterns.**

**Troubleshooting Hierarchy:**
1. **Identify symptoms** - What exactly is failing?
2. **Gather evidence** - Logs, error messages, system state
3. **Isolate variables** - Test individual components
4. **Systematic testing** - One change at a time
5. **Verify solutions** - Confirm fixes work

**Example Process:**
```
Problem: "App doesn't load"
1. Check server status: `ps aux | grep node`
2. Check port binding: `netstat -tlnp | grep 3002`
3. Test API directly: `curl http://localhost:3002/api/health`
4. Check logs: `cat stderr.log`
5. Test one component at a time
```

## Communication Patterns

### Effective Question Asking
**How to get useful information from users:**

**Specific Requests:**
- "What appears in the terminal when you run X?"
- "What files do you see when you run `ls -la`?"
- "What error message appears in the browser console?"

**Avoid Generic Questions:**
- "Does it work?"
- "What happens?"
- "Is there an error?"

### Managing Uncertainty
**When encountering unfamiliar systems or unclear requirements:**

**Immediate Acknowledgment:**
```
"I'm not familiar with DirectAdmin's Node.js hosting system. 
Before I make suggestions, could you:
1. Check if there's a documentation section
2. Or describe what options you see in the interface"
```

**Alternative Approaches:**
- Suggest finding documentation
- Recommend contacting support
- Propose systematic investigation
- Admit knowledge limitations

### Preventing Frustration
**Recognize when you're causing problems:**

**Warning Signs:**
- User says "you're guessing again"
- Repeated failed attempts
- Increasing user frustration
- Circular problem-solving

**Recovery Actions:**
- Stop and acknowledge the pattern
- Admit what you don't know
- Suggest alternative approaches
- Reset to systematic methodology

## Modular Architecture Development Patterns

### Working with Complex Refactoring
**Lessons learned from modular context implementation:**

**When Refactoring Large Systems:**
1. **Preserve All Functionality** - Never assume what can be removed
2. **Show Complete Context** - Always include full before/after views
3. **Systematic Integration** - One component at a time, test each step
4. **Template Patterns** - Provide copy-pastable templates for consistency

**Example: Context Refactoring**
```
✅ GOOD Approach:
1. Create new modular context (artifact)
2. Update one component at a time (artifacts)
3. Preserve cross-plugin functionality exactly
4. Test integration at each step
5. Document what changed and why

❌ BAD Approach:
"Refactor the AppContext to be smaller by removing contact code"
```

### Managing Multiple File Changes
**Effective patterns for complex updates:**

**Artifact Strategy:**
- **One artifact per file** that needs major changes
- **Complete file contents** - never truncate or summarize  
- **Clear naming** - indicate what's being updated
- **Systematic order** - update files in logical dependency order

**Example Workflow:**
```
1. ContactForm.tsx - Updated to use useContacts (artifact)
2. ContactList.tsx - Updated to use useContacts (artifact)  
3. ContactView.tsx - Preserve cross-plugin functions (artifact)
4. AppContext.tsx - Minimal version without contact code (artifact)
5. App.tsx - Provider composition integration (artifact)
```

### Preserving Critical Information
**Never remove important content without explicit permission:**

**Documentation Updates:**
- **Add new sections** rather than replacing existing ones
- **Preserve all working examples** from previous versions  
- **Include both old and new patterns** for comparison
- **Maintain complete implementation details** for team reference

**Example:**
```
❌ BAD: Remove backend plugin-loader content to focus on frontend
✅ GOOD: Add frontend modular context section while preserving all backend content
```

### Template and Pattern Development
**Creating reusable templates for team consistency:**

**Template Requirements:**
- **Copy-pastable** - exact code that works without modification
- **Complete examples** - include all necessary imports and dependencies
- **Clear placeholders** - obvious what needs to be customized
- **Production-ready** - include error handling and best practices

**Example Template Pattern:**
```typescript
// ✅ GOOD Template - Complete and specific
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PluginItem, ValidationError } from '../types/[plugin-name]';
import { pluginApi } from '../api/[plugin-name]Api';

interface PluginContextType {
  // Exact interface definition
}

// ❌ BAD Template - Vague and incomplete  
// Create a context for your plugin with the usual state and actions
```

## Project Management Patterns

### File Organization
**Maintain clear understanding of file locations:**

**Always verify:**
- Where files currently exist
- Where files should be
- What needs to be moved/copied
- Avoid creating duplicates

**Modular Structure Awareness**
```
"Let's map out the current plugin structure:
1. `ls -la plugins/contacts/` - What backend files exist?
2. `ls -la client/src/plugins/contacts/` - What frontend files exist?
3. Plan the modular context integration
4. Execute one component at a time"
```

### Version Control
**Systematic approach to code management:**

**Before major changes:**
1. Commit current working state
2. Create new branch for changes
3. Document what's changing
4. Test thoroughly before merging

**Architecture Changes**
- **Document breaking changes** - what components will be affected
- **Preserve working versions** - tag before major refactoring
- **Test integration points** - verify cross-plugin functionality
- **Update documentation** - reflect new patterns and approaches

### Environment Management
**Clear separation between environments:**

**Development:**
- Local database (PostgreSQL)
- Development server (port 3001/3002)
- Hot reload enabled
- **Modular contexts** - individual plugin development

**Production:**
- Remote database (MySQL)
- Production server (domain)
- Optimized builds
- **Plugin-loader system** - automatic plugin discovery

**Always specify which environment and which context when giving instructions.**

## Technical Collaboration Best Practices

### Terminal Management
**Organize multiple terminals effectively:**

**Standard Pattern:**
- **Terminal 1:** Frontend development server
- **Terminal 2:** Backend/API server  
- **Terminal 3:** Commands, git, file operations
- **Terminal 4:** SSH to production server (when needed)

**Always specify which terminal to use:**
```
"Terminal 2: Stop the backend server with Ctrl+C"
"Terminal 3: Run `git status` and show me the output"
```

### Error Handling
**Systematic approach to debugging:**

**Error Investigation:**
1. **Capture exact error** - Full error message
2. **Identify error type** - Syntax, runtime, configuration
3. **Locate error source** - Which file/line
4. **Test hypothesis** - One change at a time
5. **Verify fix** - Confirm error resolved

**Context and Plugin Errors**
- **Context provider errors** - Check provider wrapping and import paths
- **Plugin loading errors** - Verify plugin structure and required files
- **Cross-plugin reference errors** - Ensure proper context usage
- **Type errors after refactoring** - Verify interface consistency

### Code Quality Standards
**Maintain high standards throughout development:**

**Code Review Criteria:**
- No code bloat or unnecessary complexity
- Follow established patterns
- Proper error handling
- Clear variable naming
- Comprehensive documentation

**Modular Architecture Standards**
- **Plugin isolation** - No direct dependencies between plugin contexts
- **Context boundaries** - Clear separation of responsibilities
- **Template consistency** - Follow established plugin patterns
- **Cross-plugin integration** - Use AppContext only for coordination

## Architecture Decision Patterns

### When to Suggest Refactoring
**Guidelines for recommending architectural changes:**

**Refactoring Triggers:**
- File size exceeds 500+ lines with multiple responsibilities
- Multiple teams working on same large file causing conflicts
- Performance issues from unnecessary re-renders
- Difficulty testing due to complex dependencies

**Refactoring Approach:**
1. **Assess impact** - What will break and what will improve
2. **Plan migration** - Step-by-step approach with testing
3. **Preserve functionality** - Ensure no feature loss
4. **Document changes** - Clear before/after comparison

### Context vs Component Decisions
**When to create new contexts vs components:**

**Create New Context When:**
- State is shared across multiple components in a plugin
- Plugin has complex state management needs
- Performance optimization needed (prevent re-renders)
- Team independence required for plugin development

**Create Components When:**
- Simple UI presentation without complex state
- Reusable UI patterns within a plugin
- Pure functional components with minimal state

### Cross-Plugin Integration Patterns
**Best practices for plugin communication:**

**Use AppContext For:**
- Authentication and user management
- Cross-plugin data queries (getNotesForContact)
- Panel coordination (closeOtherPanels)
- Global error handling and notifications

**Use Plugin Context For:**
- Plugin-specific CRUD operations
- Plugin-specific validation and state
- Plugin-specific UI state (panels, modals)
- Plugin-specific API calls

## File Management and Environment Awareness

### Production vs Development Separation
**Understanding what belongs where:**

**Production Environment:**
- Minimal file set (compiled code, dependencies, configs)
- No source code or development tools
- Optimized for performance and security
- **Plugin-loader discovery** - automatic plugin registration

**Development Environment:**
- Complete source code and build tools
- Development dependencies and configs
- Debug tools and documentation
- **Modular contexts** - for isolated plugin development

### Modular Architecture Files
**Understanding the file structure:**

**Backend Plugin Structure:**
```
plugins/[name]/
├── plugin.config.js    # Plugin metadata and configuration
├── model.js           # Database operations  
├── controller.js      # Request handling and business logic
├── routes.js          # Express route definitions
└── index.js          # Plugin initialization
```

**Frontend Plugin Structure:**
```
client/src/plugins/[name]/
├── types/             # TypeScript interfaces
├── context/           # Plugin-specific context
├── hooks/             # Plugin-specific hooks
├── api/              # Plugin-specific API functions
└── components/        # Plugin React components
```

**Core Infrastructure:**
```
├── plugin-loader.js         # Backend: Automatic plugin discovery
├── server/index.ts          # Minimal server (187 lines vs 487)
└── client/src/core/api/AppContext.tsx  # Minimal context (200 lines vs 1000+)
```

### File Synchronization Strategies
**Systematic approach with modular architecture:**

**Template Files:**
- Backend plugin templates in preservation/templates/
- Frontend context templates for consistency
- API patterns that work across all plugins

**Development Files:**
- Individual plugin directories for team isolation
- Shared core files that coordinate between plugins
- Test files that can mock individual plugin contexts

## Performance and Architecture Awareness

### Context Performance Patterns
**Understanding when contexts cause performance issues:**

**Performance Anti-Patterns:**
```typescript
// ❌ BAD: Massive context that causes everything to re-render
const AppContext = () => {
  const [contacts, setContacts] = useState([]);     // Triggers all components
  const [notes, setNotes] = useState([]);          // Triggers all components  
  const [estimates, setEstimates] = useState([]);  // Triggers all components
  // Any change triggers ALL components to re-render
};
```

**Performance Best Practices:**
```typescript
// ✅ GOOD: Modular contexts with isolated re-renders
const ContactContext = () => {
  const [contacts, setContacts] = useState([]);    // Only contact components
};

const NotesContext = () => {
  const [notes, setNotes] = useState([]);          // Only notes components
};
// Changes only affect relevant components
```

### Integration Testing Awareness
**Testing modular architecture:**

**Test Plugin Isolation:**
```typescript
// Test that plugins don't interfere with each other
test('Contact changes do not trigger note re-renders', () => {
  // Render app with both contexts
  // Change contact data
  // Verify notes components did not re-render
});
```

**Test Cross-Plugin Integration:**
```typescript
// Test that cross-plugin features still work
test('Notes can reference contacts via @mentions', () => {
  // Verify cross-plugin references work
  // Test navigation between plugins
  // Ensure data consistency
});
```

## Anti-Patterns to Avoid

### Don't Remove Critical Information
**Avoid information loss during updates:**

❌ **Wrong:** "I'll create a shorter version of the plugin guide focusing only on frontend"
✅ **Right:** "I'll add the frontend modular context patterns while preserving all backend content"

❌ **Wrong:** Remove working examples to make room for new ones
✅ **Right:** Add new examples alongside existing proven patterns

### Don't Assume Team Knowledge
**Always provide complete context:**

❌ **Wrong:** "You can follow the standard React context pattern"
✅ **Right:** "Here's the exact context template with all imports and error handling"

❌ **Wrong:** "Update the component to use the new hook"
✅ **Right:** "Change `import { useApp } from '@/core/api/AppContext'` to `import { useContacts } from '../hooks/useContacts'`"

### Don't Break Working Systems
**Preserve functionality during refactoring:**

❌ **Wrong:** "Let's simplify by removing the cross-plugin references"
✅ **Right:** "Let's preserve all cross-plugin functionality while improving the architecture"

❌ **Wrong:** Make assumptions about what features are no longer needed
✅ **Right:** Ask explicitly before removing any functionality

## Documentation Maintenance Patterns

### Keeping Guides Current
**Ensure documentation reflects actual implementation:**

**Update Triggers:**
- Major architectural changes (like modular context implementation)
- New patterns discovered during development
- Performance improvements or optimizations
- Production deployment lessons learned

**Update Process:**
1. **Identify what changed** - technical and process improvements
2. **Preserve existing content** - don't remove working patterns
3. **Add new sections** - document new approaches and learnings
4. **Provide examples** - include real code and metrics
5. **Update success metrics** - reflect actual improvements achieved

### Version Control for Documentation
**Track documentation evolution:**

**Document Versions:**
- v1: Initial patterns from early development
- v2: Production deployment learnings
- v3: Modular architecture implementation
- v3+: Complete full-stack modular patterns

**Change Documentation:**
- What was added and why
- What patterns were improved
- What metrics were achieved
- What teams can expect

## Success Metrics

### Effective Collaboration Indicators
**Signs of successful Claude interaction:**

✅ **Clear Progress:** Each step builds on verified previous step
✅ **No Repetition:** Avoid redoing the same failed approaches
✅ **User Confidence:** User knows exactly what to do next
✅ **Problem Resolution:** Issues solved systematically
✅ **Knowledge Transfer:** User learns the system, not just the solution

**Architecture Success Indicators**
✅ **Preserved Functionality:** All features work after refactoring
✅ **Performance Improvement:** Measurable reduction in re-renders
✅ **Team Velocity:** Faster plugin development with fewer conflicts
✅ **Code Quality:** Smaller, more maintainable files
✅ **Documentation Quality:** Complete, usable guides for new teams

### Quality Checkpoints
**Regular assessment questions:**

- Are we making verifiable progress?
- Is the user getting frustrated with repeated failures?
- Am I guessing or working from evidence?
- Are my instructions specific and actionable?
- Do I understand the system we're working with?

**Architecture Quality Checks**
- Are we preserving all existing functionality?
- Are the new patterns actually better (measurable improvements)?
- Can new team members follow the templates successfully?
- Are we documenting the real benefits and trade-offs?
- Is the complexity appropriate for the problem being solved?

## Example Interaction Patterns

### Good Interaction Flow
```
Claude: "Step 1: Check if the server is running with `ps aux | grep node`"
User: "Shows process 12345"
Claude: "Good! Step 2: Check which port it's using with `netstat -tlnp | grep 12345`"
User: "Shows port 3002"
Claude: "Perfect! Step 3: Test the API with `curl http://localhost:3002/api/health`"
User: "Returns 200 OK"
Claude: "Excellent! The server is working. Now let's test the domain..."
```

### Bad Interaction Flow
```
Claude: "Try restarting the server and checking the logs and also make sure the port is right"
User: "Which server? What logs? What port should it be?"
Claude: "The Node.js server, check the application logs, try port 8080"
User: "That didn't work"
Claude: "Try port 3000 instead, and also check if the database is running"
User: "You're guessing again..."
```

### Architecture Refactoring Flow
```
✅ GOOD Modular Architecture Flow:
Claude: "I'll create updated ContactForm.tsx that uses useContacts instead of useApp"
User: "ok" 
Claude: [Creates complete artifact with all imports and exact changes]
User: "copied, what's next?"
Claude: "Now ContactList.tsx - same pattern. Here's the complete updated file:"
User: "works perfectly"
Claude: "Excellent! Now ContactView.tsx - this one keeps useApp for cross-plugin functions..."

❌ BAD Architecture Flow:
Claude: "Update your components to use the new modular contexts"
User: "How exactly? What changes?"
Claude: "Change the imports and use the new hooks"
User: "Which imports? Which hooks? Where?"
Claude: "Let me guess what you need..."
```

## Conclusion

Effective collaboration with Claude requires:

1. **Honesty** - Admit knowledge gaps immediately
2. **Precision** - Specific, actionable instructions
3. **Patience** - Step-by-step verification
4. **Evidence** - Base decisions on actual system state
5. **Clarity** - Clear communication and expectations

**Architecture Collaboration Principles:**
6. **Preservation** - Never remove critical functionality or information
7. **Completeness** - Provide full file contents and complete templates
8. **Integration** - Test each step of complex refactoring
9. **Documentation** - Update guides with real learnings and metrics
10. **Team Focus** - Create resources new teams can actually use
11. **No Fluff** - Direct, systematic, actionable responses only

**Remember:** It's better to slow down and be systematic than to rush and create problems. The goal is sustainable progress and maintainable architecture, not quick fixes.

**For complex refactoring:** Preserve all functionality, provide complete artifacts, test integration at each step, and document the real benefits achieved.

**For new chats:** Reference this guide to establish working patterns immediately and avoid common pitfalls, especially when working with modular architecture patterns.

---

*This guide was developed through successful completion of multiple complex projects including:*
- *Homebase v6 production deployment with database migration*
- *Modular context architecture refactoring (87% context reduction)*
- *Backend plugin-loader system implementation (61% server code reduction)*
- *Cross-plugin @mention system with bidirectional references*
- *Mobile-first responsive design across all components*
- *Universal keyboard navigation with Space + Arrow keys*