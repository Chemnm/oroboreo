#!/usr/bin/env node
/**
 * verify-ui.js - CLI Runner for Browser Verification
 *
 * Zero-script browser verification for Oroboreo agents. Instead of generating
 * a full test script, agents can run a single command line:
 *
 *   node oroboreo/tests/reusable/verify-ui.js --url http://localhost:3000 --selector ".dashboard"
 *
 * This reduces token cost per verification by 3-5x compared to generating
 * a full JavaScript test file.
 *
 * ============================================================================
 * USAGE
 * ============================================================================
 *
 *   # Check element exists
 *   node verify-ui.js --url http://localhost:3000 --selector ".dashboard"
 *
 *   # Check element contains text
 *   node verify-ui.js --url http://localhost:3000 --selector "h1" --text "Welcome"
 *
 *   # Check page loads without JS errors
 *   node verify-ui.js --url http://localhost:3000 --check-errors
 *
 *   # Form: fill fields, click submit, verify result
 *   node verify-ui.js --url http://localhost:3000/login \
 *     --fill 'input[name="email"]=test@test.com' \
 *     --fill 'input[name="password"]=pass123' \
 *     --click 'button[type="submit"]' \
 *     --selector ".dashboard"
 *
 *   # Set custom timeout (ms)
 *   node verify-ui.js --url http://localhost:3000 --selector ".slow-element" --timeout 15000
 *
 * EXIT CODES:
 *   0 = verification passed
 *   1 = verification failed
 *   2 = missing arguments or Playwright not installed
 *
 * @author Oroboreo - The Golden Loop
 * @version 1.0.0
 */

const { isPlaywrightInstalled, waitForServer, verifyElementExists, verifyPageLoads, verifyFormSubmission } = require('./browser-utils');

// ============================================================================
// ARGUMENT PARSING
// ============================================================================

function parseArgs(argv) {
  const args = {
    url: null,
    selector: null,
    text: null,
    checkErrors: false,
    waitForServer: false,
    serverTimeout: null,
    fills: [],
    clicks: [],
    selects: [],
    timeout: null
  };

  let i = 2; // Skip 'node' and script path
  while (i < argv.length) {
    const arg = argv[i];

    switch (arg) {
      case '--url':
        args.url = argv[++i];
        break;
      case '--selector':
        args.selector = argv[++i];
        break;
      case '--text':
        args.text = argv[++i];
        break;
      case '--check-errors':
        args.checkErrors = true;
        break;
      case '--fill': {
        // Format: 'selector=value'
        const fillArg = argv[++i];
        const eqIndex = fillArg.indexOf('=');
        if (eqIndex === -1) {
          console.error(`Invalid --fill format: "${fillArg}". Expected: 'selector=value'`);
          process.exit(2);
        }
        args.fills.push({
          action: 'fill',
          selector: fillArg.substring(0, eqIndex),
          value: fillArg.substring(eqIndex + 1)
        });
        break;
      }
      case '--click':
        args.clicks.push({
          action: 'click',
          selector: argv[++i]
        });
        break;
      case '--select': {
        // Format: 'selector=value'
        const selectArg = argv[++i];
        const selectEqIndex = selectArg.indexOf('=');
        if (selectEqIndex === -1) {
          console.error(`Invalid --select format: "${selectArg}". Expected: 'selector=value'`);
          process.exit(2);
        }
        args.selects.push({
          action: 'select',
          selector: selectArg.substring(0, selectEqIndex),
          value: selectArg.substring(selectEqIndex + 1)
        });
        break;
      }
      case '--wait-for-server':
        args.waitForServer = true;
        break;
      case '--server-timeout':
        args.serverTimeout = parseInt(argv[++i], 10);
        break;
      case '--timeout':
        args.timeout = parseInt(argv[++i], 10);
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        printHelp();
        process.exit(2);
    }
    i++;
  }

  return args;
}

function printHelp() {
  console.log(`
verify-ui.js - CLI Browser Verification for Oroboreo

Usage:
  node verify-ui.js --url URL [options]

Options:
  --url URL              Page URL to navigate to (required)
  --selector SELECTOR    CSS selector to verify exists
  --text TEXT            Expected text content (used with --selector)
  --check-errors         Verify page loads without JS errors
  --fill 'SEL=VALUE'     Fill a form field (repeatable)
  --click SELECTOR       Click an element (repeatable)
  --select 'SEL=VALUE'   Select dropdown option (repeatable)
  --wait-for-server      Wait for server to be reachable before testing
  --server-timeout MS    Max time to wait for server (default: 30000)
  --timeout MS           Custom timeout in milliseconds
  --help, -h             Show this help

Examples:
  node verify-ui.js --url http://localhost:3000 --selector ".dashboard"
  node verify-ui.js --url http://localhost:3000 --selector "h1" --text "Welcome"
  node verify-ui.js --url http://localhost:3000 --check-errors
  node verify-ui.js --url http://localhost:3000/login \\
    --fill 'input[name="email"]=test@test.com' \\
    --click 'button[type="submit"]' \\
    --selector ".success"
  `);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  // Check Playwright first
  if (!isPlaywrightInstalled()) {
    console.error('Playwright is not installed.');
    console.error('Install with: npm install playwright && npx playwright install chromium');
    process.exit(2);
  }

  const args = parseArgs(process.argv);

  // Validate required args
  if (!args.url) {
    console.error('Missing required --url argument');
    printHelp();
    process.exit(2);
  }

  // Wait for server if requested
  if (args.waitForServer) {
    const serverOpts = {};
    if (args.serverTimeout) serverOpts.timeout = args.serverTimeout;
    const serverUp = await waitForServer(args.url, serverOpts);
    if (!serverUp) {
      console.error(`Server at ${args.url} is not reachable. Is your dev server running?`);
      console.error('Start it with the appropriate command (e.g., npm run dev, npm start)');
      process.exit(1);
    }
  }

  const hasFormActions = args.fills.length > 0 || args.clicks.length > 0 || args.selects.length > 0;

  // Must have at least one verification mode
  if (!args.selector && !args.checkErrors && !hasFormActions) {
    console.error('Must specify at least one of: --selector, --check-errors, or form actions (--fill/--click)');
    printHelp();
    process.exit(2);
  }

  const options = {};
  if (args.timeout) options.timeout = args.timeout;

  let result;

  if (hasFormActions && args.selector) {
    // Form submission mode: fill/click/select then verify selector
    const formActions = [...args.fills, ...args.selects, ...args.clicks];
    result = await verifyFormSubmission(args.url, formActions, args.selector, options);

  } else if (args.selector) {
    // Element verification mode
    if (args.text) options.text = args.text;
    result = await verifyElementExists(args.url, args.selector, options);

  } else if (args.checkErrors) {
    // Page load verification mode
    result = await verifyPageLoads(args.url, options);
  }

  process.exit(result.success ? 0 : 1);
}

main().catch(err => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(2);
});
