#!/usr/bin/env node
/**
 * OREO-RUN - The Golden Loop Execution Engine
 *
 * This is the main autonomous loop that executes tasks from cookie-crumbs.md.
 * Each iteration spawns a fresh Claude Code instance with full context but no
 * persistent memory, forcing all learnings to be documented in progress.txt.
 *
 * Based on the "Ralph Loop" technique - fresh context prevents drift and
 * accumulated mistakes while ensuring proper documentation.
 *
 * ============================================================================
 * FILE REFERENCES (Oreo Theme)
 * ============================================================================
 *
 * | File               | Purpose                                            |
 * |--------------------|---------------------------------------------------|
 * | cookie-crumbs.md   | Task list (like PRD.md) - your feature breakdown  |
 * | creme-filling.md   | System rules (like AGENTS.md) - the law           |
 * | progress.txt       | Session memory - learnings between iterations     |
 * | costs.json | Cost tracking - real-time spend monitoring        |
 * | human-feedback.md  | Input for oreo-feedback.js architect              |
 * | tests/             | Session verification scripts (archived)            |
 * | tests/reusable/    | Generic tests (kept across sessions)               |
 * | archives/          | Historical sessions for learning                  |
 *
 * ============================================================================
 * USAGE
 * ============================================================================
 *
 *   node oroboreo/utils/oreo-run.js
 *
 * Prerequisites:
 *   - Node.js 18+
 *   - Claude Code CLI: npm install -g @anthropic-ai/claude-code
 *   - AWS Bedrock credentials in oroboreo/.env
 *   - cookie-crumbs.md with tasks
 *   - creme-filling.md with system rules
 *
 * ============================================================================
 * FEATURES
 * ============================================================================
 *
 *   - Smart Model Routing (Opus/Sonnet/Haiku based on task complexity)
 *   - Cost Tracking & Persistence (costs.json)
 *   - Git Integration (auto-commit on task success)
 *   - Auto-retry with exponential backoff (5 attempts per task)
 *   - Session logging (oreo-execution.log)
 *
 * @author Oroboreo- The Golden Loop
 * @version 1.0.0
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getModelConfig, clearProviderEnv, getPaths, COST_FACTORS } = require('./oreo-config.js');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Loop Safety
  maxGlobalLoops: 100,
  maxRetriesPerTask: 5,
  cooldownMs: 5000,

  // Timeout Configuration (configurable via environment variables)
  taskTimeoutMs: parseInt(process.env.OREO_TASK_TIMEOUT_MS || '1800000'),    // 30 minutes default
  gitTimeoutMs: parseInt(process.env.OREO_GIT_TIMEOUT_MS || '60000'),        // 1 minute default
  heartbeatIntervalMs: parseInt(process.env.OREO_HEARTBEAT_MS || '60000'),   // 1 minute default
  silentWarningMs: 5 * 60 * 1000,                                            // 5 minutes of silence triggers warning

  // Models (will be set after loading env)
  models: null,

  // File Paths (Oreo Theme)
  paths: {
    ...getPaths(__dirname),                               // Shared paths
    progress: path.join(__dirname, '..', 'progress.txt'),       // Session memory
    log: path.join(__dirname, '..', 'oreo-execution.log'),      // Execution log
    prompt: path.join(__dirname, '..', '.oreo-prompt.txt')      // Temp prompt file
  },

  // Git Settings
  git: {
    commitOnSuccess: true,
    commitOnFailure: false
  }
};

// ============================================================================
// UTILITIES
// ============================================================================

function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  const formatted = `[${timestamp}] [${type}] ${message}`;

  console.log(formatted);

  try {
    fs.appendFileSync(CONFIG.paths.log, formatted + '\n');
  } catch (e) {
    // Ignore log write errors
  }
}

function loadEnv() {
  // Check multiple locations for .env file (like ralph-loop.js)
  const locations = [
    path.join(__dirname, '..', '.env'),
  ];

  for (const envFile of locations) {
    if (fs.existsSync(envFile)) {
      log(`Loading AWS credentials from ${path.basename(envFile)}...`);
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

function loadCostLog() {
  if (fs.existsSync(CONFIG.paths.costs)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG.paths.costs, 'utf8'));
    } catch (e) {
      log('Error reading cost log, starting fresh', 'WARN');
    }
  }
  return { session: { startTime: new Date().toISOString(), totalCost: 0 }, tasks: [] };
}

function saveCostLog(costLog) {
  fs.writeFileSync(CONFIG.paths.costs, JSON.stringify(costLog, null, 2));
}

function estimateTokens(text) {
  if (typeof text === 'number') return Math.ceil(text / 4);
  return Math.ceil((text || '').length / 4);
}

function trackCost(task, model, promptText, responseText) {
  const inputTokens = Math.ceil((Math.max(0, estimateTokens(promptText)) || 0) * COST_FACTORS.WORKER.TOOL_USE_FACTOR);
  const outputTokens = Math.ceil((Math.max(0, estimateTokens(responseText)) || 0) * COST_FACTORS.WORKER.OUTPUT_MULTIPLIER);

  const inputCost = (inputTokens * (model.inputCost || 0)) / 1000000;
  const outputCost = (outputTokens * (model.outputCost || 0)) / 1000000;
  const totalCost = inputCost + outputCost;

  const costLog = loadCostLog();

  costLog.tasks.push({
    taskId: task.id,
    taskTitle: task.title,
    timestamp: new Date().toISOString(),
    model: model.name,
    modelId: model.id,
    provider: (process.env.AI_PROVIDER || 'subscription').toLowerCase(),
    inputTokens,
    outputTokens,
    totalCostUSD: totalCost
  });

  costLog.session.totalCost = (costLog.session.totalCost || 0) + totalCost;
  saveCostLog(costLog);

  log(`Cost: $${totalCost.toFixed(4)} (Input: ${inputTokens}, Output: ${outputTokens})`, 'COST');
  log(`Session Total: $${costLog.session.totalCost.toFixed(2)}`, 'COST');
}

// ============================================================================
// TASK PARSING (cookie-crumbs.md)
// ============================================================================

function parseTasks() {
  if (!fs.existsSync(CONFIG.paths.tasks)) return [];

  const content = fs.readFileSync(CONFIG.paths.tasks, 'utf8');
  const tasks = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    // Match: - [ ] **Task 1: Title** [CRITICAL] or - [x] **Task 1: Title** [SIMPLE]
    const match = lines[i].match(/^-\s*\[([ x])\]\s*\*\*Task\s+(\d+):\s*(.+?)\*\*(?:\s*(\[.+?\]))?/i);
    if (match) {
      const [, checkmark, id, title, tag] = match;

      // Extract details from indented lines below
      const details = [];
      let j = i + 1;
      while (j < lines.length && (lines[j].startsWith('  -') || lines[j].startsWith('    '))) {
        details.push(lines[j].trim());
        j++;
      }

      // Include tag in title for model selection
      const fullTitle = tag ? `${title.trim()} ${tag}` : title.trim();

      tasks.push({
        id: parseInt(id, 10),
        title: fullTitle,
        completed: checkmark.toLowerCase() === 'x',
        details: details.join('\n')
      });
    }
  }
  return tasks;
}

// ============================================================================
// MODEL SELECTION
// ============================================================================

function selectModel(task) {
  const text = (task.title + ' ' + task.details).toLowerCase();

  // Explicit tags
  if (text.includes('[simple]')) return CONFIG.models.HAIKU;
  if (text.includes('[complex]') || text.includes('[critical]')) return CONFIG.models.SONNET;

  // Keyword analysis
  const complexKeywords = [
    'architecture', 'refactor', 'database', 'migration', 'schema',
    'design', 'plan', 'implement', 'build', 'api', 'security', 'critical'
  ];

  if (complexKeywords.some(kw => text.includes(kw))) return CONFIG.models.SONNET;

  return CONFIG.models.HAIKU; // Default to cheapest
}

// ============================================================================
// GIT INTEGRATION
// ============================================================================

function cleanupNulFile() {
  // Windows-specific: Clean up 'nul' file that can be created by git
  // 'nul' is a reserved device name on Windows and causes issues
  const nulPath = path.normalize(path.join(CONFIG.paths.projectRoot, 'nul'));
  try {
    execSync(`cmd /c "if exist \\"\\\\?\\\\${nulPath}\\" del \\"\\\\?\\\\${nulPath}\\""`, { stdio: 'ignore' });
  } catch (e) {
    // Fallback for simple paths
    try {
      execSync(`cmd /c "if exist \\"${nulPath}\\" del \\"${nulPath}\\""`, { stdio: 'ignore' });
    } catch (e2) {
      // Ignore cleanup errors
    }
  }
}

function getSessionName() {
  try {
    if (fs.existsSync(CONFIG.paths.tasks)) {
      const content = fs.readFileSync(CONFIG.paths.tasks, 'utf8');
      const match = content.match(/\*\*Session\*\*:\s*(.+)/i);
      if (match && match[1]) {
        return match[1].trim().replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase().substring(0, 50);
      }
    }
  } catch (e) {}
  return 'oreo-session';
}

/**
 * Check if current session has incomplete tasks
 * Returns true if should resume, false if should start new session
 */
