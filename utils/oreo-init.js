#!/usr/bin/env node
/**
 * OREO-INIT - Project Discovery & Setup
 *
 * This script initializes Oroboreoin your project by:
 *   1. Discovering your project structure
 *   2. Creating creme-filling.md (system rules)
 *   3. Setting up the archive structure
 *   4. Configuring AWS Bedrock credentials
 *
 * ============================================================================
 * FILE REFERENCES (Oreo Theme)
 * ============================================================================
 *
 * | File               | Purpose                                            |
 * |--------------------|---------------------------------------------------|
 * | creme-filling.md   | System rules created by this script               |
 * | cookie-crumbs.md   | Task list (created empty, you fill it)            |
 * | .env               | AWS credentials (from .env.example)               |
 * | archives/          | Historical sessions                               |
 *
 * ============================================================================
 * USAGE
 * ============================================================================
 *
 *   node oroboreo/utils/oreo-init.js
 *
 * This will:
 *   - Scan your project structure
 *   - Ask about your project's Universal Laws
 *   - Generate creme-filling.md with your project DNA
 *   - Optionally configure AWS Bedrock credentials
 *
 * @author Oroboreo- The Golden Loop
 * @version 1.0.0
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { getModelConfig, clearProviderEnv, getPaths, syncReusableUtils, COLORS, COST_FACTORS } = require('./oreo-config.js');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Opus Model (best reasoning for project analysis) - will be set after loading env
  model: null,
  maxOutputTokens: null,
  thinkingBudget: null,
  paths: {
    ...getPaths(),                                               // Shared paths from user's project
    prompt: path.join(process.cwd(), 'oroboreo', '.init-prompt.txt')
  }
};

// Colors for terminal output
const colors = COLORS;

function log(msg, color = 'reset') {
  console.log(colors[color] + msg + colors.reset);
}

function question(prompt) {
  return new Promise(resolve => rl.question(colors.cyan + prompt + colors.reset, resolve));
}

// ============================================================================
// AWS BEDROCK UTILITIES
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

function logInitCost(promptSize, responseSize) {
  const inputTokens = Math.ceil((promptSize / 4) * COST_FACTORS.INIT.TOOL_USE_FACTOR) + COST_FACTORS.INIT.BASELINE_CONTEXT_TOKENS;
  const outputTokens = Math.ceil((responseSize / 4) * COST_FACTORS.INIT.OUTPUT_MULTIPLIER);

  const inputCost = (inputTokens * CONFIG.model.inputCost) / 1000000;
  const outputCost = (outputTokens * CONFIG.model.outputCost) / 1000000;
  const totalCost = inputCost + outputCost;

  let costLog = { session: { startTime: new Date().toISOString(), totalCost: 0 }, tasks: [] };
  if (fs.existsSync(CONFIG.paths.costs)) {
    try {
      costLog = JSON.parse(fs.readFileSync(CONFIG.paths.costs, 'utf8'));
    } catch (e) {}
  }

  costLog.tasks.push({
    taskId: 'INIT',
    taskTitle: 'AI Project Analysis',
    timestamp: new Date().toISOString(),
    model: CONFIG.model.name,
    modelId: CONFIG.model.id,
    provider: (process.env.AI_PROVIDER || 'bedrock').toLowerCase(),
    inputTokens,
    outputTokens,
    totalCostUSD: totalCost
  });

  costLog.session.totalCost = (costLog.session.totalCost || 0) + totalCost;
  fs.writeFileSync(CONFIG.paths.costs, JSON.stringify(costLog, null, 2));

  log(`\nInit Cost: $${totalCost.toFixed(4)}`, 'magenta');
  log(`(Estimated: ${inputTokens} input, ${outputTokens} output tokens)`, 'cyan');
}

function buildInitPrompt(projectRoot, projectContext, fileStructure) {
  const projectName = path.basename(projectRoot);

  return `You are initializing Oroboreofor the project "${projectName}".

**PROJECT CONTEXT:**
${projectContext || 'No documentation found. Analyze the codebase directly.'}

**FILE STRUCTURE SUMMARY:**
- Total Files: ${fileStructure.totalFiles}
- Total Directories: ${fileStructure.totalDirs}
- Key Files: ${fileStructure.keyFiles.join(', ') || 'None detected'}
- Key Directories: ${fileStructure.directories.slice(0, 10).join(', ') || 'None'}

---

## YOUR MISSION

Analyze this project and create \`oroboreo/creme-filling.md\` with comprehensive system rules.

### Steps

1. **Explore the codebase** - Read key files like package.json, README.md, tsconfig.json, etc.
2. **Identify frameworks and patterns** - What tech stack is used? What architectural patterns?
3. **Discover constraints** - What rules should NEVER be violated?
4. **Generate Universal Laws** - Create 5-10 specific rules for this project

### Output Format

Write directly to \`oroboreo/creme-filling.md\` with this structure:

\`\`\`markdown
# Creme Filling - System Rules

## Project: ${projectName.toUpperCase()}

[2-3 sentence project description based on your analysis]

---

## Universal Laws (NEVER VIOLATE)

1. **[Specific rule]** - Why this matters
2. **[Specific rule]** - Why this matters
... (5-10 rules)

---

## Technology Stack

- **Framework:** [detected]
- **Language:** [detected]
- **Database:** [if any]
- **Testing:** [if any]

---

## File Structure

### Key Directories
- \`src/\` - [purpose]
- ...

### Key Files
- \`package.json\` - [relevant info]
- ...

---

## Shared Memory (Learnings)

### What Works Well
- *(To be filled as you learn)*

### Common Pitfalls
- *(To be filled as you learn)*

### Technical Notes
- *(Environment-specific gotchas)*

---

*Generated by OroboreoAI Analysis*
*Powered by Claude Opus 4.6*
\`\`\`

**IMPORTANT:**
- Be SPECIFIC to this project, not generic
- Base rules on actual code you read
- Focus on what could break the project if violated
`;
}

async function runAIAnalysis(projectRoot, projectContext, fileStructure) {
  log('\nSpawning Opus 4.6 for intelligent project analysis...', 'cyan');
  log('(This may take 30-60 seconds)\n', 'yellow');

  const prompt = buildInitPrompt(projectRoot, projectContext, fileStructure);
  fs.writeFileSync(CONFIG.paths.prompt, prompt);

  // Use .sh on Linux/macOS, .bat on Windows
  const isWindows = process.platform === 'win32';
  const runScript = isWindows ? 'run-with-prompt.bat' : 'run-with-prompt.sh';
  const batFile = path.join(__dirname, runScript);

  // Clear ALL provider environment variables first
  clearProviderEnv();

  const provider = (process.env.AI_PROVIDER || 'subscription').toLowerCase();

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
    console.log(`${COLORS.cyan}🚀 Spawning via Bedrock: ${CONFIG.model.id}...${COLORS.reset}`);

  } else if (provider === 'anthropic') {
    // Anthropic API - Set ONLY API key (no ANTHROPIC_MODEL)
    env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    console.log(`${COLORS.cyan}🚀 Spawning via Anthropic API: ${CONFIG.model.id}...${COLORS.reset}`);

  } else if (provider === 'subscription') {
    // Claude Code Subscription - Set NO auth variables
    // Claude Code will use logged-in claude.ai account
    console.log(`${COLORS.cyan}🚀 Spawning via Claude Subscription: ${CONFIG.model.id}...${COLORS.reset}`);

  } else {
    console.error(`${COLORS.yellow}❌ Invalid AI_PROVIDER: ${provider}${COLORS.reset}`);
    console.error('Valid options: bedrock, anthropic, subscription');
    process.exit(1);
  }

  return new Promise((resolve, reject) => {
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
        logInitCost(promptContent.length, outputBuffer.length);
        resolve(true);
      } else {
        reject(new Error(`AI analysis exited with code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  log('\n===============================================================================', 'yellow');
  log('OROBOREO INITIALIZATION', 'bright');
  log('===============================================================================\n', 'yellow');

  const projectRoot = process.cwd();
  const oroborosDir = path.join(projectRoot, 'oroboreo');

  log(`Project Root: ${projectRoot}`, 'cyan');
  log(`Oroboreo Dir: ${oroborosDir}\n`, 'cyan');

  // Ensure oroboreo directory exists
  if (!fs.existsSync(oroborosDir)) {
    fs.mkdirSync(oroborosDir, { recursive: true });
    log(`Created: ${oroborosDir}`, 'green');
  }

  // Copy .env.example to user's oroboreo directory if it doesn't exist
  const userEnvExample = path.join(oroborosDir, '.env.example');
  const packageEnvExample = path.join(__dirname, '..', '.env.example');
  if (!fs.existsSync(userEnvExample) && fs.existsSync(packageEnvExample)) {
    fs.copyFileSync(packageEnvExample, userEnvExample);
    log(`Copied: .env.example`, 'green');
  }

  // Load AWS credentials if available
  const hasEnv = loadEnv();

  // Ensure AWS credentials file exists (for SDK fallback when AWS CLI not installed)
  ensureAwsCredentialsFile();

  // Set up provider-aware models
  const MODELS = getModelConfig();
  CONFIG.model = MODELS.OPUS;
  CONFIG.maxOutputTokens = String(MODELS.OPUS.maxOutput);
  CONFIG.thinkingBudget = String(MODELS.OPUS.maxThinking);

  // Configure provider-specific settings
  const provider = (process.env.AI_PROVIDER || 'bedrock').toLowerCase();

  // Step 1: Check for existing project documentation
  log('STEP 1: Project Discovery', 'bright');
  log('─────────────────────────────────────────────────────────────\n', 'yellow');

  const possibleDocs = [
    path.join(projectRoot, 'docs', 'claude.md'),
    path.join(projectRoot, 'docs', 'README.md'),
    path.join(projectRoot, 'docs', 'ARCHITECTURE.md'),
    path.join(projectRoot, 'README.md')
  ];

  let existingDoc = null;
  for (const docPath of possibleDocs) {
    if (fs.existsSync(docPath)) {
      existingDoc = docPath;
      log(`Found: ${path.relative(projectRoot, docPath)}`, 'green');
      break;
    }
  }

  let projectContext = '';
  if (!existingDoc) {
    log('No project documentation found (README.md, docs/claude.md, etc.)', 'yellow');
    log('\nPlease describe your project in a few sentences:', 'cyan');
    projectContext = await question('> ');
  } else {
    log(`\nReading project context from ${path.basename(existingDoc)}...`, 'cyan');
    projectContext = fs.readFileSync(existingDoc, 'utf8').slice(0, 5000); // First 5000 chars
  }

  // Step 2: Analyze file structure
  log('\n\nSTEP 2: Mapping File Structure', 'bright');
  log('─────────────────────────────────────────────────────────────\n', 'yellow');

  const fileStructure = analyzeFileStructure(projectRoot);
  log(`Mapped ${fileStructure.totalFiles} files in ${fileStructure.totalDirs} directories`, 'green');

  // Step 3: Choose analysis method (AI or Manual)
  log('\n\nSTEP 3: Generate System Rules', 'bright');
  log('─────────────────────────────────────────────────────────────\n', 'yellow');

  let useAI = false;
  let hasCredentials = false;

  if (provider === 'bedrock') {
    hasCredentials = hasEnv && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
    if (hasCredentials) {
      process.env.CLAUDE_CODE_USE_BEDROCK = '1';
      process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
      log('AWS Bedrock credentials detected!', 'green');
      log('AI analysis will read your code and generate intelligent rules.', 'cyan');
      log('Cost: ~$0.30-0.80 (one-time, using Opus 4.6)\n', 'yellow');
    } else {
      log('AWS Bedrock credentials missing.', 'yellow');
      log('Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in oroboreo/.env\n', 'cyan');
    }
  } else if (provider === 'anthropic') {
    hasCredentials = hasEnv && process.env.ANTHROPIC_API_KEY;
    if (hasCredentials) {
      log('Anthropic API key detected!', 'green');
      log('AI analysis will read your code and generate intelligent rules.', 'cyan');
      log('Cost: ~$0.30-0.80 (one-time, using Opus 4.6)\n', 'yellow');
    } else {
      log('Anthropic API key missing.', 'yellow');
      log('Set ANTHROPIC_API_KEY in oroboreo/.env\n', 'cyan');
    }
  } else if (provider === 'subscription') {
    // For subscription, we assume user has logged in with: npx @anthropic-ai/claude-code login
    // We can't easily check if they're logged in, so we'll assume credentials exist
    hasCredentials = true;
    log('Using Claude Code Subscription!', 'green');
    log('AI analysis will read your code and generate intelligent rules.', 'cyan');
    log('Note: Ensure you have run: npx @anthropic-ai/claude-code login', 'yellow');
    log('Cost: Uses your Claude subscription limits (one-time analysis)\n', 'yellow');
  } else {
    log(`Unknown AI_PROVIDER: ${provider}`, 'yellow');
    log('Valid options: bedrock, anthropic, subscription\n', 'cyan');
  }

  if (hasCredentials) {
    const aiChoice = await question('Use AI analysis? (yes/no, default: yes): ');
    useAI = aiChoice.toLowerCase() !== 'no' && aiChoice.toLowerCase() !== 'n';
  } else {
    log(`No ${provider} credentials found - using manual setup.`, 'yellow');
    log(`To enable AI analysis, configure oroboreo/.env with ${provider === 'bedrock' ? 'AWS credentials' : 'ANTHROPIC_API_KEY'} first.\n`, 'cyan');
  }

  if (useAI) {
    // AI-powered analysis
    try {
      await runAIAnalysis(projectRoot, projectContext, fileStructure);
      log('\nAI analysis complete! creme-filling.md created.', 'green');
    } catch (err) {
      log(`\nAI analysis failed: ${err.message}`, 'yellow');
      log('Falling back to manual setup...\n', 'cyan');
      useAI = false;
    }
  }

  if (!useAI) {
    // Manual setup (original flow)
    log('\nDefining Universal Laws manually...', 'cyan');

    const laws = await defineUniversalLaws(projectContext);

    const cremeFillingContent = generateCremeFillingFile({
      projectContext,
      fileStructure,
      laws,
      projectRoot
    });

    const cremeFillingPath = path.join(oroborosDir, 'creme-filling.md');
    fs.writeFileSync(cremeFillingPath, cremeFillingContent, 'utf8');
    log(`Created: creme-filling.md`, 'green');
  }

  // Step 4: Ensure cookie-crumbs.md exists
  log('\n\nSTEP 4: Creating Task List Template', 'bright');
  log('─────────────────────────────────────────────────────────────\n', 'yellow');

  const cookieCrumbsPath = path.join(oroborosDir, 'cookie-crumbs.md');
  if (!fs.existsSync(cookieCrumbsPath)) {
    fs.writeFileSync(cookieCrumbsPath, getEmptyCookieCrumbsTemplate(), 'utf8');
    log(`Created: cookie-crumbs.md (empty template)`, 'green');
  } else {
    log('cookie-crumbs.md already exists - skipping', 'cyan');
  }

  // Step 5: Setup test structure and reusable utilities
  log('\n\nSTEP 5: Creating Test Structure', 'bright');
  log('─────────────────────────────────────────────────────────────\n', 'yellow');

  syncReusableUtils();
  log(`Synced: tests/reusable/ (browser-utils.js, READMEs)`, 'green');

  // Step 6: Setup archive structure
  log('\n\nSTEP 6: Creating Archive Structure', 'bright');
  log('─────────────────────────────────────────────────────────────\n', 'yellow');

  const archiveDir = path.join(oroborosDir, 'archives');
  fs.mkdirSync(archiveDir, { recursive: true });
  log(`Created: archives/`, 'green');

  // Step 7: Provider configuration (if not already done)
  if (!hasCredentials) {
    const providerName = provider === 'anthropic' ? 'Anthropic API' : 'AWS Bedrock';
    log(`\n\nSTEP 7: ${providerName} Configuration`, 'bright');
    log('─────────────────────────────────────────────────────────────\n', 'yellow');

    const configureProvider = await question(`Configure ${providerName} credentials now? (yes/no): `);

    if (configureProvider.toLowerCase() === 'yes' || configureProvider.toLowerCase() === 'y') {
      await setupBedrock(oroborosDir);
    } else {
      log(`Skipping ${providerName} setup`, 'yellow');
      log('Run: cp .env.example .env  and fill in your credentials', 'cyan');
    }
  }

  // Complete!
  log('\n\n===============================================================================', 'yellow');
  log('OROBOREO INITIALIZATION COMPLETE!', 'bright');
  log('===============================================================================\n', 'yellow');

  log('Next Steps:', 'cyan');
  log('  1. Review oroboreo/creme-filling.md (your project rules)', 'reset');
  log('  2. Add tasks to oroboreo/cookie-crumbs.md', 'reset');
  log('  3. Run: oro-run (to execute tasks)', 'reset');
  log('\nWelcome to the Golden Loop!\n', 'magenta');

  rl.close();
}

// ============================================================================
// HELPERS
// ============================================================================

function analyzeFileStructure(targetDir) {
  const structure = {
    directories: [],
    keyFiles: [],
    totalFiles: 0,
    totalDirs: 0
  };

  function scan(dir, depth = 0, maxDepth = 3) {
    if (depth > maxDepth) return;

    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        // Skip common non-essential directories
        if (['node_modules', '.git', '.next', 'dist', 'build', '__pycache__', 'oroboreo'].includes(item)) continue;

        const fullPath = path.join(dir, item);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
          structure.totalDirs++;
          const relativePath = path.relative(targetDir, fullPath);
          structure.directories.push(relativePath);
          scan(fullPath, depth + 1, maxDepth);
        } else {
          structure.totalFiles++;
          // Track key files
          const basename = path.basename(item);
          if (['package.json', 'tsconfig.json', 'next.config.js', 'vite.config.js', 'requirements.txt', 'Cargo.toml'].includes(basename)) {
            structure.keyFiles.push(path.relative(targetDir, fullPath));
          }
        }
      }
    } catch (e) {
      // Ignore permission errors
    }
  }

  scan(targetDir);
  return structure;
}

async function defineUniversalLaws(projectContext) {
  log('These are core constraints that must NEVER be broken.\n', 'cyan');
  log('Examples:', 'yellow');
  log('  - Never expose database credentials in frontend code', 'reset');
  log('  - All API routes must use authentication middleware', 'reset');
  log('  - Database queries must use parameterized statements\n', 'reset');

  // Suggest laws based on detected context
  const suggestedLaws = [
    'Never hardcode secrets or credentials',
    'Test before marking tasks complete',
    'Document important learnings in progress.txt'
  ];

  const contextLower = (projectContext || '').toLowerCase();

  if (contextLower.includes('react') || contextLower.includes('next') || contextLower.includes('vue')) {
    suggestedLaws.push('Use TypeScript for all new components');
  }

  if (contextLower.includes('api') || contextLower.includes('backend') || contextLower.includes('express')) {
    suggestedLaws.push('All API endpoints must validate input');
  }

  log('Suggested Universal Laws:\n', 'bright');
  suggestedLaws.forEach((law, i) => {
    log(`  ${i + 1}. ${law}`, 'cyan');
  });

  log('\nAdd custom laws (comma-separated) or press Enter to accept:', 'yellow');
  const customLaws = await question('> ');

  return customLaws.trim()
    ? customLaws.split(',').map(l => l.trim())
    : suggestedLaws;
}

function generateCremeFillingFile({ projectContext, fileStructure, laws, projectRoot }) {
  const projectName = path.basename(projectRoot);
  const timestamp = new Date().toISOString();

  return `# Creme Filling - System Rules

<!--
============================================================================
CREME-FILLING.MD - The System Rules (like AGENTS.md)
============================================================================

Generated by oreo-init.js on ${timestamp}

This file contains the "laws" that all agents must follow. It's injected
into every Claude Code instance spawned by oreo-run.js.

============================================================================
-->

## Project: ${projectName.toUpperCase()}

${projectContext ? projectContext.slice(0, 2000) : 'Project context will be added here.'}

---

## Universal Laws (NEVER VIOLATE)

${laws.map((law, i) => `${i + 1}. **${law}**`).join('\n')}

---

## File Structure

### Key Directories
${fileStructure.directories.slice(0, 15).map(dir => `- \`${dir}/\``).join('\n') || '- *(Run oreo-init.js to populate)*'}

### Key Files
${fileStructure.keyFiles.map(file => `- \`${file}\``).join('\n') || '- *(Run oreo-init.js to populate)*'}

**Total:** ${fileStructure.totalFiles} files in ${fileStructure.totalDirs} directories

---

## Shared Memory (Learnings)

### What Works Well
- *(Add successful patterns here)*

### Common Pitfalls
- *(Add learnings as you discover them)*

### Technical Notes
- *(Environment-specific gotchas)*

---

*Generated: ${timestamp}*
*Powered by Oroboreo- The Golden Loop*
`;
}

function getEmptyCookieCrumbsTemplate() {
  return `# Cookie Crumbs - Task List

<!--
============================================================================
COOKIE-CRUMBS.MD - The Task List (like PRD.md)
============================================================================

Add your tasks below. Use oreo-run.js to execute them.

TASK FORMAT:
  - [ ] **Task N: Title** [SIMPLE|COMPLEX|CRITICAL]
    - **Objective:** What needs to be done
    - **Files:** Which files to modify
    - **Verification:** How to verify it works

============================================================================
-->

**Session**: my-first-session
**Created**: ${new Date().toISOString().slice(0, 10)}

---

## Tasks

- [ ] **Task 1: Your first task** [SIMPLE]
  - **Objective:** Describe what needs to be done
  - **Files:** \`src/example.js\`
  - **Verification:** How to verify it works

---

## Human UI Verification

After all tasks complete:
- [ ] Feature works as expected
- [ ] No regressions introduced
`;
}

async function setupBedrock(oroborosDir) {
  log('\nAWS Bedrock Configuration\n', 'bright');

  const awsAccessKey = await question('AWS Access Key ID: ');
  const awsSecretKey = await question('AWS Secret Access Key: ');
  const awsRegion = await question('AWS Region (default: us-east-1): ') || 'us-east-1';

  const envContent = `# OroboreoAWS Bedrock Configuration
# Generated by oreo-init.js

AWS_ACCESS_KEY_ID=${awsAccessKey}
AWS_SECRET_ACCESS_KEY=${awsSecretKey}
AWS_REGION=${awsRegion}
`;

  fs.writeFileSync(path.join(oroborosDir, '.env'), envContent, 'utf8');

  log('\nCredentials saved to .env', 'green');
  log('Remember to add .env to .gitignore!', 'yellow');
}

// Run
main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
