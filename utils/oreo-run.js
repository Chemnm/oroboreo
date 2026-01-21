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
 * | bedrock-costs.json | Cost tracking - real-time spend monitoring        |
 * | human-feedback.md  | Input for oreo-feedback.js architect              |
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
 *   - Cost Tracking & Persistence (bedrock-costs.json)
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
const { MODELS, getPaths, COST_FACTORS } = require('./oreo-config.js');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Loop Safety
  maxGlobalLoops: 100,
  maxRetriesPerTask: 5,
  cooldownMs: 5000,

  // Bedrock Models (from shared config)
  models: MODELS,

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
    path.join(__dirname, '.env'),
    path.join(__dirname, 'bedrock', '.env')
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

function setupGitBranch() {
  log('Setting up Git environment...', 'GIT');
  try {
    // Windows: Clean up any 'nul' file before git operations
    cleanupNulFile();

    // Commit any uncommitted changes first
    execSync('git add .', { cwd: CONFIG.paths.projectRoot, stdio: 'ignore' });
    const status = execSync('git status --porcelain', { cwd: CONFIG.paths.projectRoot }).toString();
    if (status.trim()) {
      log('Committing pre-existing changes...', 'GIT');
      execSync('git commit -m "pre-oreo session backup"', { cwd: CONFIG.paths.projectRoot, stdio: 'ignore' });
    }

    // Create and checkout new branch
    const sessionName = getSessionName();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const branchName = `oreo-${sessionName}-${timestamp}`;

    log(`Checking out new branch: ${branchName}`, 'GIT');
    execSync(`git checkout -b "${branchName}"`, { cwd: CONFIG.paths.projectRoot, stdio: 'inherit' });

    return branchName;
  } catch (e) {
    log(`Git branch setup failed: ${e.message}`, 'WARN');
    return null;
  }
}

function gitCommit(task) {
  try {
    // Windows: Clean up any 'nul' file before git operations
    cleanupNulFile();

    execSync('git add .', { cwd: CONFIG.paths.projectRoot, stdio: 'inherit' });
    const status = execSync('git status --porcelain', { cwd: CONFIG.paths.projectRoot }).toString();

    if (status.trim()) {
      const msg = `Oreo: Completed Task ${task.id} (${task.title})`;
      execSync(`git commit -m "${msg}"`, { cwd: CONFIG.paths.projectRoot, stdio: 'inherit' });
      log(`Committed changes for Task ${task.id}`, 'GIT');
    } else {
      log('No changes to commit', 'GIT');
    }
  } catch (e) {
    log(`Git commit failed: ${e.message}`, 'WARN');
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

  // Load environment
  if (!loadEnv()) {
    log('No .env file found in oroboreo directory', 'WARN');
  }

  // Validate AWS credentials
  if (!process.env.AWS_ACCESS_KEY_ID) {
    log('AWS_ACCESS_KEY_ID not set! Please configure oroboreo/.env', 'ERROR');
    process.exit(1);
  }

  // Set Bedrock environment
  process.env.CLAUDE_CODE_USE_BEDROCK = '1';
  process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  log(`AWS Region: ${process.env.AWS_REGION}`);

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
    const batFile = path.join(__dirname, 'run-with-prompt.bat');

    const env = {
      ...process.env,
      CLAUDE_CODE_USE_BEDROCK: '1',
      AWS_REGION: process.env.AWS_REGION || 'us-east-1',
      ANTHROPIC_MODEL: model.id,
      CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(model.maxOutput || 20000),
      CLAUDE_CODE_MAX_THINKING_TOKENS: String(model.maxThinking || 0),
      FORCE_COLOR: '1'
    };

    log('Spawning Claude Code agent...', 'INFO');

    try {
      let outputBuffer = '';
      await new Promise((resolve, reject) => {
        const child = spawn(batFile, [CONFIG.paths.prompt], {
          env,
          cwd: CONFIG.paths.projectRoot,
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe']
        });

        child.stdout.on('data', (data) => {
          const str = data.toString();
          process.stdout.write(str);
          outputBuffer += str;
          fs.appendFileSync(CONFIG.paths.log, str);
        });

        child.stderr.on('data', (data) => {
          const str = data.toString();
          process.stderr.write(str);
          outputBuffer += str;
          fs.appendFileSync(CONFIG.paths.log, str);
        });

        child.on('exit', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Exit code ${code}`));
        });

        child.on('error', reject);
      });

      // 6. Post-execution check
      const updatedTasks = parseTasks();
      const isComplete = updatedTasks.find(t => t.id === task.id)?.completed;

      // Track cost
      trackCost(task, model, prompt, outputBuffer);

      if (isComplete) {
        log(`Task ${task.id} COMPLETED!`, 'SUCCESS');
        delete taskAttempts[task.id];

        if (CONFIG.git.commitOnSuccess) {
          gitCommit(task);
        }
      } else {
        log(`Task ${task.id} not marked complete, retrying...`, 'WARN');
        taskAttempts[task.id] = attempts + 1;
      }

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