function checkSessionIncomplete() {
  try {
    const cookieCrumbsPath = path.join(CONFIG.paths.projectRoot, 'oroboreo', 'cookie-crumbs.md');

    if (!fs.existsSync(cookieCrumbsPath)) {
      log('cookie-crumbs.md not found - assuming new session', 'WARN');
      return false;
    }

    const content = fs.readFileSync(cookieCrumbsPath, 'utf-8');

    // Check 1: Look for REAL tasks with numbers (not template placeholder "Task N:")
    // Real tasks: **Task 1:**, **Task 2:**, etc.
    // Template: **Task N:** (literal "N")
    const realTasks = content.match(/\*\*Task \d+:/g);

    if (!realTasks || realTasks.length === 0) {
      log('No numbered tasks found - appears to be template', 'INFO');
      return false;
    }

    // Check 2: Look for incomplete numbered tasks
    // Match pattern: - [ ] **Task N:** (with actual number, not "N")
    const incompleteTasks = content.match(/- \[ \] \*\*Task \d+:/g);

    if (incompleteTasks && incompleteTasks.length > 0) {
      log(`Found ${incompleteTasks.length} incomplete task(s) in cookie-crumbs.md`, 'INFO');
      return true;
    }

    // Check 3: If all tasks are complete [x], check if there are recent commits on this branch
    // This handles the case where session completed but wasn't archived yet
    try {
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: CONFIG.paths.projectRoot,
        timeout: CONFIG.gitTimeoutMs
      }).toString().trim();

      // Check if branch has commits beyond main
      const commitCount = execSync(`git rev-list --count ${currentBranch} --not main`, {
        cwd: CONFIG.paths.projectRoot,
        timeout: CONFIG.gitTimeoutMs
      }).toString().trim();

      if (parseInt(commitCount) > 0) {
        log(`Branch has ${commitCount} commits beyond main - session appears complete but not archived`, 'INFO');
        return false; // Session is complete, start new one
      }
    } catch (gitError) {
      log(`Could not check git commits: ${gitError.message}`, 'WARN');
    }

    log('All tasks in cookie-crumbs.md appear complete', 'INFO');
    return false;

  } catch (e) {
    log(`Error checking session status: ${e.message}`, 'WARN');
    // If we can't determine, err on side of caution - assume resuming
    return true;
  }
}

