# Collaboration Guide - AI Development Patterns

## Purpose

This guide documents proven patterns for effective technical collaboration with AI assistants, specifically for Homebase development. These principles ensure efficient, accurate development workflows while avoiding common pitfalls.

## Core Principles

### 1. Honesty Over Helpfulness
**The Golden Rule:** Always prioritize accuracy over appearing helpful.

**DO:**
- Say "I don't know" when uncertain
- Request clarification for ambiguous requirements
- Admit knowledge gaps immediately

**DON'T:**
- Guess at solutions without evidence
- Make assumptions about unfamiliar systems
- Continue down incorrect paths to appear helpful

### 2. Step-by-Step Methodology
**Break complex tasks into small, verifiable steps.**

**Pattern:**
1. **Single Action** - One command or change per step
2. **Verification** - Confirm result before proceeding
3. **Next Step** - Based on actual results, not assumptions

**Example:**
```
✅ GOOD: "Step 1: Run `curl http://localhost:3002/api/health` - What response do you get?"
❌ BAD: "Run these 5 commands to setup the database and configure the server"
```

### 3. Precise Communication
**Every instruction must be specific and actionable.**

**Command Clarity:**
- Specify which terminal to use
- Include full file paths
- State expected outcomes

**Example:**
```
✅ GOOD: "Terminal 2: npm run dev - You should see 'Server running on port 3002'"
❌ BAD: "Start the server and check if it works"
```

### 4. Evidence-Based Decisions
**Base recommendations on verifiable information.**

**Always request:**
- File contents before editing
- System state before making changes
- Error messages before troubleshooting

**Example:**
```
✅ GOOD: "Show me the contents of App.tsx first, then I'll explain the needed changes"
❌ BAD: "The problem is probably in App.tsx, try changing the imports"
```

## Homebase-Specific Patterns

### Working with Modular Architecture
**Key principles for plugin development:**

**When Creating New Plugins:**
1. **Copy Complete Templates** - Use contacts plugin as reference
2. **Preserve All Functionality** - Never assume what can be removed
3. **Test Integration** - Verify cross-plugin features work
4. **One Component at a Time** - Update files systematically

**Example Workflow:**
```
✅ GOOD:
1. Create backend plugin structure (copy contacts template)
2. Test backend API endpoints work
3. Create frontend context (copy ContactContext pattern)
4. Update one component at a time
5. Test keyboard navigation and responsive design

❌ BAD:
"Update all the plugin files to use the new architecture"
```

### File Management
**Systematic approach to code changes:**

**Artifact Strategy:**
- **One artifact per file** that needs major changes
- **Complete file contents** - never truncate or summarize
- **Clear naming** - indicate what's being updated
- **Test each change** before proceeding to next file

**Example:**
```
✅ GOOD: 
"I'll create updated ContactForm.tsx that uses useContacts hook"
[Creates complete artifact with all imports and functions]
"Copy this file, test it works, then we'll update ContactList.tsx"

❌ BAD:
"Update your form components to use the new hooks and patterns"
```

### Preserving Critical Information
**Never remove important content without explicit permission:**

**Documentation Updates:**
- Add new sections rather than replacing existing ones
- Preserve all working examples for team reference
- Include both old and new patterns for comparison
- Maintain complete implementation details

**Code Changes:**
- Preserve all existing functionality
- Keep cross-plugin references working
- Maintain keyboard navigation support
- Don't assume what features are no longer needed

## Communication Patterns

### Effective Question Asking
**How to get useful information:**

**Specific Requests:**
- "What appears in the terminal when you run X?"
- "What files do you see when you run `ls -la`?"
- "What error message appears in the browser console?"

**Avoid Generic Questions:**
- "Does it work?"
- "What happens?"
- "Is there an error?"

### Managing Uncertainty
**When encountering unfamiliar systems:**

**Immediate Acknowledgment:**
```
"I'm not familiar with [specific system/concept]. 
Before making suggestions, could you:
1. Show me the current configuration
2. Or describe what you're trying to achieve"
```

**Recovery Actions:**
- Suggest finding documentation
- Recommend testing one component at a time
- Propose systematic investigation
- Admit knowledge limitations honestly

### Terminal Management - CORRECTED
**Standard development workflow:**

**CORRECTED Standard Pattern:**
- **Terminal 1:** Frontend (`npx vite`) - **Run from ROOT directory**
- **Terminal 2:** Backend (`npm run dev`) - **Run from ROOT directory**
- **Terminal 3:** Commands, git, testing - **Run from ROOT directory**

**IMPORTANT:** All commands run from the **project root directory**, not from `client/` subdirectory.

**Always specify:**
```
"Terminal 1: npx vite - You should see 'Local: http://localhost:3001/'"
"Terminal 2: npm run dev - You should see 'Server running on port 3002'"
"Terminal 3: Run `git status` and show me the output"
```

**CRITICAL Corrections:**
```
❌ OLD/WRONG: "Terminal 1: cd client && npx vite --config vite.config.ts"
✅ NEW/CORRECT: "Terminal 1: npx vite (from project root)"

