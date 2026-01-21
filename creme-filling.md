# Creme Filling - System Rules

<!--
============================================================================
CREME-FILLING.MD - The System Rules (like AGENTS.md)
============================================================================

This file contains the "laws" that all agents must follow. It's injected
into every Claude Code instance spawned by oreo-run.js.

Think of this as your project's DNA - the constraints, patterns, and
rules that should NEVER be violated.

SECTIONS:
  1. Universal Laws     - Rules that can never be broken
  2. Project Context    - What this project is about
  3. File Structure     - Where things live
  4. Shared Memory      - Learnings from past sessions
  5. Technical Notes    - Database, API, environment details

CUSTOMIZATION:
  - Replace the examples below with YOUR project's rules
  - Add your specific architectural constraints
  - Include paths to important documentation

============================================================================
-->

## 🏛️ Universal Laws (NEVER VIOLATE)

These rules are absolute and must be followed in every task:

1. **Configuration over Code** - Prefer modifying configuration files over creating new components
2. **No Secrets in Code** - Never hardcode API keys, passwords, or credentials
3. **Test Before Complete** - Run verification before marking a task [x]
4. **Document Learnings** - Log important findings to progress.txt
5. **Stay Focused** - Only do what the task asks, don't over-engineer

## 🚨 COMPLIANCE CHECKLIST (Before Marking Task Complete)

Before you mark a task as complete in cookie-crumbs.md, verify:

- [ ] **Did I update cookie-crumbs.md?** (REQUIRED)
  - ✅ Changed `- [ ] **Task N:` to `- [x] **Task N:`
  - ✅ This signals oreo-run.js that the task is complete

- [ ] **Did I run the verification steps?**
  - ✅ Executed all commands specified in the Verification section
  - ✅ All tests/builds/checks passed successfully

- [ ] **Did I document learnings?** (if applicable)
  - ✅ Updated progress.txt with important findings
  - ✅ Noted any gotchas or issues encountered

**IMPORTANT:** The checkbox change in cookie-crumbs.md is NON-NEGOTIABLE. Without it, oreo-run.js will retry the task indefinitely.

## 📁 Project Structure

```
your-project/
├── oroboreo/           # Oroboreo lives here
│   ├── oreo-run.js      # Main execution loop
│   ├── oreo-feedback.js # Architect (PRD generator)
│   ├── cookie-crumbs.md # Task list (this file's sibling)
│   ├── creme-filling.md # System rules (this file)
│   ├── progress.txt     # Session memory
│   └── archives/        # Historical sessions
├── src/                 # Your source code
├── docs/                # Documentation
└── ...
```

## 🔧 Technical Context

<!-- Customize this section for your project -->

### Environment
- **Runtime:** Node.js 18+
- **Package Manager:** npm
- **Database:** <!-- Your database -->
- **Framework:** <!-- Your framework -->

### Key Files
- `docs/README.md` - Project documentation
- `src/config.js` - Configuration file
- <!-- Add your key files -->

### API Patterns
<!-- Document your API patterns here -->

### Database Notes
<!-- Database connection details, gotchas, etc. -->

## 🧠 Shared Memory (Learnings from Previous Agents)

### Common Pitfalls
- *(Add learnings as you discover them)*

### What Works Well
- *(Add successful patterns here)*

### Technical Gotchas
- *(Add environment-specific issues here)*

---

*Last updated: <!-- Add date -->*
