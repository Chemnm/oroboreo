#!/usr/bin/env node
/**
 * OREO-GENERATE - New Feature Task Generator
 *
 * This script generates NEW tasks for a fresh feature. Unlike oreo-feedback.js
 * (which generates FIX tasks from issues), this is for starting something new.
 *
 * Uses Claude Opus 4.5 with extended thinking to create comprehensive
 * task breakdowns with complexity tags.
 *
 * ============================================================================
 * FILE REFERENCES (Oreo Theme)
 * ============================================================================
 *
 * | File               | Purpose                                            |
 * |--------------------|---------------------------------------------------|
 * | cookie-crumbs.md   | Task list - Opus writes new tasks here            |
 * | creme-filling.md   | System rules - Opus reads project context         |
 * | tests/             | Session-specific verification scripts (archived)  |
 * | tests/reusable/    | Generic tests reused across sessions               |
 * | archives/          | Previous sessions - archived before new PRD       |
 *
 * ============================================================================
 * USAGE
 * ============================================================================
 *
 *   # Interactive mode
 *   node oroboreo/utils/oreo-generate.js
 *
 *   # With feature description
 *   node oroboreo/utils/oreo-generate.js "Add user authentication with JWT"
 *
 *   # From file (new-prompt.md in orboreo/ directory)
 *   # Create new-prompt.md with feature description, then run:
 *   node oroboreo/utils/oreo-generate.js
 *   # Script will ask if you want to use the file
 *   # After generation, new-prompt.md is archived and cleared
 *
 * ============================================================================
 * DIFFERENCE FROM OREO-FEEDBACK.JS
 * ============================================================================
 *
 *   oreo-generate.js  → NEW features (fresh start)
 *   oreo-feedback.js  → FIX issues (uses archive context)
 *
 * @author Oroboreo- The Golden Loop
 * @version 1.0.0
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { getModelConfig, clearProviderEnv, getPaths, COLORS, COST_FACTORS } = require('./oreo-config.js');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  model: null,  // Will be set after loading env
  maxOutputTokens: null,
  thinkingBudget: null,
  paths: {
    ...getPaths(__dirname),
    prompt: path.join(__dirname, '.generate-prompt.txt')
  }
};

const colors = COLORS;

function log(msg, color = 'reset') {
  console.log(colors[color] + msg + colors.reset);
}

function question(prompt) {
  return new Promise(resolve => rl.question(colors.cyan + prompt + colors.reset, resolve));
}

// ============================================================================
// UTILITIES
// ============================================================================

function loadEnv() {
  // Check multiple locations for .env file
  // __dirname is utils/, so go up one level to find oroboreo/.env
  const locations = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', 'bedrock', '.env')
  ];

  for (const envFile of locations) {
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, 'utf8');
      content.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value.length > 0) {
          process.env[key.trim()] = value.join('=').trim();
        }
      });
      return true;
    }
  }
  return false;
}

/**
 * Ensures AWS credentials file exists for SDK fallback
 * Creates ~/.aws/credentials from environment variables if it doesn't exist
 * This makes Oroboreo work without AWS CLI installed
 */
function ensureAwsCredentialsFile() {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const awsDir = path.join(homeDir, '.aws');
  const credentialsFile = path.join(awsDir, 'credentials');

  // Only proceed if we have AWS credentials in env and provider is bedrock
  const provider = (process.env.AI_PROVIDER || 'subscription').toLowerCase();
  if (provider !== 'bedrock') return;

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return; // No credentials to write
  }

  // Check if credentials file already exists
  if (fs.existsSync(credentialsFile)) {
    return;
  }

  // Create ~/.aws directory if needed
  if (!fs.existsSync(awsDir)) {
    log('Creating ~/.aws directory...', 'cyan');
    fs.mkdirSync(awsDir, { recursive: true });
  }

  // Write credentials file
  const region = process.env.AWS_REGION || 'us-east-1';
  const credentialsContent = `[default]
aws_access_key_id = ${process.env.AWS_ACCESS_KEY_ID}
aws_secret_access_key = ${process.env.AWS_SECRET_ACCESS_KEY}
region = ${region}
`;

  log('Creating ~/.aws/credentials from .env values...', 'cyan');
  fs.writeFileSync(credentialsFile, credentialsContent, { mode: 0o600 });
  log('AWS credentials file created successfully', 'green');
}

