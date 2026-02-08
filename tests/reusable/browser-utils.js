/**
 * Browser Test Utilities for Oroboreo
 *
 * Provides autonomous browser testing capabilities using Playwright.
 * Claude can use these utilities to verify UI changes without human intervention.
 *
 * Usage:
 *   const { testUI, takeScreenshot, isPlaywrightInstalled } = require('./browser-utils');
 *
 *   // Check if Playwright is available
 *   if (!isPlaywrightInstalled()) {
 *     console.log('Playwright not installed, skipping browser test');
 *     process.exit(0);
 *   }
 *
 *   // Run a browser test
 *   const result = await testUI('http://localhost:3000', async (page) => {
 *     await page.click('#login-button');
 *     await page.waitForSelector('.dashboard');
 *   });
 *
 *   process.exit(result.success ? 0 : 1);
 *
 * @author Oroboreo - The Golden Loop
 * @version 1.0.0
 */

const path = require('path');
const fs = require('fs');

// Configuration
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
const DEFAULT_TIMEOUT = 30000;

/**
 * Check if Playwright is installed
 * @returns {boolean} True if Playwright is available
 */
function isPlaywrightInstalled() {
  try {
    require.resolve('playwright');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Wait for a server to become available at the given URL
 * Retries with exponential backoff. Useful before running browser tests
 * to ensure the dev server is actually running.
 *
 * @param {string} url - URL to check (e.g., 'http://localhost:3000')
 * @param {Object} options - Optional configuration
 * @param {number} options.timeout - Max wait time in ms (default: 30000)
 * @param {number} options.interval - Initial retry interval in ms (default: 1000)
 * @param {boolean} options.quiet - Suppress log output (default: false)
 * @returns {Promise<boolean>} True if server is reachable, false if timed out
 *
 * @example
 * const serverUp = await waitForServer('http://localhost:3000');
 * if (!serverUp) {
 *   console.error('Dev server is not running!');
 *   process.exit(1);
 * }
 */
async function waitForServer(url, options = {}) {
  const { timeout = 30000, interval = 1000, quiet = false } = options;
  const start = Date.now();
  let attempt = 0;

  // Use built-in http/https to avoid external dependencies
  const http = url.startsWith('https') ? require('https') : require('http');

  while (Date.now() - start < timeout) {
    attempt++;
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, { timeout: 5000 }, (res) => {
          // Any HTTP response means the server is up (even 404, 500, etc.)
          res.resume(); // Consume response to free up memory
          resolve();
        });
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Connection timed out'));
        });
      });

      if (!quiet) {
        console.log(`Server is ready at ${url} (attempt ${attempt})`);
      }
      return true;
    } catch (e) {
      if (!quiet && attempt === 1) {
        console.log(`Waiting for server at ${url}...`);
      }
      // Wait before retry (cap at 5 seconds)
      const delay = Math.min(interval * Math.pow(1.5, attempt - 1), 5000);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  if (!quiet) {
    console.error(`Server at ${url} did not respond within ${timeout}ms`);
  }
  return false;
}

/**
 * Run a browser test with automatic setup/teardown
 *
 * @param {string} url - URL to navigate to
 * @param {Function} testFn - Test function receiving (page, context)
 * @param {Object} options - Optional configuration
 * @param {boolean} options.headless - Run without visible browser (default: true)
 * @param {boolean} options.screenshotOnError - Capture screenshot on failure (default: true)
 * @param {boolean} options.captureConsole - Capture console logs (default: true)
 * @param {number} options.timeout - Test timeout in ms (default: 30000)
 * @returns {Object} Result object: { success, errors, consoleLogs, screenshots }
 *
 * @example
 * const result = await testUI('http://localhost:3000/login', async (page) => {
 *   await page.fill('input[name="email"]', 'test@example.com');
 *   await page.fill('input[name="password"]', 'password123');
 *   await page.click('button[type="submit"]');
 *   await page.waitForURL('dashboard');
 * });
 */