function setupGitBranch() {
  log('Setting up Git environment...', 'GIT');
  try {
    // Windows: Clean up any 'nul' file before git operations
    cleanupNulFile();

    // NEW: Check current branch and ensure we're on main
    log('Git: Checking current branch...', 'GIT');
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: CONFIG.paths.projectRoot,
      timeout: CONFIG.gitTimeoutMs
    }).toString().trim();

    log(`Currently on branch: ${currentBranch}`, 'GIT');

    // NEW: Check if resuming existing session
    if (currentBranch.startsWith('oreo-')) {
      log('Detected existing Oreo session branch', 'INFO');

      // Check if session has incomplete tasks
      const hasIncompleteTasks = checkSessionIncomplete();

      if (hasIncompleteTasks) {
        log('Resuming existing session on branch: ' + currentBranch, 'SUCCESS');
        log('Skipping branch creation - continuing from where you left off', 'INFO');
        return currentBranch; // CRITICAL: Return early, don't create new branch
      } else {
        log('Previous session appears complete, starting new session', 'INFO');
        // Fall through to main branch logic below
      }
    }

    // NEW: If not on main, switch to main (commit changes first if needed)
    if (currentBranch !== 'main') {
      log('WARNING: Not on main branch. Switching to main for session start...', 'WARN');

      // Check for uncommitted changes on current branch
      const currentStatus = execSync('git status --porcelain', {
        cwd: CONFIG.paths.projectRoot,
        timeout: CONFIG.gitTimeoutMs
      }).toString().trim();

      if (currentStatus) {
        log('Committing changes on current branch before switching...', 'GIT');
        execSync('git add .', {
          cwd: CONFIG.paths.projectRoot,
          stdio: 'ignore',
          timeout: CONFIG.gitTimeoutMs
        });
        execSync('git commit -m "pre-oreo session backup"', {
          cwd: CONFIG.paths.projectRoot,
          stdio: 'ignore',
          timeout: CONFIG.gitTimeoutMs
        });
      }

      log('Switching to main branch...', 'GIT');
      execSync('git checkout main', {
        cwd: CONFIG.paths.projectRoot,
        stdio: 'inherit',
        timeout: CONFIG.gitTimeoutMs
      });
    }

    // NEW: Pull latest changes from origin/main
    log('Git: Pulling latest changes from origin/main...', 'GIT');
    try {
      execSync('git pull origin main', {
        cwd: CONFIG.paths.projectRoot,
        stdio: 'inherit',
        timeout: CONFIG.gitTimeoutMs
      });
    } catch (pullError) {
      log('Warning: Could not pull from origin/main. Continuing with local main.', 'WARN');
      // Continue anyway - maybe offline or no remote configured
    }

    // Commit any uncommitted changes first
    log('Git: Checking for uncommitted changes...', 'GIT');
    execSync('git add .', {
      cwd: CONFIG.paths.projectRoot,
      stdio: 'ignore',
      timeout: CONFIG.gitTimeoutMs
    });
    const status = execSync('git status --porcelain', {
      cwd: CONFIG.paths.projectRoot,
      timeout: CONFIG.gitTimeoutMs
    }).toString();
    if (status.trim()) {
      log('Committing pre-existing changes...', 'GIT');
      execSync('git commit -m "pre-oreo session backup"', {
        cwd: CONFIG.paths.projectRoot,
        stdio: 'ignore',
        timeout: CONFIG.gitTimeoutMs
      });
    }

    // NEW: Verify we're on main before creating new branch
    const verifyBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: CONFIG.paths.projectRoot,
      timeout: CONFIG.gitTimeoutMs
    }).toString().trim();

    if (verifyBranch !== 'main') {
      throw new Error(`Expected to be on main branch, but on ${verifyBranch}`);
    }

    // Create and checkout new branch
    const sessionName = getSessionName();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const branchName = `oreo-${sessionName}-${timestamp}`;

    log(`Creating new branch from main: ${branchName}`, 'GIT');
    execSync(`git checkout -b "${branchName}"`, {
      cwd: CONFIG.paths.projectRoot,
      stdio: 'inherit',
      timeout: CONFIG.gitTimeoutMs
    });

    log(`Successfully created session branch: ${branchName}`, 'SUCCESS');
    return branchName;
  } catch (e) {
    if (e.killed && e.signal === 'SIGTERM') {
      log(`Git branch setup timeout after ${CONFIG.gitTimeoutMs / 1000}s`, 'ERROR');
    } else {
      log(`Git branch setup failed: ${e.message}`, 'ERROR');
      log('Please resolve git issues and try again', 'ERROR');
    }
    return null;
  }
}