❌ OLD/WRONG: "Terminal 1: cd client && npm run dev"  
✅ NEW/CORRECT: "Terminal 1: npx vite (from project root)"
```

### Development Environment Verification
**Always verify setup before proceeding:**

```
✅ GOOD Terminal Sequence:
"Terminal 1: npx vite - What URL does it show?"
Expected: "Local: http://localhost:3001/"

"Terminal 2: npm run dev - What message appears?"
Expected: "Server running on port 3002"

"Terminal 3: curl http://localhost:3002/api/health - What response?"
Expected: {"status":"ok","timestamp":"..."}
```

## Development Best Practices

### Plugin Development Workflow
**Proven 15-25 minute pattern:**

1. **Backend Plugin** (5 min) - Copy templates, customize data model
2. **Frontend Context** (5 min) - Create isolated state management
3. **UI Components** (8 min) - Build responsive components
4. **Registration** (5 min) - Add to pluginRegistry.ts
5. **Testing** (2 min) - Verify CRUD + keyboard navigation

### Code Quality Standards
**Maintain high standards:**

- Follow established component templates exactly
- Maintain cross-plugin functionality where relevant
- Include keyboard navigation support (required attributes)
- Implement proper error handling and validation
- Add responsive mobile designs with conditional rendering

### Error Handling
**Systematic debugging approach:**

1. **Capture exact error** - Full error message and context
2. **Identify error type** - Syntax, runtime, configuration
3. **Locate error source** - Which file and line
4. **Test hypothesis** - One change at a time
5. **Verify fix** - Confirm error resolved

### Common Setup Issues - NEW TROUBLESHOOTING
**Frontend setup problems and solutions:**

**"Could not resolve @/core/api/AppContext"**
- **Cause:** Running Vite from wrong directory
- **Solution:** Ensure `npx vite` runs from project root, not `client/`

**"Frontend shows blank page"**
- **Check:** Both Terminal 1 (`npx vite`) and Terminal 2 (`npm run dev`) running?
- **Check:** Are you accessing http://localhost:3001 (not 5173)?
- **Check:** Any errors in browser console?

**"EADDRINUSE: address already in use"**
- **Solution:** Stop existing processes with Ctrl+C, then restart

## Anti-Patterns to Avoid

### Don't Break Working Systems
**Preserve functionality during changes:**

❌ **Wrong:** "Let's simplify by removing the cross-plugin references"
✅ **Right:** "Let's preserve all cross-plugin functionality while improving the architecture"

❌ **Wrong:** Make assumptions about what features are no longer needed
✅ **Right:** Ask explicitly before removing any functionality

### Don't Remove Critical Information
**Avoid information loss:**

❌ **Wrong:** "I'll create a shorter version focusing only on new patterns"
✅ **Right:** "I'll add the new patterns while preserving all existing content"

### Don't Assume Knowledge
**Always provide complete context:**

❌ **Wrong:** "You can follow the standard React context pattern"
✅ **Right:** "Here's the exact context template with all imports and error handling"

### Don't Use Incorrect Commands - CRITICAL
**Terminal command accuracy is essential:**

❌ **Wrong:** "Terminal 1: cd client && npx vite"
✅ **Right:** "Terminal 1: npx vite (from project root)"

❌ **Wrong:** Assuming separate frontend/backend package management
✅ **Right:** All dependencies managed from single root package.json

## Project Context Awareness

### Current Architecture (v8+) - UPDATED
- **Complete modular context system** - All plugins use isolated contexts with automated core integration
- **Universal keyboard navigation** - Space + Arrow keys across all plugins
- **Cross-plugin @mentions** - Notes can reference contacts
- **Mobile-first responsive design** - All components support mobile/desktop
- **Production deployment** - Live at app.beyondmusic.se
- **ZERO manual core updates** - Automated plugin integration system

### Key Files and Patterns
- **Plugin Templates** - Use contacts plugin as reference
- **Context Pattern** - ContactContext.tsx shows complete modular pattern with generic `panelMode`
- **Component Standards** - ContactList/Form/View show responsive design
- **Style Standards** - Follow STYLE_GUIDE.md patterns
- **Global Functions** - Forms must implement plural-named global functions
- **Automated Integration** - Plugin registry handles all core file updates

### Performance Achievements - UPDATED
- **90% fewer re-renders** - Plugin isolation prevents cascading updates
- **61% server code reduction** - Minimal core with plugin-loader system
- **15-25 minute plugin development** - Standardized templates and patterns
- **100% elimination of manual core updates** - Automated integration system
- **Zero team conflicts** - Complete plugin separation

## Quality Checkpoints

### Regular Assessment Questions
- Are we making verifiable progress?
- Is the user getting frustrated with repeated failures?
- Am I guessing or working from evidence?
- Are my instructions specific and actionable?
- Do I understand the system we're working with?
- **NEW:** Am I using the correct terminal commands?

### Architecture Quality Checks
- Are we preserving all existing functionality?
- Are the new patterns measurably better?
- Can new team members follow the templates?
- Are we documenting real benefits and trade-offs?
- Is the complexity appropriate for the problem?
- **NEW:** Do the setup instructions actually work?

## Example Interaction Patterns

### Good Interaction Flow - UPDATED
```
AI: "Step 1: Start frontend with `npx vite` from project root - What URL appears?"
User: "Shows 'Local: http://localhost:3001/'"
AI: "Perfect! Step 2: Start backend with `npm run dev` from same directory"
User: "Shows 'Server running on port 3002'"
AI: "Excellent! Now let's check plugin structure with `ls -la client/src/plugins/contacts/`"
User: "Shows context/, hooks/, api/, components/, types/ directories"
AI: "Great! Now let's copy the ContactContext.tsx pattern for your new plugin..."
```

### Bad Interaction Flow - CORRECTED
```
❌ BAD:
AI: "Terminal 1: cd client && npx vite --config vite.config.ts"
User: "Error: Cannot find vite.config.ts"
AI: "Try: cd client && npm run dev"
User: "Error: no package.json in client"
AI: "Let me guess what's wrong..."
User: "This isn't working..."