function archiveExistingTasks() {
  if (!fs.existsSync(CONFIG.paths.tasks)) return null;

  const content = fs.readFileSync(CONFIG.paths.tasks, 'utf8');

  // Extract session name to check if it's a template
  const sessionMatch = content.match(/\*\*Session\*\*:\s*(.+)/i);
  const sessionName = sessionMatch ? sessionMatch[1].trim() : '';

  // Skip archiving if it's just a template:
  // 1. No tasks at all
  // 2. Session name is template placeholder or empty or contains HTML comment
  // 3. Contains only example tasks (Task 1: Example Task)
  const hasTasks = content.includes('- [ ]') || content.includes('- [x]');
  const isTemplateName = sessionName === 'my-feature-name' ||
                         sessionName.includes('<!--') ||
                         sessionName === '';
  const hasExampleTask = content.includes('Task 1: Example Task') ||
                         content.includes('Task 1: Title');

  if (!hasTasks || isTemplateName || hasExampleTask) {
    log('Skipping archive - cookie-crumbs.md contains template or no real tasks', 'yellow');
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const archivePath = path.join(CONFIG.paths.archives, `${timestamp}_pre-generate`);

  fs.mkdirSync(archivePath, { recursive: true });
  fs.copyFileSync(CONFIG.paths.tasks, path.join(archivePath, 'cookie-crumbs.md'));

  // Also copy progress.txt if it exists
  const progressPath = path.join(__dirname, 'progress.txt');
  if (fs.existsSync(progressPath)) {
    fs.copyFileSync(progressPath, path.join(archivePath, 'progress.txt'));
  }

  // Also copy new-prompt.md if it exists
  const newPromptPath = path.join(CONFIG.paths.projectRoot, 'new-prompt.md');
  if (fs.existsSync(newPromptPath)) {
    fs.copyFileSync(newPromptPath, path.join(archivePath, 'new-prompt.md'));
    log('Archived new-prompt.md', 'green');
  }

  log(`Archived existing tasks to: archives/${timestamp}_pre-generate/`, 'green');
  return archivePath;
}

function logOpusCost(promptSize, responseSize) {
  const inputTokens = Math.ceil((promptSize / 4) * COST_FACTORS.ARCHITECT.TOOL_USE_FACTOR) + COST_FACTORS.ARCHITECT.BASELINE_CONTEXT_TOKENS;
  const outputTokens = Math.ceil((responseSize / 4) * COST_FACTORS.ARCHITECT.OUTPUT_MULTIPLIER);

  const inputCost = (inputTokens * CONFIG.model.inputCost) / 1000000;
  const outputCost = (outputTokens * CONFIG.model.outputCost) / 1000000;
  const totalCost = inputCost + outputCost;

  let costLog = { session: { totalCost: 0 }, tasks: [] };
  if (fs.existsSync(CONFIG.paths.costs)) {
    try {
      costLog = JSON.parse(fs.readFileSync(CONFIG.paths.costs, 'utf8'));
    } catch (e) {}
  }

  costLog.tasks.push({
    taskId: 'GENERATE',
    taskTitle: 'Generate New Feature Tasks',
    timestamp: new Date().toISOString(),
    model: CONFIG.model.name,
    modelId: CONFIG.model.id,
    provider: (process.env.AI_PROVIDER || 'subscription').toLowerCase(),
    inputTokens,
    outputTokens,
    totalCostUSD: totalCost
  });

  costLog.session.totalCost = (costLog.session.totalCost || 0) + totalCost;
  fs.writeFileSync(CONFIG.paths.costs, JSON.stringify(costLog, null, 2));

  log(`\nGenerate Cost: $${totalCost.toFixed(4)}`, 'magenta');
  log(`(Estimated: ${inputTokens} input, ${outputTokens} output tokens)`, 'cyan');
}

// ============================================================================
// PRD GENERATION
// ============================================================================

function buildGeneratePrompt(feature, context) {
  return `You are an expert product manager and software architect. Create a comprehensive task breakdown for the following feature:

**Feature Request:** ${feature}

**Project Context:**
${context || 'No project context available.'}

---

## PHASE 1: DISCOVERY (Explore First)

**IMPORTANT: Before writing any tasks, you MUST explore the codebase.**

- You have access to tools (\`read_file\`, \`list_files\`, \`grep\`, etc.).
- USE THEM NOW to explore the codebase.
- Find the relevant files (e.g., if updating UI, find where components are defined; if updating API, find existing endpoints).
- Understand the *current state* before planning changes.
- **Do not write code changes yet.** Just gather intelligence.

Once you understand the scope, proceed to Phase 2.

---

## PHASE 2: PLANNING (Write the PRD)

Create a detailed task list and write it to \`oroboreo/cookie-crumbs.md\`.

### Requirements

1. **Session Header**
   Start the file with this exact format:
   \`\`\`markdown
   **Session**: descriptive-feature-name
   **Created**: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}
   **Status**: Ready for execution
   \`\`\`
   - Session name should be descriptive but NOT include dates/timestamps
   - Examples: "add-user-authentication", "redesign-dashboard", "optimize-queries"

2. **Title & Overview**
   - Clear, concise title for the feature
   - 2-3 sentence summary

3. **Task Breakdown (8-15 tasks)**
   Each task must follow this EXACT format:

   \`\`\`markdown
   - [ ] **Task N: Title** [COMPLEXITY]
     - **Objective:** What needs to be done
     - **Files:** Which files to modify
     - **Details:**
       - Step 1
       - Step 2
     - **Verification:** How to verify it works (MUST use scripts, NOT manual browser testing)
   \`\`\`

4. **Complexity Tags**
   - **[SIMPLE]** = Straightforward (Haiku $1/$5) - UI updates, docs, simple fixes
   - **[COMPLEX]** = Requires thinking (Sonnet $3/$15) - API, database, architecture
   - **[CRITICAL]** = Mission-critical (Sonnet $3/$15) - Security, migrations

5. **Test Organization**
   - **Check \`oroboreo/tests/reusable/\` first** for existing verification scripts
   - **Reusable tests** (\`oroboreo/tests/reusable/\`): Generic, no hard-coded IDs, works across sessions
     - Examples: verify-auth.js, check-api-health.js, validate-db-schema.js
   - **Session tests** (\`oroboreo/tests/\`): Feature-specific, will be archived after session
     - Examples: verify-task-36-fix.js, test-dashboard-redesign.js

6. **Browser Testing (for UI Verification)**
   - For UI tasks, use \`oroboreo/tests/reusable/browser-utils.js\` for autonomous browser testing
   - Browser tests run headless and capture console errors automatically
   - Always check \`isPlaywrightInstalled()\` before using browser features
   - Example browser verification script:
     \`\`\`javascript
     // tests/verify-login-ui.js
     const { testUI, isPlaywrightInstalled } = require('./reusable/browser-utils');

     if (!isPlaywrightInstalled()) {
       console.log('Playwright not installed, skipping browser test');
       process.exit(0);
     }

     (async () => {
       const result = await testUI('http://localhost:3000/login', async (page) => {
         await page.fill('input[name="email"]', 'test@example.com');
         await page.click('button[type="submit"]');
         await page.waitForSelector('.dashboard');
       });
       process.exit(result.success ? 0 : 1);
     })();
     \`\`\`

7. **Human UI Verification Section**
   End with a checklist for manual verification that the HUMAN will perform after all tasks complete.

### Output Format

Write directly to \`oroboreo/cookie-crumbs.md\` using clear markdown.

**CRITICAL CONSTRAINTS:**
- **Verification MUST use scripts** - Claude cannot manually interact with browsers
- **Check \`tests/reusable/\` before creating new tests** - Don't duplicate existing verification scripts
- Verification should use: test scripts, build commands, CLI tools, curl requests, log inspection, or **browser-utils.js for UI testing**
- Examples of GOOD verification:
  - "Run \`node oroboreo/tests/reusable/verify-auth.js\`" (reuse existing)
  - "Execute \`node oroboreo/tests/verify-task-5-login.js\`" (new session-specific test)
  - "Run \`node oroboreo/tests/verify-login-ui.js\`" (browser test using browser-utils.js)
  - "Check logs show correct output"
- Examples of BAD verification: "Open browser and manually check UI", "Manually test the button", "Visually inspect the page"
- **For UI verification:** Use browser-utils.js to create automated browser tests that run headless
- Create **reusable tests** for generic functionality, **session tests** for feature-specific verification
- Each task should be achievable in one focused session
- If a task feels too large, break it into smaller sub-tasks
- Be specific about which files to modify
- Include clear success criteria that can be automated
`;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  log('\n===============================================================================', 'yellow');
  log('OROBOREO GENERATE - New Feature Tasks', 'bright');
  log('===============================================================================\n', 'yellow');

  // Load environment
  if (!loadEnv()) {
    log('No .env file found', 'yellow');
  }

  // Ensure AWS credentials file exists (for SDK fallback when AWS CLI not installed)
  ensureAwsCredentialsFile();

  // Set up provider-aware models
  const MODELS = getModelConfig();
  CONFIG.model = MODELS.OPUS;
  CONFIG.maxOutputTokens = String(MODELS.OPUS.maxOutput);
  CONFIG.thinkingBudget = String(MODELS.OPUS.maxThinking);

  // Configure provider-specific settings
  const provider = (process.env.AI_PROVIDER || 'subscription').toLowerCase();
  log(`AI Provider: ${provider}\n`);

  if (provider === 'bedrock') {
    // Validate AWS credentials
    if (!process.env.AWS_ACCESS_KEY_ID) {
      log('AWS_ACCESS_KEY_ID not set! Please configure oroboreo/.env', 'yellow');
      process.exit(1);
    }
    process.env.CLAUDE_CODE_USE_BEDROCK = '1';
    process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  } else if (provider === 'foundry') {
    // Validate Microsoft Foundry credentials
    if (!process.env.ANTHROPIC_FOUNDRY_API_KEY) {
      log('ANTHROPIC_FOUNDRY_API_KEY not set! Please configure oroboreo/.env', 'yellow');
      process.exit(1);
    }
    if (!process.env.ANTHROPIC_FOUNDRY_RESOURCE && !process.env.ANTHROPIC_FOUNDRY_BASE_URL) {
      log('ANTHROPIC_FOUNDRY_RESOURCE or ANTHROPIC_FOUNDRY_BASE_URL not set! Please configure oroboreo/.env', 'yellow');
      process.exit(1);
    }
    process.env.CLAUDE_CODE_USE_FOUNDRY = '1';
  } else if (provider === 'anthropic') {
    // Validate Anthropic API key
    if (!process.env.ANTHROPIC_API_KEY) {
      log('ANTHROPIC_API_KEY not set! Please configure oroboreo/.env', 'yellow');
      process.exit(1);
    }
  } else if (provider === 'subscription') {
    // Claude Code Subscription - no validation needed
    // User must have run: npx @anthropic-ai/claude-code login
    log('Using Claude Code Subscription (ensure you have run: npx @anthropic-ai/claude-code login)\n');
  } else {
    log(`Invalid AI_PROVIDER: ${provider}. Valid options: bedrock, foundry, anthropic, subscription`, 'yellow');
    process.exit(1);
  }

  // Get feature description
  let feature = process.argv[2];

  if (!feature) {
    // Check if new-prompt.md exists in project root
    const newPromptPath = path.join(CONFIG.paths.projectRoot, 'oroboreo', 'new-prompt.md');

    if (fs.existsSync(newPromptPath)) {
      log('Found new-prompt.md in oroboreo/', 'green');
      const useFile = await question('Use new-prompt.md for feature description? (y/n): ');

      if (useFile.toLowerCase() === 'y' || useFile.toLowerCase() === 'yes') {
        feature = fs.readFileSync(newPromptPath, 'utf8').trim();
        log(`\nLoaded feature description from new-prompt.md (${feature.length} chars)`, 'cyan');
      } else {
        log('\nDescribe the feature you want to build:\n', 'cyan');
        feature = await question('> ');
      }
    } else {
      log('Describe the feature you want to build:\n', 'cyan');
      feature = await question('> ');
    }
  }

  if (!feature.trim()) {
    log('\nFeature description is required!', 'yellow');
    process.exit(1);
  }

  log(`\nFeature: ${feature}`, 'green');

  // Load project context
  let context = '';
  if (fs.existsSync(CONFIG.paths.rules)) {
    context = fs.readFileSync(CONFIG.paths.rules, 'utf8');
    log('Loaded context from creme-filling.md', 'green');
  } else {
    log('creme-filling.md not found - run oreo-init.js first', 'yellow');
  }

  // Archive existing tasks
  if (fs.existsSync(CONFIG.paths.tasks)) {
    log('\nArchiving existing tasks...', 'cyan');
    archiveExistingTasks();
  }

  // Generate with Opus
  log('\nSpawning Opus 4.5 to generate tasks...', 'cyan');
  log('(This may take 30-60 seconds)\n', 'yellow');

  const prompt = buildGeneratePrompt(feature, context);
  fs.writeFileSync(CONFIG.paths.prompt, prompt);

  const batFile = path.join(__dirname, 'run-with-prompt.bat');

  // Clear ALL provider environment variables first
  clearProviderEnv();

  const env = {
    ...process.env,  // Start fresh after clearProviderEnv()
    CLAUDE_CODE_MAX_OUTPUT_TOKENS: CONFIG.maxOutputTokens,
    CLAUDE_CODE_MAX_THINKING_TOKENS: CONFIG.thinkingBudget,
    FORCE_COLOR: '1'
  };

  // Provider-specific configuration
  if (provider === 'bedrock') {
    // AWS Bedrock - Set Bedrock-specific vars
    env.ANTHROPIC_MODEL = CONFIG.model.id;
    env.CLAUDE_CODE_USE_BEDROCK = '1';
    env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
    env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
    env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
    log('Spawning via Bedrock...\n');

  } else if (provider === 'foundry') {
    // Microsoft Foundry - Set Foundry-specific vars
    env.ANTHROPIC_MODEL = CONFIG.model.id;
    env.CLAUDE_CODE_USE_FOUNDRY = '1';
    env.ANTHROPIC_FOUNDRY_API_KEY = process.env.ANTHROPIC_FOUNDRY_API_KEY;
    // Use resource name or base URL (one or the other)
    if (process.env.ANTHROPIC_FOUNDRY_RESOURCE) {
      env.ANTHROPIC_FOUNDRY_RESOURCE = process.env.ANTHROPIC_FOUNDRY_RESOURCE;
    }
    if (process.env.ANTHROPIC_FOUNDRY_BASE_URL) {
      env.ANTHROPIC_FOUNDRY_BASE_URL = process.env.ANTHROPIC_FOUNDRY_BASE_URL;
    }
    log('Spawning via Microsoft Foundry...\n');

  } else if (provider === 'anthropic') {
    // Anthropic API - Set ONLY API key (no ANTHROPIC_MODEL)
    env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    log('Spawning via Anthropic API...\n');

  } else if (provider === 'subscription') {
    // Claude Code Subscription - Set NO auth variables
    // Claude Code will use logged-in claude.ai account
    log('Spawning via Claude Subscription...\n');

  } else {
    log(`Invalid AI_PROVIDER: ${provider}`, 'yellow');
    log('Valid options: bedrock, foundry, anthropic, subscription', 'yellow');
    process.exit(1);
  }

  let outputBuffer = '';

  const child = spawn(batFile, [CONFIG.paths.prompt], {
    env,
    cwd: CONFIG.paths.projectRoot,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (data) => {
    process.stdout.write(data);
    outputBuffer += data.toString();
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(data);
    outputBuffer += data.toString();
  });

  child.on('exit', (code) => {
    rl.close();

    if (code === 0) {
      const promptContent = fs.readFileSync(CONFIG.paths.prompt, 'utf8');
      logOpusCost(promptContent.length, outputBuffer.length);

      // Count tasks
      if (fs.existsSync(CONFIG.paths.tasks)) {
        const taskContent = fs.readFileSync(CONFIG.paths.tasks, 'utf8');
        const taskMatches = taskContent.match(/- \[ \] \*\*Task \d+:/g);
        const taskCount = taskMatches ? taskMatches.length : 0;

        log('\n===============================================================================', 'yellow');
        log('TASKS GENERATED!', 'bright');
        log('===============================================================================\n', 'yellow');
        log(`Tasks Created: ${taskCount}`, 'green');
        log(`Location: oroboreo/cookie-crumbs.md`, 'cyan');

        // Clear new-prompt.md if it was used (archived earlier)
        const newPromptPath = path.join(CONFIG.paths.projectRoot, 'new-prompt.md');
        if (fs.existsSync(newPromptPath)) {
          fs.writeFileSync(newPromptPath, '');
          log('Cleared new-prompt.md (archived in session folder)', 'cyan');
        }

        log('\nNext step:', 'bright');
        log('  node oroboreo/utils/oreo-run.js\n', 'magenta');
      }
    } else {
      log(`\nGeneration failed (exit code ${code})`, 'yellow');
    }
  });

  child.on('error', (err) => {
    rl.close();
    log(`\nFailed to spawn: ${err.message}`, 'yellow');
    process.exit(1);
  });
}

main().catch(err => {
  console.error('Error:', err.message);
  rl.close();
  process.exit(1);
});
