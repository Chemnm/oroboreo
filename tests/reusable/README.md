# Reusable Tests - Generic Verification Scripts

This folder contains **generic, reusable verification scripts** that can be used across multiple sessions. These tests persist and form a growing library of validation tools for your project.

## What Makes a Test "Reusable"?

A test is reusable if it meets **ALL** of these criteria:

### ✅ Generic Functionality
- Tests core features that don't change (auth, API health, database integrity)
- Not specific to a single task or feature implementation
- Can be run repeatedly without modification

### ✅ No Hard-Coded Session Data
- No task numbers (`task-36`, `task-45`)
- No session names or timestamps
- No hard-coded test IDs or temporary data
- Uses configuration or environment variables instead

### ✅ Parameterized or Configurable
- Accepts inputs via command-line args, config files, or environment vars
- Can adapt to different scenarios without code changes
- Example: `node verify-auth.js --user=testuser` instead of hard-coded usernames

### ✅ Self-Contained
- Includes clear success/failure output
- Returns proper exit codes (0 = success, non-zero = failure)
- Has descriptive error messages

---

## Examples

### ✅ GOOD - Reusable Tests

```javascript
// tests/reusable/verify-auth.js
// Generic authentication verification - no hard-coded data

const username = process.env.TEST_USER || 'testuser';
const password = process.env.TEST_PASS || 'test123';

async function verifyAuth() {
  const response = await fetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });

  if (response.status === 200) {
    console.log('✓ Authentication works correctly');
    process.exit(0);
  } else {
    console.error('✗ Authentication failed');
    process.exit(1);
  }
}

verifyAuth();
```

**Why it's reusable:**
- Generic auth check (not specific to a feature)
- Uses environment variables (no hard-coded data)
- Clear success/failure output
- Can be used in any session that needs auth verification

---

```javascript
// tests/reusable/check-api-health.js
// Generic API health check

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function checkHealth() {
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();

    if (data.status === 'ok') {
      console.log('✓ API is healthy');
      process.exit(0);
    } else {
      console.error('✗ API health check failed:', data);
      process.exit(1);
    }
  } catch (error) {
    console.error('✗ API is unreachable:', error.message);
    process.exit(1);
  }
}

checkHealth();
```

**Why it's reusable:**
- Checks generic endpoint (`/health`)
- Configurable API URL
- Works across all sessions
- No session-specific logic

---

### ❌ BAD - Session-Specific Tests

```javascript
// tests/verify-task-36-fix.js
// Task 36: Fix controlled input in user dashboard

// This is NOT reusable because:
// ❌ Mentions "task 36" in filename
// ❌ Hard-coded test user ID
// ❌ Specific to this task's implementation
// ❌ Won't work in other sessions

const userId = 12345; // Hard-coded test data

async function verifyTask36() {
  const response = await fetch(`/api/users/${userId}/dashboard`);
  // ... task-specific logic ...
}
```

**Why it's NOT reusable:**
- Filename contains task number
- Hard-coded user ID
- Specific to one task's implementation
- This belongs in `tests/` root, not `tests/reusable/`

---

## File Naming Conventions

Use descriptive, generic names:

- `verify-[feature].js` - Feature verification
  - `verify-auth.js`, `verify-permissions.js`
- `check-[component].js` - Component health checks
  - `check-api-health.js`, `check-db-connection.js`
- `validate-[entity].js` - Data/schema validation
  - `validate-db-schema.js`, `validate-user-model.js`
- `test-[flow].js` - User flow tests
  - `test-login-flow.js`, `test-signup-flow.js`

**Avoid:**
- Task numbers: `verify-task-36-fix.js` ❌
- Session names: `test-dashboard-redesign.js` ❌
- Dates/timestamps: `check-api-2026-01-20.js` ❌
- Specific IDs: `verify-user-12345.js` ❌

---

## How Tests Get Here

### Automatic (Smart Archival)
When a session completes, `oreo-archive.js` analyzes all tests in `tests/` root:

1. **Filename Analysis:**
   - Doesn't contain: `task-\d+`, session names, dates
   - Uses generic patterns: `verify-*`, `check-*`, `validate-*`

2. **Content Analysis:**
   - No hard-coded IDs or session-specific strings
   - Uses environment variables or parameters
   - Generic functionality

3. **Decision:**
   - ✅ Reusable → Copy to `tests/reusable/`
   - ❌ Session-specific → Archive to `archives/[session]/tests/`

### Manual
You can also manually move tests here if:
- You refactor a session-specific test to be generic
- You create a new reusable test intentionally
- Archive identified it incorrectly

---

## Using Reusable Tests

### In New Sessions
When Claude creates verification for new tasks, it should:

1. **Check this folder first:** `ls tests/reusable/`
2. **Reuse existing tests:** `node tests/reusable/verify-auth.js`
3. **Only create new if needed:** No duplicate tests!

### In Task Verification
Include reusable tests in task verification steps:

