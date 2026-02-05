#!/usr/bin/env node
/**
 * OREO-FEEDBACK - The Architect Agent (PRD Generator)
 *
 * This script bridges human feedback to the autonomous loop. When you find
 * issues during manual testing, describe them in human-feedback.md and run
 * this script. It spawns Opus (the architect) to:
 *
 *   1. ANALYZE your feedback
 *   2. REVIEW the latest archive for context
 *   3. UPDATE cookie-crumbs.md with new fix tasks
 *
 * The architect DOES NOT fix code - it only writes tasks for oreo-run.js
 * to execute.
 *
 * ============================================================================
 * FILE REFERENCES (Oreo Theme)
 * ============================================================================
 *
 * | File               | Purpose                                            |
 * |--------------------|---------------------------------------------------|
 * | human-feedback.md  | YOUR INPUT - describe issues here                 |
 * | cookie-crumbs.md   | Task list - architect appends new tasks here      |
 * | creme-filling.md   | System rules - architect reads these              |
 * | archives/          | Historical sessions - architect reviews latest    |
 * | costs.json | Cost tracking - architect costs logged here       |
 *
 * ============================================================================
 * USAGE
 * ============================================================================
 *
 *   # Option 1: Write feedback to human-feedback.md first
 *   node oroboreo/utils/oreo-feedback.js
 *
 *   # Option 2: Pass feedback as argument
 *   node oroboreo/utils/oreo-feedback.js "The login button doesn't work"
 *
 * ============================================================================
 * WORKFLOW
 * ============================================================================
 *
 *   1. You test the app manually
 *   2. You find issues
 *   3. You write issues in human-feedback.md (or pass as arg)
 *   4. Run: node oroboreo/utils/oreo-feedback.js
 *   5. Architect (Opus) analyzes and creates tasks
 *   6. Run: node oroboreo/utils/oreo-run.js to execute fixes
 *
 * @author Oroboreo- The Golden Loop
 * @version 1.0.0
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getModelConfig, clearProviderEnv, getFoundryResource, hasFoundryConfig, getPaths, COST_FACTORS } = require('./oreo-config.js');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Opus Model (The Architect) - will be set after loading env
  model: null,

  // Token limits
  maxOutputTokens: null,
  thinkingBudget: null,

  // File Paths (Oreo Theme)
  paths: {
    ...getPaths(),                                               // Shared paths (includes feedback)
    prompt: path.join(process.cwd(), 'oroboreo', '.architect-prompt.txt')  // Temp prompt
  }
};

// ============================================================================
// UTILITIES
// ============================================================================

function loadEnv() {
  // Load .env from user's project directory (process.cwd()/oroboreo/.env)
  // This works for both NPM install and cloned repo scenarios
  const envFile = path.join(process.cwd(), 'oroboreo', '.env');

  if (fs.existsSync(envFile)) {
    const content = fs.readFileSync(envFile, 'utf8');
    content.split('\n').forEach(line => {
      // Skip comments and empty lines
      if (line.trim().startsWith('#') || !line.trim()) return;

      const [key, ...value] = line.split('=');
      if (key && value.length > 0) {
        process.env[key.trim()] = value.join('=').trim();
      }
    });
    return true;
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
    console.log('Creating ~/.aws directory...');
    fs.mkdirSync(awsDir, { recursive: true });
  }

  // Write credentials file
  const region = process.env.AWS_REGION || 'us-east-1';
  const credentialsContent = `[default]
aws_access_key_id = ${process.env.AWS_ACCESS_KEY_ID}
aws_secret_access_key = ${process.env.AWS_SECRET_ACCESS_KEY}
region = ${region}
`;

  console.log('Creating ~/.aws/credentials from .env values...');
  fs.writeFileSync(credentialsFile, credentialsContent, { mode: 0o600 });
  console.log('AWS credentials file created successfully');
}

function logArchitectCost(promptSize, responseSize) {
  // Agentic sessions involve many turns of tool usage (reading files, searching)
  // which aren't captured in the final output buffer. Apply multipliers.
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
    taskId: 'ARCHITECT',
    taskTitle: 'Architect Feedback Analysis',
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

  console.log(`\n💰 Architect Cost: $${totalCost.toFixed(4)}`);
  console.log(`   (Estimated: ${inputTokens} input, ${outputTokens} output tokens)`);
  console.log(`💡 Note: Architect sessions include hidden costs for codebase analysis.`);
}

function getLatestArchive() {
  if (!fs.existsSync(CONFIG.paths.archives)) return null;

  // Find all archives recursively in year/month structure
  const allArchives = [];

  function scanDirectory(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // Check if this looks like an archive (contains cookie-crumbs.md or progress.txt)
          const hasArchiveFiles = fs.existsSync(path.join(fullPath, 'cookie-crumbs.md')) ||
                                   fs.existsSync(path.join(fullPath, 'progress.txt'));
          if (hasArchiveFiles) {
            allArchives.push({ name: entry.name, path: fullPath });
          } else {
            // Recurse into subdirectories (year/month folders)
            scanDirectory(fullPath);
          }
        }
      }
    } catch (e) {}
  }

  scanDirectory(CONFIG.paths.archives);

  if (allArchives.length === 0) return null;

  // Sort by full path descending (year/month/name) - most recent first
  // Path structure: archives/YYYY/MM/DD-HH-MM-SS-sessionName
  allArchives.sort((a, b) => b.path.localeCompare(a.path));

  return allArchives[0];
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('');
  console.log('===============================================================================');
  console.log('OROBOREO ARCHITECT - Feedback to Tasks');
  console.log('===============================================================================');
  console.log('');

  // Load environment
  if (!loadEnv()) {
    console.log('⚠️  No .env file found in oroboreo directory');
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
  console.log(`🤖 AI Provider: ${provider}`);
  console.log('');

  if (provider === 'bedrock') {
    // Validate AWS credentials
    if (!process.env.AWS_ACCESS_KEY_ID) {
      console.error('❌ AWS_ACCESS_KEY_ID not set! Please configure oroboreo/.env');
      process.exit(1);
    }
    process.env.CLAUDE_CODE_USE_BEDROCK = '1';
    process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  } else if (provider === 'foundry') {
    // Validate Microsoft Foundry credentials
    if (!process.env.ANTHROPIC_FOUNDRY_API_KEY) {
      console.error('❌ ANTHROPIC_FOUNDRY_API_KEY not set! Please configure oroboreo/.env');
      process.exit(1);
    }
    if (!hasFoundryConfig()) {
      console.error('❌ No Foundry resource configured! Set ANTHROPIC_FOUNDRY_RESOURCE or per-model resources (ANTHROPIC_FOUNDRY_RESOURCE_OPUS, etc.)');
      process.exit(1);
    }
    process.env.CLAUDE_CODE_USE_FOUNDRY = '1';
  } else if (provider === 'anthropic') {
    // Validate Anthropic API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ ANTHROPIC_API_KEY not set! Please configure oroboreo/.env');
      process.exit(1);
    }
  } else if (provider === 'subscription') {
    // Claude Code Subscription - no validation needed
    // User must have run: npx @anthropic-ai/claude-code login
    console.log('💡 Using Claude Code Subscription (ensure you have run: npx @anthropic-ai/claude-code login)');
  } else {
    console.error(`❌ Invalid AI_PROVIDER: ${provider}. Valid options: bedrock, foundry, anthropic, subscription`);
    process.exit(1);
  }

  // Get feedback from argument or file
  let feedback = process.argv[2];

  if (!feedback && fs.existsSync(CONFIG.paths.feedback)) {
    const content = fs.readFileSync(CONFIG.paths.feedback, 'utf8');

    // Check if user actually pasted something (beyond template)
    if (content.includes('[Paste your feedback here]') || content.length < 100) {
      console.log('⚠️  human-feedback.md seems to contain only the template.');
    } else {
      console.log('📝 Reading feedback from human-feedback.md');
      feedback = content;
    }
  }

  if (!feedback) {
    console.error('❌ No feedback found!');
    console.error('');
    console.error('Usage:');
    console.error('  1. Write your feedback in oroboreo/human-feedback.md');
    console.error('  2. Run: oro-feedback');
    console.error('');
    console.error('Or pass feedback directly:');
    console.error('  oro-feedback "The login button is broken"');
    process.exit(1);
  }

  // Find latest archive for context
  const latestArchive = getLatestArchive();
  if (latestArchive) {
    const relativePath = path.relative(CONFIG.paths.projectRoot, latestArchive.path);
    console.log(`📁 Reference Archive: ${relativePath}`);
  } else {
    console.log('📁 No previous archives found');
  }

  // Load project context from creme-filling.md
  let projectContext = '';
  if (fs.existsSync(CONFIG.paths.rules)) {
    projectContext = fs.readFileSync(CONFIG.paths.rules, 'utf8');
    console.log('📋 Loaded system rules from creme-filling.md');
  } else {
    console.log('⚠️  creme-filling.md not found - run oreo-init.js first');
  }

  // Construct architect prompt
  const architectPrompt = `
You are the **Lead Architect** for this project.

**SYSTEM RULES (from creme-filling.md):**
${projectContext || 'No system rules loaded.'}

---

A human tester has reported the following issues during manual testing:

"""
${feedback}
"""

**YOUR MISSION**

1. **Analyze**: Use tools to explore the codebase and find the root cause.

2. **Context**: ${latestArchive
    ? `The latest session archive is at \`${latestArchive.path}\`. Check the cookie-crumbs.md (or PRD.md) and progress.txt there to see what was recently changed.`
    : 'No previous archive found.'}

3. **Update Tasks**: Append NEW tasks to \`oroboreo/cookie-crumbs.md\` to fix these issues.
   - If cookie-crumbs.md is empty or missing, create a new one with this header format:
     \`\`\`markdown
     **Session**: human-feedback-fixes
     **Created**: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}
     **Status**: Ready for execution
     \`\`\`
   - Session name should be descriptive but NOT include dates/timestamps
   - Tag tasks as [SIMPLE], [COMPLEX], or [CRITICAL].
   - Include a "🕵️ Human UI Verification" section at the end.

**STRICT RULES**

- **Do NOT fix the code yourself.**
- Only update cookie-crumbs.md with instructions for the worker agents.
- Focus on making the fix clear and actionable.
- Identify exactly which files should be modified.
- **CRITICAL:** Verification MUST use scripts/automation - Claude cannot open browsers or manually test UI

**TASK FORMAT**

Use this format for each task:

\`\`\`markdown
- [ ] **Task N: Title** [SIMPLE|COMPLEX|CRITICAL]
  - **Objective:** What needs to be accomplished
  - **Files:** List files to modify
  - **Details:**
    - Step 1
    - Step 2
  - **Verification:** How to verify it works (MUST use scripts, NOT manual browser testing)
\`\`\`

**VERIFICATION CONSTRAINTS**

- Verification MUST use: test scripts, build commands, CLI tools, curl requests, log inspection, or **browser-utils.js**
- Examples of GOOD verification: "Run \`npm test\`", "Execute \`node scripts/verify-fix.js\`", "Check logs show correct output"
- Examples of BAD verification: "Open browser and manually check UI", "Manually test the button", "Visually inspect the page"
- All verification should be executable by Claude Code (no manual GUI interaction)

**BROWSER TESTING (for UI fixes)**

- For UI-related fixes, use \`oroboreo/tests/reusable/browser-utils.js\` for autonomous browser testing
- Browser tests run headless and can verify UI changes without human intervention
- Always check \`isPlaywrightInstalled()\` before generating browser tests
- Example: "Run \`node oroboreo/tests/verify-button-fix.js\`" (uses browser-utils.js to test UI)

**IMPORTANT**

After adding tasks, include this section at the end:

\`\`\`markdown
## 🕵️ Human UI Verification

After all tasks complete, the human should verify:
- [ ] Issue 1 is fixed
- [ ] Issue 2 is fixed
- [ ] No regressions introduced
\`\`\`
`;

  // Save prompt
  fs.writeFileSync(CONFIG.paths.prompt, architectPrompt);

  // Run Opus - use .sh on Linux/macOS, .bat on Windows
  const isWindows = process.platform === 'win32';
  const runScript = isWindows ? 'run-with-prompt.bat' : 'run-with-prompt.sh';
  const batFile = path.join(__dirname, runScript);

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
    console.log(`🚀 Spawning Architect (Opus via Bedrock: ${CONFIG.model.id})...`);

  } else if (provider === 'foundry') {
    // Microsoft Foundry - Set Foundry-specific vars
    // oreo-feedback always uses Opus
    const foundryConfig = getFoundryResource('OPUS');

    env.ANTHROPIC_MODEL = CONFIG.model.id;
    env.CLAUDE_CODE_USE_FOUNDRY = '1';
    env.ANTHROPIC_FOUNDRY_API_KEY = process.env.ANTHROPIC_FOUNDRY_API_KEY;

    // Use model-specific resource/URL (with fallback to single resource)
    if (foundryConfig.resource) {
      env.ANTHROPIC_FOUNDRY_RESOURCE = foundryConfig.resource;
    }
    if (foundryConfig.baseUrl) {
      env.ANTHROPIC_FOUNDRY_BASE_URL = foundryConfig.baseUrl;
    }
    console.log(`🚀 Spawning Architect (Opus via Microsoft Foundry: ${foundryConfig.resource || foundryConfig.baseUrl})...`);

  } else if (provider === 'anthropic') {
    // Anthropic API - Set ONLY API key (no ANTHROPIC_MODEL)
    env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    console.log(`🚀 Spawning Architect (Opus via Anthropic API: ${CONFIG.model.id})...`);

  } else if (provider === 'subscription') {
    // Claude Code Subscription - Set NO auth variables
    // Claude Code will use logged-in claude.ai account
    console.log(`🚀 Spawning Architect (Opus via Claude Subscription: ${CONFIG.model.id})...`);

  } else {
    console.error(`❌ Invalid AI_PROVIDER: ${provider}`);
    console.error('Valid options: bedrock, foundry, anthropic, subscription');
    process.exit(1);
  }

  console.log('');

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
    if (code === 0) {
      const promptContent = fs.readFileSync(CONFIG.paths.prompt, 'utf8');
      logArchitectCost(promptContent.length, outputBuffer.length);

      console.log('');
      console.log('===============================================================================');
      console.log('✅ Architect complete! Tasks added to cookie-crumbs.md');
      console.log('===============================================================================');
      console.log('');
      console.log('Next step:');
      console.log('  oro-run');
      console.log('');
    } else {
      console.error(`\n❌ Architect exited with code ${code}`);
    }
  });

  child.on('error', (err) => {
    console.error(`\n❌ Failed to spawn architect: ${err.message}`);
    process.exit(1);
  });
}

main().catch(e => {
  console.error('Fatal Error:', e.message);
  process.exit(1);
});