function gitCommit(task) {
  try {
    log('Git: Starting commit operation...', 'GIT');

    // Windows: Clean up any 'nul' file before git operations
    cleanupNulFile();

    log('Git: Adding files...', 'GIT');
    execSync('git add .', {
      cwd: CONFIG.paths.projectRoot,
      stdio: 'inherit',
      timeout: CONFIG.gitTimeoutMs
    });

    log('Git: Checking status...', 'GIT');
    const status = execSync('git status --porcelain', {
      cwd: CONFIG.paths.projectRoot,
      timeout: CONFIG.gitTimeoutMs
    }).toString();

    if (status.trim()) {
      const msg = `Oreo: Completed Task ${task.id} (${task.title})`;
      log(`Git: Committing with message: "${msg}"`, 'GIT');
      execSync(`git commit -m "${msg}"`, {
        cwd: CONFIG.paths.projectRoot,
        stdio: 'inherit',
        timeout: CONFIG.gitTimeoutMs
      });
      log(`Committed changes for Task ${task.id}`, 'GIT');
    } else {
      log('No changes to commit', 'GIT');
    }
  } catch (e) {
    if (e.killed && e.signal === 'SIGTERM') {
      log(`Git operation timeout after ${CONFIG.gitTimeoutMs / 1000}s`, 'ERROR');
    } else {
      log(`Git commit failed: ${e.message}`, 'WARN');
    }
  }
}