```markdown
- [ ] **Task 5: Implement Login** [COMPLEX]
  - **Verification:**
    - Run existing: `node tests/reusable/verify-auth.js`
    - Check logs show successful login
```

### In Continuous Integration
Reusable tests form your regression test suite:

```bash
# Run all reusable tests
for test in tests/reusable/*.js; do
  node "$test" || exit 1
done
```

---

## Best Practices

1. **Document Requirements**
   - Add comments explaining what the test checks
   - Document required environment variables
   - Include usage examples

2. **Exit Codes**
   - Always use `process.exit(0)` for success
   - Always use `process.exit(1)` for failure
   - Never exit silently

3. **Clear Output**
   - Print what's being tested
   - Show pass/fail clearly
   - Include helpful error messages

4. **Configuration**
   - Use environment variables for URLs, ports, credentials
   - Provide sensible defaults
   - Never hard-code production credentials

5. **Keep It Simple**
   - One test = one concern
   - Fast execution (< 5 seconds ideal)
   - Minimal dependencies

---

## Example: Converting Session Test → Reusable

### Before (Session-Specific)
```javascript
// tests/verify-task-45-login-fix.js
const userId = 12345;
fetch(`/api/users/${userId}/login`);
```

### After (Reusable)
```javascript
// tests/reusable/verify-auth.js
const userId = process.env.TEST_USER_ID || '1';
const endpoint = process.env.AUTH_ENDPOINT || '/api/login';
fetch(endpoint);
```

**Changes:**
1. Removed task number from filename
2. Made user ID configurable
3. Made endpoint configurable
4. Now works for any auth verification!

---

## Browser Testing with Playwright

Oroboreo supports autonomous browser testing using Playwright. This allows Claude to verify UI changes without human intervention.

### Setup

```bash
# Install Playwright (optional dependency)
npm install playwright

# Install browser binaries (Chromium recommended)
npx playwright install chromium
```

### Using browser-utils.js

The `browser-utils.js` module provides utilities for autonomous UI testing:

```javascript
const { testUI, takeScreenshot, isPlaywrightInstalled } = require('./browser-utils');

// Always check if Playwright is installed first
if (!isPlaywrightInstalled()) {
  console.log('Playwright not installed, skipping browser test');
  process.exit(0);
}

// Run a browser test
(async () => {
  const result = await testUI('http://localhost:3000/login', async (page) => {
    // Fill form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');

    // Click submit
    await page.click('button[type="submit"]');

    // Verify redirect to dashboard
    await page.waitForURL('**/dashboard');
  });

  // Check for console errors
  const consoleErrors = result.consoleLogs.filter(l => l.type === 'error');
  if (consoleErrors.length > 0) {
    console.error('Console errors detected:', consoleErrors);
  }

  process.exit(result.success ? 0 : 1);
})();
```

### API Reference

#### `testUI(url, testFn, options)`
Main test runner with automatic browser setup/teardown.

**Options:**
- `headless: true` - Run without visible browser (default)
- `captureConsole: true` - Capture console logs (default)
- `screenshotOnError: true` - Screenshot on failure (default)
- `timeout: 30000` - Test timeout in ms (default)

**Returns:** `{ success, errors, consoleLogs, screenshots }`

#### `takeScreenshot(page, name, options)`
Take a screenshot during a test.

```javascript
await testUI('http://localhost:3000', async (page) => {
  await takeScreenshot(page, 'homepage');
  await page.click('#login');
  await takeScreenshot(page, 'login-form');
});
```

#### `isPlaywrightInstalled()`
Check if Playwright is available before running tests.

#### `verifyText(page, selector, expectedText)`
Wait for element and verify its text content.

### Best Practices for Browser Tests

1. **Always check prerequisites**
   ```javascript
   if (!isPlaywrightInstalled()) {
     console.log('Skipping: Playwright not installed');
     process.exit(0);
   }
   ```

2. **Use appropriate selectors**
   - Prefer `data-testid` attributes: `[data-testid="submit-btn"]`
   - Use semantic selectors: `button[type="submit"]`
   - Avoid fragile selectors: `.btn-primary` (may change)

3. **Handle async operations**
   ```javascript
   // Wait for navigation
   await page.waitForURL('**/dashboard');

   // Wait for element
   await page.waitForSelector('.success-message');

   // Wait for network idle
   await page.waitForLoadState('networkidle');
   ```

4. **Capture evidence**
   ```javascript
   // Screenshot on important steps
   await takeScreenshot(page, 'before-submit');
   await page.click('#submit');
   await takeScreenshot(page, 'after-submit');
   ```

5. **Check console errors**
   ```javascript
   const errors = result.consoleLogs.filter(l => l.type === 'error');
   if (errors.length > 0) {
     console.error('JavaScript errors found!');
     process.exit(1);
   }
   ```

### Screenshots

Screenshots are saved to `tests/screenshots/` (gitignored). They include:
- Error screenshots (automatic on test failure)
- Manual screenshots via `takeScreenshot()`

---

🍪 **Built with Oroboreo - The Golden Loop**