✅ GOOD:
AI: "Terminal 1: npx vite (from project root) - What do you see?"
User: "Local: http://localhost:3001/"
AI: "Perfect! The frontend is running correctly."
```

### Architecture Refactoring Flow
```
✅ GOOD:
AI: "I'll create the complete EstimateContext.tsx using the ContactContext pattern"
User: "ok"
AI: [Creates complete artifact with all functions and proper naming]
User: "copied, works perfectly"
AI: "Excellent! Now let's update EstimateForm.tsx to use useEstimates instead of useApp..."

❌ BAD:
AI: "Refactor your estimate components to use modular contexts"
User: "How exactly? What changes?"
AI: "Update the imports and state management"
User: "Which imports? How?"
```

## Success Metrics

### Effective Collaboration Indicators
✅ **Clear Progress** - Each step builds on verified previous step
✅ **No Repetition** - Avoid redoing failed approaches
✅ **User Confidence** - User knows exactly what to do next
✅ **Problem Resolution** - Issues solved systematically
✅ **Knowledge Transfer** - User learns patterns, not just solutions
✅ **NEW:** Setup works immediately with provided commands

### Architecture Success Indicators
✅ **Preserved Functionality** - All features work after changes
✅ **Performance Improvement** - Measurable benefits achieved
✅ **Team Velocity** - Faster development with fewer conflicts
✅ **Code Quality** - Smaller, more maintainable files
✅ **Documentation Quality** - Complete, usable guides
✅ **NEW:** Zero manual core file updates required

## New Developer Onboarding Success Pattern

### 10-Minute Setup Verification
```
✅ CORRECT Flow:
AI: "Step 1: Clone repo and cd into directory"
User: "Done"
AI: "Step 2: npm install (from root) - Any errors?"
User: "All packages installed successfully"
AI: "Step 3: Terminal 1: npx vite - What URL shows?"
User: "Local: http://localhost:3001/"
AI: "Step 4: Terminal 2: npm run dev - What message?"
User: "Server running on port 3002"
AI: "Perfect! Development environment ready. Let's create your first plugin."
```

## Conclusion

Effective AI collaboration requires:

1. **Honesty** - Admit knowledge gaps immediately
2. **Precision** - Specific, actionable instructions with correct commands
3. **Patience** - Step-by-step verification
4. **Evidence** - Base decisions on actual system state
5. **Preservation** - Never remove critical functionality
6. **Accuracy** - Use correct terminal commands and file paths

**For Homebase development:**
- Use contacts plugin as template for all new plugins
- Follow established modular context patterns with automated integration
- Preserve cross-plugin functionality
- Test keyboard navigation and responsive design
- Use correct Vite setup commands from project root
- Document real benefits and improvements

**Remember:** It's better to slow down and be systematic than to rush and create problems. The goal is sustainable progress and maintainable architecture with working development setup.

---

**Architecture:** Complete modular plugin system with proven patterns  
**Development Time:** 15-25 minutes per plugin with templates  
**Setup Time:** <10 minutes with corrected commands
**Team Ready:** Zero-conflict development with professional standards

*Follow these patterns for efficient, accurate development workflows.*

*Last Updated: August 2025 - Terminal commands corrected*