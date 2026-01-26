# Oroboreo Tests - Verification Scripts

This folder contains verification scripts that Claude creates to check if tasks are completed correctly.

## Two Types of Tests

### 1. **Session-Specific Tests** (in `tests/` root)
Tests created for the current session that verify specific features being built.

**Characteristics:**
- Verifies features specific to this session
- May contain hard-coded IDs, test data, or session names
- Archived to `archives/[session]/tests/` when session completes
- One-time use for this specific implementation

**Examples:**
- `verify-task-36-controlled-input.js` - Verifies a specific task fix
- `test-user-dashboard-redesign.js` - Tests dashboard changes
- `verify-calendar-migration.js` - Validates migration results

---

### 2. **Reusable Tests** (in `tests/reusable/`)
Generic tests that work across sessions and can be reused in future work.

**Characteristics:**
- Generic functionality (auth, API health, database validation)
- No hard-coded session-specific data
- Persists across sessions (not archived)
- Forms a growing library of verification scripts

**Examples:**
- `verify-auth.js` - Generic authentication check
- `check-api-health.js` - API endpoint health check
- `validate-db-schema.js` - Database schema validation
- `test-login-flow.js` - Generic login flow test

See [`reusable/README.md`](reusable/README.md) for more details.

---

## Rules for Claude

When creating verification scripts:

1. **Check `tests/reusable/` first** - Don't recreate existing tests
2. **Choose the right location:**
   - Generic functionality → `tests/reusable/`
   - Feature-specific → `tests/` (root)
3. **Tests must be executable scripts:**
   - ✅ Node.js scripts, bash scripts, curl requests, CLI tools
   - ❌ Manual browser testing (Claude can't open browsers)
4. **Good verification examples:**
   - `node tests/verify-auth.js` - Runs script to check auth
   - `curl http://localhost:3000/health` - API health check
   - `npm test -- --grep "auth"` - Run specific test suite
5. **Bad verification examples:**
   - "Open browser and manually test" - Claude can't do this
   - "Click the button and check UI" - Not scriptable

---

## What Happens During Archive

When a session completes (`oreo-run.js` finishes all tasks):

1. **Smart Analysis:** `oreo-archive.js` analyzes all tests in `tests/` root
2. **Reusable Detection:** Identifies generic tests (no task numbers, dates, hard-coded IDs)
3. **Reusable Tests:** Copied to `tests/reusable/` if not already there
4. **Session Tests:** Archived to `archives/[session]/tests/`
5. **Cleanup:** Session-specific tests removed from `tests/` root
6. **Persist:** `tests/reusable/` remains intact for future sessions

**Result:** You build a library of reusable tests over time while keeping session history!

---

## File Naming Conventions

### Reusable Tests (Generic)
- `verify-[feature].js` - Generic feature verification
- `check-[component].js` - Component health checks
- `validate-[entity].js` - Entity validation
- `test-[flow].js` - Generic user flow tests

### Session Tests (Specific)
- `verify-task-[number]-[description].js` - Task-specific verification
- `test-[specific-feature]-[session-context].js` - Feature with context
- `check-[component]-[session-name].js` - Component test for this session

---

## Example Workflow

```bash
# During a session, Claude creates tests:
tests/
  ├── verify-task-45-login-fix.js           # Session-specific
  ├── verify-task-46-api-rate-limit.js      # Session-specific
  └── check-api-health.js                   # Generic (should be reusable!)

# After session completes, oreo-archive.js analyzes:
# ✅ "check-api-health.js" is generic → Copy to tests/reusable/
# ✅ "verify-task-45-*" has task number → Archive to session
# ✅ "verify-task-46-*" has task number → Archive to session

# Result:
tests/
  └── reusable/
      └── check-api-health.js               # Now reusable for future!

archives/2026-01-20_session/
  └── tests/
      ├── verify-task-45-login-fix.js       # Archived
      └── verify-task-46-api-rate-limit.js  # Archived
```

---

## Integration with Oroboreo

- **`oreo-generate.js`:** Opus creates tasks with verification scripts
- **`oreo-run.js`:** Claude Code executes tasks and creates tests
- **`oreo-archive.js`:** Smart archival sorts reusable vs. session tests
- **`oreo-feedback.js`:** Opus references tests when generating fix tasks

---

🍪 **Built with Oroboreo - The Golden Loop**