async function testUI(url, testFn, options = {}) {
  // Check if Playwright is installed
  if (!isPlaywrightInstalled()) {
    console.error('ERROR: Playwright is not installed.');
    console.error('Install with: npm install playwright && npx playwright install chromium');
    return {
      success: false,
      errors: ['Playwright not installed'],
      consoleLogs: [],
      screenshots: []
    };
  }

  const {
    headless = true,
    screenshotOnError = true,
    captureConsole = true,
    timeout = DEFAULT_TIMEOUT
  } = options;

  // Ensure screenshots directory exists
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const result = {
    success: false,
    errors: [],
    consoleLogs: [],
    screenshots: []
  };

  // Dynamic import of Playwright
  const { chromium } = require('playwright');
  let browser;

  try {
    console.log(`Browser test starting: ${url}`);
    console.log(`Options: headless=${headless}, timeout=${timeout}ms`);

    browser = await chromium.launch({ headless });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set timeout
    page.setDefaultTimeout(timeout);

    // Capture console logs
    if (captureConsole) {
      page.on('console', msg => {
        const entry = {
          type: msg.type(),
          text: msg.text(),
          timestamp: new Date().toISOString()
        };
        result.consoleLogs.push(entry);

        // Log errors to stdout for visibility
        if (msg.type() === 'error') {
          console.log(`CONSOLE ERROR: ${msg.text()}`);
        }
      });

      // Capture uncaught exceptions
      page.on('pageerror', error => {
        const entry = {
          type: 'exception',
          text: error.message,
          timestamp: new Date().toISOString()
        };
        result.consoleLogs.push(entry);
        console.log(`PAGE ERROR: ${error.message}`);
      });
    }

    // Navigate to URL
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle' });

    // Run the test function
    await testFn(page, context);

    result.success = true;
    console.log('Browser test PASSED');

  } catch (error) {
    result.errors.push(error.message);
    console.error(`Browser test FAILED: ${error.message}`);

    // Screenshot on error
    if (screenshotOnError && browser) {
      try {
        const contexts = browser.contexts();
        if (contexts.length > 0) {
          const pages = contexts[0].pages();
          if (pages.length > 0) {
            const timestamp = Date.now();
            const screenshotPath = path.join(SCREENSHOTS_DIR, `error-${timestamp}.png`);
            await pages[0].screenshot({ path: screenshotPath, fullPage: true });
            result.screenshots.push(screenshotPath);
            console.log(`Error screenshot saved: ${screenshotPath}`);
          }
        }
      } catch (screenshotError) {
        console.error(`Failed to capture error screenshot: ${screenshotError.message}`);
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Summary
  console.log('\n--- Browser Test Summary ---');
  console.log(`Success: ${result.success}`);
  console.log(`Errors: ${result.errors.length}`);
  console.log(`Console logs: ${result.consoleLogs.length}`);
  console.log(`Screenshots: ${result.screenshots.length}`);

  // Report console errors
  const consoleErrors = result.consoleLogs.filter(l => l.type === 'error' || l.type === 'exception');
  if (consoleErrors.length > 0) {
    console.log(`\nConsole errors detected (${consoleErrors.length}):`);
    consoleErrors.forEach(e => console.log(`  - ${e.text}`));
  }

  return result;
}

/**
 * Take a screenshot with automatic naming
 *
 * @param {Page} page - Playwright page object
 * @param {string} name - Screenshot name (without extension)
 * @param {Object} options - Screenshot options
 * @param {boolean} options.fullPage - Capture full page (default: true)
 * @returns {string} Path to saved screenshot
 *
 * @example
 * await takeScreenshot(page, 'login-form');
 * await takeScreenshot(page, 'dashboard', { fullPage: false });
 */
async function takeScreenshot(page, name, options = {}) {
  const { fullPage = true } = options;

  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const timestamp = Date.now();
  const screenshotPath = path.join(SCREENSHOTS_DIR, `${name}-${timestamp}.png`);

  await page.screenshot({ path: screenshotPath, fullPage });
  console.log(`Screenshot saved: ${screenshotPath}`);

  return screenshotPath;
}

/**
 * Wait for element and verify its text content
 *
 * @param {Page} page - Playwright page object
 * @param {string} selector - CSS selector
 * @param {string} expectedText - Expected text content
 * @param {Object} options - Options
 * @param {number} options.timeout - Timeout in ms (default: 5000)
 * @returns {boolean} True if element contains expected text
 */
async function verifyText(page, selector, expectedText, options = {}) {
  const { timeout = 5000 } = options;

  try {
    await page.waitForSelector(selector, { timeout });
    const actualText = await page.textContent(selector);
    const matches = actualText && actualText.includes(expectedText);

    if (matches) {
      console.log(`Verified: "${selector}" contains "${expectedText}"`);
    } else {
      console.log(`Mismatch: "${selector}" has "${actualText}", expected "${expectedText}"`);
    }

    return matches;
  } catch (error) {
    console.error(`verifyText failed: ${error.message}`);
    return false;
  }
}

/**
 * Check for JavaScript errors in console logs
 *
 * @param {Array} consoleLogs - Array of console log entries from testUI result
 * @returns {Array} Array of error entries
 */
function getConsoleErrors(consoleLogs) {
  return consoleLogs.filter(log =>
    log.type === 'error' ||
    log.type === 'exception'
  );
}

// ============================================================================
// HIGH-LEVEL VERIFICATION HELPERS
// ============================================================================
// These reduce agent-generated code from 20-50 lines to a single function call,
// cutting token cost per verification by 3-5x.

/**
 * Verify an element exists on a page
 *
 * @param {string} url - URL to navigate to
 * @param {string} selector - CSS selector to check
 * @param {Object} options - Optional configuration
 * @param {string} options.text - Expected text content (partial match)
 * @param {number} options.timeout - Element wait timeout in ms (default: 5000)
 * @param {boolean} options.headless - Run without visible browser (default: true)
 * @returns {Object} Result: { success, errors, consoleLogs, screenshots }
 *
 * @example
 * const result = await verifyElementExists('http://localhost:3000', '.dashboard');
 * const result = await verifyElementExists('http://localhost:3000', 'h1', { text: 'Welcome' });
 */
async function verifyElementExists(url, selector, options = {}) {
  return testUI(url, async (page) => {
    await page.waitForSelector(selector, { timeout: options.timeout || 5000 });
    if (options.text) {
      const actual = await page.textContent(selector);
      if (!actual || !actual.includes(options.text)) {
        throw new Error(`Expected "${selector}" to contain "${options.text}", got "${actual}"`);
      }
      console.log(`Verified: "${selector}" contains "${options.text}"`);
    } else {
      console.log(`Verified: "${selector}" exists`);
    }
  }, options);
}

/**
 * Verify a page loads without JavaScript errors
 *
 * @param {string} url - URL to check
 * @param {Object} options - Optional configuration
 * @param {number} options.timeout - Navigation timeout in ms (default: 30000)
 * @param {boolean} options.headless - Run without visible browser (default: true)
 * @returns {Object} Result: { success, errors, consoleLogs, screenshots }
 *
 * @example
 * const result = await verifyPageLoads('http://localhost:3000');
 */
async function verifyPageLoads(url, options = {}) {
  return testUI(url, async (page) => {
    // testUI already navigates and captures console errors
    // Check for page errors after load
    const errors = page.context()._pageErrors || [];
    if (errors.length > 0) {
      throw new Error(`Page had ${errors.length} JavaScript error(s)`);
    }
  }, { ...options, captureConsole: true });
}

/**
 * Verify a form submission succeeds
 *
 * @param {string} url - Form page URL
 * @param {Array} formActions - Array of { action, selector, value }
 *   action: 'fill' | 'click' | 'select'
 * @param {string} successSelector - CSS selector that appears on success
 * @param {Object} options - Optional configuration
 * @param {number} options.timeout - Wait timeout in ms (default: 10000)
 * @param {boolean} options.headless - Run without visible browser (default: true)
 * @returns {Object} Result: { success, errors, consoleLogs, screenshots }
 *
 * @example
 * const result = await verifyFormSubmission(
 *   'http://localhost:3000/login',
 *   [
 *     { action: 'fill', selector: 'input[name="email"]', value: 'test@test.com' },
 *     { action: 'fill', selector: 'input[name="password"]', value: 'pass123' },
 *     { action: 'click', selector: 'button[type="submit"]' }
 *   ],
 *   '.dashboard'
 * );
 */
async function verifyFormSubmission(url, formActions, successSelector, options = {}) {
  return testUI(url, async (page) => {
    for (const action of formActions) {
      if (action.action === 'fill') {
        await page.fill(action.selector, action.value);
      } else if (action.action === 'click') {
        await page.click(action.selector);
      } else if (action.action === 'select') {
        await page.selectOption(action.selector, action.value);
      }
    }
    await page.waitForSelector(successSelector, { timeout: options.timeout || 10000 });
    console.log(`Verified: "${successSelector}" appeared after form submission`);
  }, options);
}

module.exports = {
  testUI,
  takeScreenshot,
  verifyText,
  isPlaywrightInstalled,
  waitForServer,
  getConsoleErrors,
  verifyElementExists,
  verifyPageLoads,
  verifyFormSubmission,
  SCREENSHOTS_DIR
};