// ============================================================================
// PROMPT CONSTRUCTION
// ============================================================================

function constructPrompt(task) {
  const rules = fs.existsSync(CONFIG.paths.rules)
    ? fs.readFileSync(CONFIG.paths.rules, 'utf8')
    : '# No creme-filling.md found - please create system rules';

  const progress = fs.existsSync(CONFIG.paths.progress)
    ? fs.readFileSync(CONFIG.paths.progress, 'utf8')
    : '';

  // Context Truncation for large progress files
  const header = progress.slice(0, 5000);
  const tail = progress.slice(-50000);
  const history = progress.length > 55000
    ? `${header}\n\n... [Truncated] ...\n\n${tail}`
    : progress;

  return `
${rules}

===============================================================================
PROGRESS HISTORY
===============================================================================
${history}

===============================================================================
CURRENT MISSION: Task ${task.id}
===============================================================================
**${task.title}**
${task.details}

===============================================================================
EXECUTION RULES
===============================================================================
1. Complete the task described above.
2. Follow all rules in creme-filling.md (the system rules above).
3. Update cookie-crumbs.md to mark task [x] when done.
4. Log important findings to progress.txt.
5. Do NOT create unnecessary files or over-engineer.
6. **Check oroboreo/tests/reusable/** for existing verification scripts before creating new ones.
7. **Create session-specific tests** in oroboreo/tests/ (will be archived after session).
8. **Create reusable tests** in oroboreo/tests/reusable/ for generic functionality (persists).
9. Tests MUST be executable scripts (Node.js, bash, curl) - NOT manual browser checks.
`;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('');
  console.log('===============================================================================');
  console.log('OROBOREO - The Golden Loop');
  console.log('===============================================================================');
  console.log('');

  // Graceful shutdown handling
  let currentChildProcess = null;
  let isShuttingDown = false;

  function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n\nReceived ${signal} - shutting down gracefully...`);
    log(`Received ${signal} - attempting graceful shutdown`, 'WARN');

    if (currentChildProcess && currentChildProcess.pid) {
      log(`Killing child process (PID: ${currentChildProcess.pid})...`, 'WARN');
      try {
        process.kill(currentChildProcess.pid, 'SIGTERM');
        setTimeout(() => {
          try {
            if (currentChildProcess && currentChildProcess.pid) {
              log(`Force killing child process (PID: ${currentChildProcess.pid})`, 'ERROR');
              process.kill(currentChildProcess.pid, 'SIGKILL');
            }
          } catch (e) {
            // Process already dead
          }
        }, 5000);
      } catch (e) {
        log(`Failed to kill child process: ${e.message}`, 'ERROR');
      }
    }

    log('Shutdown complete', 'INFO');
    setTimeout(() => process.exit(1), 6000); // Give time for process cleanup
  }

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // Load environment
  if (!loadEnv()) {
    log('No .env file found in oroboreo directory', 'WARN');
  }

  // Set up provider-aware models
  const MODELS = getModelConfig();
  CONFIG.models = MODELS;

  // Configure provider-specific settings
  const provider = (process.env.AI_PROVIDER || 'subscription').toLowerCase();
  log(`AI Provider: ${provider}`);

  if (provider === 'bedrock') {
    // Validate AWS credentials
    if (!process.env.AWS_ACCESS_KEY_ID) {
      log('AWS_ACCESS_KEY_ID not set! Please configure oroboreo/.env', 'ERROR');
      process.exit(1);
    }

    // Set Bedrock environment
    process.env.CLAUDE_CODE_USE_BEDROCK = '1';
    process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
    log(`AWS Region: ${process.env.AWS_REGION}`);
  } else if (provider === 'anthropic') {
    // Validate Anthropic API key
    if (!process.env.ANTHROPIC_API_KEY) {
      log('ANTHROPIC_API_KEY not set! Please configure oroboreo/.env', 'ERROR');
      process.exit(1);
    }
    log('Using Anthropic API');
  } else if (provider === 'subscription') {
    // Claude Code Subscription - no validation needed
    // User must have run: npx @anthropic-ai/claude-code login
    log('Using Claude Code Subscription (ensure you have run: npx @anthropic-ai/claude-code login)');
  } else {
    log(`Invalid AI_PROVIDER: ${provider}. Valid options: bedrock, anthropic, subscription`, 'ERROR');
    process.exit(1);
  }

  // Validate required files
  if (!fs.existsSync(CONFIG.paths.tasks)) {
    log('cookie-crumbs.md not found! Create your task list first.', 'ERROR');
    process.exit(1);
  }

  if (!fs.existsSync(CONFIG.paths.rules)) {
    log('creme-filling.md not found! Create your system rules first.', 'ERROR');
    process.exit(1);
  }

  // Setup Git Branch
  setupGitBranch();

  let loops = 0;
  const taskAttempts = {};

  while (loops < CONFIG.maxGlobalLoops) {
    loops++;

    // 1. Find next incomplete task
    const tasks = parseTasks();
    const task = tasks.find(t => !t.completed);

    if (!task) {
      log('All tasks complete!', 'SUCCESS');
      console.log('');
      console.log('===============================================================================');
      console.log('THE GOLDEN LOOP IS COMPLETE!');
      console.log('===============================================================================');

      // Show cost summary
      const costLog = loadCostLog();
      console.log(`Total Cost: $${costLog.session.totalCost.toFixed(2)}`);
      console.log(`Tasks Completed: ${costLog.tasks.length}`);
      console.log('');

      // Auto-archive on completion and reset for next session
      try {
        const { archiveSession, resetSessionFiles } = require('./oreo-archive.js');
        const archivePath = archiveSession();
        if (archivePath) {
          resetSessionFiles(archivePath);
        }
      } catch (e) {
        log(`Archive failed: ${e.message}`, 'WARN');
      }

      process.exit(0);
    }

    // 2. Check retry limit
    const attempts = taskAttempts[task.id] || 0;
    if (attempts >= CONFIG.maxRetriesPerTask) {
      log(`Task ${task.id} failed ${CONFIG.maxRetriesPerTask} times. Aborting.`, 'ERROR');
      process.exit(1);
    }

    // 3. Select model
    const model = selectModel(task);

    console.log('');
    console.log('-------------------------------------------------------------------------------');
    log(`Task ${task.id}: ${task.title}`, 'INFO');
    log(`Model: ${model.name}`, 'INFO');
    log(`Attempt: ${attempts + 1}/${CONFIG.maxRetriesPerTask}`, 'INFO');
    console.log('-------------------------------------------------------------------------------');

    // 4. Prepare prompt
    const prompt = constructPrompt(task);
    fs.writeFileSync(CONFIG.paths.prompt, prompt);

    // 5. Execute Claude Code
    // Cross-platform: use .bat on Windows, .sh on Linux/macOS
    const scriptExt = process.platform === 'win32' ? '.bat' : '.sh';
    const batFile = path.join(__dirname, `run-with-prompt${scriptExt}`);

    // On Unix systems, ensure script is executable
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(batFile, '755');
      } catch (e) {
        log(`Warning: Could not make script executable: ${e.message}`, 'WARN');
      }
    }

    // Save credentials BEFORE clearing (clearProviderEnv deletes them from process.env)
    const savedCredentials = {
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
      AWS_REGION: process.env.AWS_REGION,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
    };

    // Clear ALL provider environment variables first
    clearProviderEnv();

    const provider = (process.env.AI_PROVIDER || 'subscription').toLowerCase();

    const env = {
      ...process.env,  // Start fresh after clearProviderEnv()
      CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(model.maxOutput || 20000),
      CLAUDE_CODE_MAX_THINKING_TOKENS: String(model.maxThinking || 0),
      FORCE_COLOR: '1'
    };

    // Provider-specific configuration
    if (provider === 'bedrock') {
      // AWS Bedrock - Set Bedrock-specific vars
      env.ANTHROPIC_MODEL = model.id;
      env.CLAUDE_CODE_USE_BEDROCK = '1';
      env.AWS_REGION = savedCredentials.AWS_REGION || 'us-east-1';
      env.AWS_ACCESS_KEY_ID = savedCredentials.AWS_ACCESS_KEY_ID;
      env.AWS_SECRET_ACCESS_KEY = savedCredentials.AWS_SECRET_ACCESS_KEY;
      log(`Using AWS Bedrock with model: ${model.id}`, 'INFO');

    } else if (provider === 'anthropic') {
      // Anthropic API - Set ONLY API key (no ANTHROPIC_MODEL)
      env.ANTHROPIC_API_KEY = savedCredentials.ANTHROPIC_API_KEY;
      log(`Using Anthropic API with model: ${model.id}`, 'INFO');

    } else if (provider === 'subscription') {
      // Claude Code Subscription - Set NO auth variables
      // Claude Code will use logged-in claude.ai account
      log(`Using Claude Subscription with model: ${model.id}`, 'INFO');

    } else {
      log(`Invalid AI_PROVIDER: ${provider}. Valid options: bedrock, anthropic, subscription`, 'ERROR');
      process.exit(1);
    }

    log('Spawning Claude Code agent...', 'INFO');

    try {
      let outputBuffer = '';
      let childProcess = null;

      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Task execution timeout after ${CONFIG.taskTimeoutMs / 1000}s`));
        }, CONFIG.taskTimeoutMs);
      });

      // Create execution promise with heartbeat monitoring
      const executionPromise = new Promise((resolve, reject) => {
        childProcess = spawn(batFile, [CONFIG.paths.prompt], {
          env,
          cwd: CONFIG.paths.projectRoot,
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe']
        });

        // Store reference for graceful shutdown
        currentChildProcess = childProcess;

        // Log PID for debugging
        log(`Agent spawned (PID: ${childProcess.pid})`, 'INFO');

        let lastOutputTime = Date.now();

        // Heartbeat check - detect silent hangs
        const heartbeatInterval = setInterval(() => {
          const silentTime = Date.now() - lastOutputTime;
          if (silentTime > CONFIG.silentWarningMs) {
            log(`WARNING: No output from agent for ${Math.floor(silentTime / 1000)}s (PID: ${childProcess.pid})`, 'WARN');
          } else {
            log(`Agent still running (PID: ${childProcess.pid}, silent: ${Math.floor(silentTime / 1000)}s)`, 'INFO');
          }
        }, CONFIG.heartbeatIntervalMs);

        childProcess.stdout.on('data', (data) => {
          lastOutputTime = Date.now();
          const str = data.toString();
          process.stdout.write(str);
          outputBuffer += str;
          fs.appendFileSync(CONFIG.paths.log, str);
        });

        childProcess.stderr.on('data', (data) => {
          lastOutputTime = Date.now();
          const str = data.toString();
          process.stderr.write(str);
          outputBuffer += str;
          fs.appendFileSync(CONFIG.paths.log, str);
        });

        childProcess.on('exit', (code) => {
          clearInterval(heartbeatInterval);
          log(`Agent exited (PID: ${childProcess.pid}, code: ${code})`, 'INFO');
          if (code === 0) resolve();
          else reject(new Error(`Exit code ${code}`));
        });

        childProcess.on('error', (err) => {
          clearInterval(heartbeatInterval);
          log(`Agent spawn error (PID: ${childProcess.pid}): ${err.message}`, 'ERROR');
          reject(err);
        });
      });

      // Race between execution and timeout
      await Promise.race([executionPromise, timeoutPromise]).catch((err) => {
        if (err.message.includes('timeout')) {
          log(`Agent timeout detected - attempting to kill process (PID: ${childProcess ? childProcess.pid : 'unknown'})`, 'ERROR');
          if (childProcess && childProcess.pid) {
            try {
              process.kill(childProcess.pid, 'SIGTERM');
              setTimeout(() => {
                try {
                  // Force kill if still alive after 5s
                  process.kill(childProcess.pid, 'SIGKILL');
                  log(`Force killed hung process (PID: ${childProcess.pid})`, 'ERROR');
                } catch (killErr) {
                  // Process already dead
                }
              }, 5000);
            } catch (killErr) {
              log(`Failed to kill hung process: ${killErr.message}`, 'ERROR');
            }
          }
        }
        throw err;
      });

      log('Agent completed successfully', 'INFO');

      // 6. Post-execution check
      log('Post-execution: Checking task completion status...', 'INFO');
      const updatedTasks = parseTasks();
      const isComplete = updatedTasks.find(t => t.id === task.id)?.completed;
      log(`Post-execution: Task ${task.id} completion status: ${isComplete ? 'COMPLETE' : 'INCOMPLETE'}`, 'INFO');

      // Track cost
      log('Post-execution: Tracking cost...', 'INFO');
      trackCost(task, model, prompt, outputBuffer);

      if (isComplete) {
        log(`Task ${task.id} COMPLETED!`, 'SUCCESS');
        delete taskAttempts[task.id];

        if (CONFIG.git.commitOnSuccess) {
          log('Post-execution: Committing changes to git...', 'INFO');
          gitCommit(task);
          log('Post-execution: Git commit complete', 'INFO');
        }
      } else {
        log(`Task ${task.id} not marked complete, retrying...`, 'WARN');
        taskAttempts[task.id] = attempts + 1;
      }

      log(`Post-execution: Task ${task.id} cycle complete`, 'INFO');

    } catch (e) {
      log(`Execution failed: ${e.message}`, 'ERROR');
      taskAttempts[task.id] = attempts + 1;
    }

    // Cooldown
    log(`Cooling down ${CONFIG.cooldownMs / 1000}s...`, 'INFO');
    await new Promise(r => setTimeout(r, CONFIG.cooldownMs));
  }

  log(`Max loops (${CONFIG.maxGlobalLoops}) reached. Stopping.`, 'WARN');
}

main().catch(e => {
  console.error('Fatal Error:', e.message);
  process.exit(1);
});
