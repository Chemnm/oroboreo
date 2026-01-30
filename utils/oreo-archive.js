#!/usr/bin/env node
/**
 * OREO-ARCHIVE - Session Archival & Reset
 *
 * Archives completed Oroboreosessions to archives/ folder and resets
 * session files for the next run. Called automatically by oreo-run.js
 * when all tasks complete, or manually via CLI.
 *
 * ============================================================================
 * FILE REFERENCES (Oreo Theme)
 * ============================================================================
 *
 * | File               | Purpose                                            |
 * |--------------------|---------------------------------------------------|
 * | cookie-crumbs.md   | Task list - archived then reset to template       |
 * | progress.txt       | Session memory - archived then reset              |
 * | costs.json | Cost tracking - archived then reset               |
 * | oreo-execution.log | Execution log - archived then cleared             |
 * | human-feedback.md  | Human feedback - archived then reset to template  |
 * | archives/          | Destination folder                                |
 *
 * ============================================================================
 * USAGE
 * ============================================================================
 *
 *   # Archive current session (no reset)
 *   node oroboreo/utils/oreo-archive.js
 *
 *   # Archive and reset for next session
 *   node oroboreo/utils/oreo-archive.js --reset
 *
 *   # List all archives
 *   node oroboreo/utils/oreo-archive.js --list
 *
 * @author Oroboreo- The Golden Loop
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// CONFIGURATION
// ============================================================================

const { getPaths } = require('./oreo-config.js');

// Get paths from centralized config (uses process.cwd()/oroboreo/)
const paths = getPaths();
const OROBOREO_DIR = paths.oroboreoDir;
const ARCHIVE_DIR = paths.archives;
const PROJECT_ROOT = paths.projectRoot;

// Files to archive (tests/ handled separately with smart archival)
const FILES_TO_ARCHIVE = [
  'cookie-crumbs.md',
  'progress.txt',
  'costs.json',
  'oreo-execution.log',
  'human-feedback.md'
];

// Temp files to clean up after archive
const TEMP_FILES_TO_CLEAN = [
  '.oreo-prompt.txt',
  '.architect-prompt.txt',
  '.generate-prompt.txt',
  '.init-prompt.txt'
];

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  red: '\x1b[31m'
};

function log(msg, color = 'reset') {
  console.log(colors[color] + msg + colors.reset);
}

// ============================================================================
// ARCHIVE FUNCTIONS
// ============================================================================

function getSessionName() {
  const tasksPath = path.join(OROBOREO_DIR, 'cookie-crumbs.md');
  if (fs.existsSync(tasksPath)) {
    const content = fs.readFileSync(tasksPath, 'utf8');
    const match = content.match(/\*\*Session\*\*:\s*(.+)/i);
    if (match && match[1]) {
      return match[1].trim().replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase().substring(0, 50);
    }
  }
  return 'session';
}

function getSessionCreatedDate() {
  const tasksPath = path.join(OROBOREO_DIR, 'cookie-crumbs.md');
  if (fs.existsSync(tasksPath)) {
    const content = fs.readFileSync(tasksPath, 'utf8');
    const match = content.match(/\*\*Created\*\*:\s*(.+)/i);
    if (match && match[1]) {
      try {
        // Parse formats like "2026-01-24 18:09" or "2026-01-24"
        const dateStr = match[1].trim();
        return new Date(dateStr.replace(' ', 'T'));
      } catch (e) {}
    }
  }
  return new Date(); // Fallback to current date
}

function getArchivePath() {
  const sessionDate = getSessionCreatedDate();
  const sessionName = getSessionName();

  // Extract year, month, date, hour, minute from session creation date
  const year = sessionDate.getFullYear();
  const month = String(sessionDate.getMonth() + 1).padStart(2, '0');
  const day = String(sessionDate.getDate()).padStart(2, '0');
  const hour = String(sessionDate.getHours()).padStart(2, '0');
  const minute = String(sessionDate.getMinutes()).padStart(2, '0');

  // Folder name: YYYY-MM-DD-HH-MM-sessionName
  const folderName = `${year}-${month}-${day}-${hour}-${minute}-${sessionName}`;

  // Year/month subdirectory structure
  const yearMonthDir = path.join(ARCHIVE_DIR, year.toString(), month);
  const archivePath = path.join(yearMonthDir, folderName);

  // If folder exists, add a counter
  let finalPath = archivePath;
  let counter = 1;
  while (fs.existsSync(finalPath)) {
    finalPath = `${archivePath}_${counter}`;
    counter++;
  }

  fs.mkdirSync(finalPath, { recursive: true });
  return { archivePath: finalPath, timestamp: `${year}-${month}-${day}`, sessionName };
}

function archiveSession() {
  log('\n===============================================================================', 'yellow');
  log('OROBOREO ARCHIVE', 'bright');
  log('===============================================================================\n', 'yellow');

  const { archivePath, timestamp } = getArchivePath();

  let archivedCount = 0;

  FILES_TO_ARCHIVE.forEach(file => {
    const sourcePath = path.join(OROBOREO_DIR, file);

    if (fs.existsSync(sourcePath)) {
      const destPath = path.join(archivePath, file);
      fs.copyFileSync(sourcePath, destPath);
      log(`  Archived: ${file}`, 'green');
      archivedCount++;
    } else {
      log(`  Skipped: ${file} (not found)`, 'yellow');
    }
  });

  if (archivedCount > 0) {
    log(`\nArchived ${archivedCount} file(s) to:`, 'bright');
    log(`  ${path.relative(process.cwd(), archivePath)}`, 'cyan');

    // Smart test archival
    log('\n📝 Smart Test Archival:', 'bright');
    const testStats = archiveTests(archivePath);

    // Create archive summary
    const summaryPath = path.join(archivePath, 'SUMMARY.md');
    const summary = generateArchiveSummary(archivePath, timestamp);
    fs.writeFileSync(summaryPath, summary, 'utf8');
    log(`  Created: SUMMARY.md`, 'cyan');

    // Test summary
    if (testStats.reusable > 0 || testStats.archived > 0) {
      log(`\nTest Summary:`, 'bright');
      log(`  Reusable tests: ${testStats.reusable}`, 'green');
      log(`  Archived tests: ${testStats.archived}`, 'cyan');
    }

    log('', 'reset');
  } else {
    log('\nNo files to archive!', 'yellow');
    return null;
  }

  return archivePath;
}

function generateArchiveSummary(archivePath, timestamp) {
  const tasksPath = path.join(archivePath, 'cookie-crumbs.md');
  const costsPath = path.join(archivePath, 'costs.json');

  let summary = `# OroboreoSession Archive\n\n`;
  summary += `**Archived:** ${timestamp}\n\n`;
  summary += `---\n\n`;

  // Add task summary
  if (fs.existsSync(tasksPath)) {
    const content = fs.readFileSync(tasksPath, 'utf8');
    const sessionMatch = content.match(/\*\*Session\*\*:\s*(.+)/i);
    const session = sessionMatch ? sessionMatch[1] : 'Unknown';

    // Only count actual tasks (with **Task N:** format), not Human UI Verification checkboxes
    const completedTasks = (content.match(/- \[x\] \*\*Task \d+:/gi) || []).length;
    const totalTasks = (content.match(/- \[[ x]\] \*\*Task \d+:/gi) || []).length;

    summary += `## Session: ${session}\n\n`;
    summary += `**Tasks Completed:** ${completedTasks}/${totalTasks}\n\n`;
  }

  // Add cost summary
  if (fs.existsSync(costsPath)) {
    try {
      const costs = JSON.parse(fs.readFileSync(costsPath, 'utf8'));
      const totalCost = costs.session?.totalCost || 0;
      const taskCount = costs.tasks?.length || 0;

      summary += `## Costs\n\n`;
      summary += `**Total Cost:** $${totalCost.toFixed(4)}\n`;
      summary += `**Tasks:** ${taskCount}\n`;
      if (taskCount > 0) {
        summary += `**Average Cost per Task:** $${(totalCost / taskCount).toFixed(4)}\n\n`;
      }

      // Model usage breakdown
      const modelCounts = {};
      (costs.tasks || []).forEach(task => {
        const model = task.model || 'Unknown';
        modelCounts[model] = (modelCounts[model] || 0) + 1;
      });

      if (Object.keys(modelCounts).length > 0) {
        summary += `### Model Usage\n\n`;
        Object.entries(modelCounts).forEach(([model, count]) => {
          summary += `- ${model}: ${count} tasks\n`;
        });
        summary += `\n`;
      }
    } catch (e) {
      summary += `## Costs\n\n*Error reading cost data*\n\n`;
    }
  }

  summary += `---\n\n`;
  summary += `*Archived by Oroboreo- The Golden Loop*\n`;

  return summary;
}

// ============================================================================
// SMART TEST ARCHIVAL
// ============================================================================

/**
 * Determine if a test file is "reusable" based on filename and content heuristics
 */
function isTestReusable(filename, content) {
  // Filename heuristics
  const filenamePatterns = {
    sessionSpecific: [
      /task-?\d+/i,           // task-36, task36
      /\d{4}-\d{2}-\d{2}/,    // dates
      /session|fix-|bug-/i    // session-specific keywords
    ],
    genericPatterns: [
      /^verify-[a-z]+\.js$/i,    // verify-auth.js
      /^check-[a-z]+\.js$/i,     // check-api-health.js
      /^validate-[a-z]+\.js$/i,  // validate-db-schema.js
      /^test-[a-z]+-flow\.js$/i  // test-login-flow.js
    ]
  };

  // Check if filename contains session-specific patterns
  for (const pattern of filenamePatterns.sessionSpecific) {
    if (pattern.test(filename)) {
      return false; // Session-specific
    }
  }

  // Check if filename matches generic patterns
  for (const pattern of filenamePatterns.genericPatterns) {
    if (pattern.test(filename)) {
      // Additional content check for truly generic tests
      if (content) {
        const sessionSpecificStrings = [
          /userId\s*=\s*\d+/,        // userId = 12345
          /const\s+\w+Id\s*=\s*\d+/, // const testId = 123
          /task\s*\d+/i,             // references to task numbers
          /session|temporary|temp/i  // temporary test indicators
        ];

        for (const pattern of sessionSpecificStrings) {
          if (pattern.test(content)) {
            return false; // Has hard-coded data
          }
        }
      }

      return true; // Generic pattern + no hard-coded data = reusable
    }
  }

  // Default: if unsure, treat as session-specific (safer)
  return false;
}

/**
 * Archive tests with smart reusable detection
 */
function archiveTests(archivePath) {
  const testsDir = path.join(OROBOREO_DIR, 'tests');
  const reusableDir = path.join(testsDir, 'reusable');
  const archiveTestsDir = path.join(archivePath, 'tests');

  if (!fs.existsSync(testsDir)) {
    log('  No tests/ directory found', 'yellow');
    return { reusable: 0, archived: 0 };
  }

  // Ensure reusable directory exists
  if (!fs.existsSync(reusableDir)) {
    fs.mkdirSync(reusableDir, { recursive: true });
    log('  Created tests/reusable/ directory', 'cyan');
  }

  // Ensure archive tests directory exists
  fs.mkdirSync(archiveTestsDir, { recursive: true });

  let reusableCount = 0;
  let archivedCount = 0;

  // Get all test files in tests/ root (not in reusable/)
  const testFiles = fs.readdirSync(testsDir)
    .filter(file => {
      const fullPath = path.join(testsDir, file);
      return fs.statSync(fullPath).isFile() && file.endsWith('.js');
    });

  if (testFiles.length === 0) {
    log('  No test files to archive', 'yellow');
    return { reusable: 0, archived: 0 };
  }

  log(`\n  Analyzing ${testFiles.length} test file(s)...`, 'cyan');

  testFiles.forEach(file => {
    const sourcePath = path.join(testsDir, file);
    const content = fs.readFileSync(sourcePath, 'utf8');

    if (isTestReusable(file, content)) {
      // This is a reusable test
      const reusablePath = path.join(reusableDir, file);

      if (!fs.existsSync(reusablePath)) {
        fs.copyFileSync(sourcePath, reusablePath);
        log(`  ✓ Reusable: ${file} → tests/reusable/`, 'green');
        reusableCount++;
      } else {
        log(`  ○ Already reusable: ${file}`, 'yellow');
      }

      // Remove from tests/ root (now in reusable/)
      fs.unlinkSync(sourcePath);
    } else {
      // This is a session-specific test
      const archivePath = path.join(archiveTestsDir, file);
      fs.copyFileSync(sourcePath, archivePath);
      log(`  ✓ Archived: ${file} → archives/.../tests/`, 'cyan');
      archivedCount++;

      // Remove from tests/ root (now archived)
      fs.unlinkSync(sourcePath);
    }
  });

  return { reusable: reusableCount, archived: archivedCount };
}

// ============================================================================
// SESSION RESET FUNCTIONS
// ============================================================================

/**
 * Extract a 2-sentence summary from the archived session
 */
function extractSessionSummary(archivePath) {
  const tasksPath = path.join(archivePath, 'cookie-crumbs.md');
  if (!fs.existsSync(tasksPath)) return 'No previous session data.';

  const content = fs.readFileSync(tasksPath, 'utf8');

  // Extract session name
  const sessionMatch = content.match(/\*\*Session\*\*:\s*(.+)/i);
  const session = sessionMatch ? sessionMatch[1].trim() : 'Unknown';

  // Count tasks
  const completed = (content.match(/- \[x\]/gi) || []).length;
  const total = (content.match(/- \[[ x]\]/gi) || []).length;

  // Generate 2-sentence summary
  return `Session "${session}" completed ${completed}/${total} tasks. See archives/${path.basename(archivePath)} for details.`;
}

/**
 * Reset all session files to fresh templates
 */
function resetSessionFiles(archivePath) {
  log('\n===============================================================================', 'cyan');
  log('RESET SESSION FILES', 'bright');
  log('===============================================================================\n', 'cyan');

  const timestamp = new Date().toISOString();
  const archiveName = path.basename(archivePath);
  const sessionSummary = extractSessionSummary(archivePath);
  const sessionName = getSessionName();

  // 1. Reset cookie-crumbs.md to template
  const cookieCrumbsTemplate = `# Cookie Crumbs - Task List

<!--
============================================================================
COOKIE-CRUMBS.MD - The Task List (like PRD.md)
============================================================================

This file contains the tasks that oreo-run.js will execute autonomously.
Each task is processed in order. When a task is complete, the agent marks
it [x] and moves to the next one.

USAGE:
  1. Define your feature/session name
  2. Add tasks in the format shown below
  3. Run: node oroboreo/utils/oreo-run.js
  4. Watch the magic happen!

TASK FORMAT:
  - [ ] **Task N: Title** [SIMPLE|COMPLEX|CRITICAL]
    - **Objective:** What needs to be done
    - **Files:** Which files to modify
    - **Details:**
      - Step 1
      - Step 2
    - **Verification:** How to verify it works

COMPLEXITY TAGS:
  [SIMPLE]   -> Uses Haiku ($1/$5 per 1M tokens) - fast, cheap
  [COMPLEX]  -> Uses Sonnet ($3/$15 per 1M tokens) - balanced
  [CRITICAL] -> Uses Sonnet with extra care - important tasks

TIP: The more detail you provide, the better the agent performs!

============================================================================
-->

**Session**: <!-- Session name here -->
**Created**: ${new Date().toISOString().slice(0, 10)}
**Status**: Ready for tasks

---

## Tasks

<!-- Use oreo-generate.js or oreo-feedback.js to create tasks -->
<!-- Or add tasks manually in this format: -->

- [ ] **Task 1: Title** [SIMPLE|COMPLEX|CRITICAL]
  - **Objective:** What needs to be accomplished
  - **Files:** Which files to modify
  - **Details:**
    - Step 1
    - Step 2
  - **Verification:** How to verify (must be scriptable)

---

## Human UI Verification

After all tasks complete, verify:
- [ ] Feature works as expected
- [ ] No regressions introduced
`;

  fs.writeFileSync(path.join(OROBOREO_DIR, 'cookie-crumbs.md'), cookieCrumbsTemplate, 'utf8');
  log('  Reset: cookie-crumbs.md', 'green');

  // 2. Reset human-feedback.md to template
  const feedbackTemplate = `# Human UI Verification Feedback

## Observations
[Describe what you saw during testing]

## Console Logs
[Paste any relevant error logs]

## Regressions
[List things that used to work but are now broken]

## Specific Requests
[Any additional details for the Architect]
`;

  fs.writeFileSync(path.join(OROBOREO_DIR, 'human-feedback.md'), feedbackTemplate, 'utf8');
  log('  Reset: human-feedback.md', 'green');

  // 3. Reset progress.txt with summary + archive reference
  const progressTemplate = `# OroboreoProgress Log

Session initialized: ${timestamp}
Previous session archived: archives/${archiveName}

---

## Previous Session Summary
${sessionSummary}

---

## Current Session Progress
<!-- Agents will append here -->

`;

  fs.writeFileSync(path.join(OROBOREO_DIR, 'progress.txt'), progressTemplate, 'utf8');
  log('  Reset: progress.txt', 'green');

  // 4. Reset costs.json
  const emptyCosts = {
    session: {
      startTime: timestamp,
      totalCost: 0
    },
    tasks: []
  };
  fs.writeFileSync(path.join(OROBOREO_DIR, 'costs.json'), JSON.stringify(emptyCosts, null, 2), 'utf8');
  log('  Reset: costs.json', 'green');

  // 5. Clear oreo-execution.log
  fs.writeFileSync(path.join(OROBOREO_DIR, 'oreo-execution.log'), '', 'utf8');
  log('  Cleared: oreo-execution.log', 'green');

  // 6. Delete temp prompt files
  TEMP_FILES_TO_CLEAN.forEach(file => {
    const filePath = path.join(OROBOREO_DIR, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      log(`  Deleted: ${file}`, 'yellow');
    }
  });

  log('\nSession files reset for next run', 'bright');

  // 7. Git commit and push
  gitCommitArchive(sessionName);

  // 8. Create pull request if enabled
  const prUrl = createPullRequest(sessionName, archivePath);
  if (prUrl) {
    log(`\n📋 Pull Request: ${prUrl}`, 'cyan');
  }
}

/**
 * Commit archive and reset files to Git
 */
function gitCommitArchive(sessionName) {
  log('\n===============================================================================', 'magenta');
  log('GIT BACKUP', 'bright');
  log('===============================================================================\n', 'magenta');

  try {
    // Check if we're in a git repo
    try {
      execSync('git rev-parse --is-inside-work-tree', { cwd: PROJECT_ROOT, stdio: 'ignore' });
    } catch (e) {
      log('  Not a git repository, skipping backup', 'yellow');
      return;
    }

    log('  Staging archive and reset files...', 'cyan');

    // Stage archive folder
    execSync('git add oroboreo/archives/', { stdio: 'ignore', cwd: PROJECT_ROOT });

    // Stage reset files
    const filesToStage = [
      'oroboreo/cookie-crumbs.md',
      'oroboreo/progress.txt',
      'oroboreo/human-feedback.md',
      'oroboreo/costs.json',
      'oroboreo/oreo-execution.log'
    ];
    filesToStage.forEach(file => {
      try {
        execSync(`git add "${file}"`, { stdio: 'ignore', cwd: PROJECT_ROOT });
      } catch (e) {
        // File might not exist, ignore
      }
    });

    // Check if there are changes to commit
    const status = execSync('git status --porcelain', { cwd: PROJECT_ROOT }).toString();
    if (!status.trim()) {
      log('  No changes to commit', 'yellow');
      return;
    }

    // Commit
    log('  Committing archive...', 'cyan');
    execSync(`git commit -m "Archive Session: ${sessionName}"`, { stdio: 'ignore', cwd: PROJECT_ROOT });

    // Push to current branch
    try {
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: PROJECT_ROOT }).toString().trim();
      log(`  Pushing to ${currentBranch}...`, 'cyan');
      execSync(`git push --set-upstream origin ${currentBranch}`, { stdio: 'inherit', cwd: PROJECT_ROOT });
      log('  Git backup complete', 'green');
    } catch (e) {
      log(`  Push failed (commit saved locally): ${e.message}`, 'yellow');
    }
  } catch (e) {
    log(`  Git backup failed: ${e.message}`, 'yellow');
  }
}

/**
 * Create GitHub Pull Request using GitHub CLI
 * Requires: gh CLI installed and authenticated
 */
function createPullRequest(sessionName, archivePath) {
  const GIT_CONFIG = require('./oreo-config').GIT_CONFIG;

  // Skip if disabled
  if (!GIT_CONFIG.autoCreatePR) {
    return null;
  }

  log('\n===============================================================================', 'cyan');
  log('PULL REQUEST CREATION', 'bright');
  log('===============================================================================\n', 'cyan');

  try {
    // Check if gh CLI is available
    try {
      execSync('gh --version', { stdio: 'ignore' });
    } catch (e) {
      log('  ⚠️  GitHub CLI (gh) not installed. Skipping PR creation.', 'yellow');
      log('  Install: https://cli.github.com/', 'cyan');
      return null;
    }

    // Check if gh is authenticated
    try {
      execSync('gh auth status', { stdio: 'ignore' });
    } catch (e) {
      log('  ⚠️  GitHub CLI not authenticated. Run: gh auth login', 'yellow');
      return null;
    }

    // Get current branch
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: PROJECT_ROOT }).toString().trim();

    // Generate PR title and body
    const title = GIT_CONFIG.prTitleFormat.replace('{sessionName}', sessionName);

    const summary = extractSessionSummary(archivePath);
    const tasksMatch = summary.match(/(\d+)\/(\d+) tasks/);
    const tasksCompleted = tasksMatch ? tasksMatch[1] : '?';
    const totalTasks = tasksMatch ? tasksMatch[2] : '?';

    const body = GIT_CONFIG.prBodyTemplate
      .replace('{summary}', summary)
      .replace('{tasksCompleted}', tasksCompleted)
      .replace('{totalTasks}', totalTasks)
      .replace('{archiveName}', path.basename(archivePath));

    // Create PR using gh CLI
    log(`  Creating PR: ${currentBranch} → ${GIT_CONFIG.baseBranch}`, 'cyan');

    const prCommand = `gh pr create --base "${GIT_CONFIG.baseBranch}" --head "${currentBranch}" --title "${title}" --body "${body}"`;
    const prUrl = execSync(prCommand, { cwd: PROJECT_ROOT }).toString().trim();

    log(`  ✅ Pull Request created: ${prUrl}`, 'green');

    // Auto-merge if enabled (with safety checks)
    if (GIT_CONFIG.autoMergeToMain) {
      if (!GIT_CONFIG.allowAutoMerge) {
        log('  ⚠️  Auto-merge is disabled (allowAutoMerge: false)', 'yellow');
        log('  ⚠️  Set allowAutoMerge: true in oreo-config.js to enable (DANGEROUS!)', 'yellow');
        return prUrl;
      }

      log('  ⚠️  AUTO-MERGE ENABLED (This is for development only!)', 'yellow');
      log('  Attempting to merge PR...', 'cyan');

      try {
        // Extract PR number from URL
        const prNumber = prUrl.match(/\/pull\/(\d+)/)?.[1];
        if (prNumber) {
          execSync(`gh pr merge ${prNumber} --merge --delete-branch`, {
            cwd: PROJECT_ROOT,
            stdio: 'inherit'
          });
          log('  ✅ PR merged (preserving commit history) and branch deleted', 'green');
        }
      } catch (e) {
        log(`  ⚠️  Auto-merge failed: ${e.message}`, 'yellow');
        log('  You may need to merge manually or resolve conflicts', 'cyan');
      }
    }

    return prUrl;

  } catch (e) {
    log(`  ❌ PR creation failed: ${e.message}`, 'red');
    log('  You can create the PR manually in GitHub', 'cyan');
    return null;
  }
}

// ============================================================================
// LIST ARCHIVES
// ============================================================================

function listArchives() {
  log('\n===============================================================================', 'yellow');
  log('OROBOREO ARCHIVES', 'bright');
  log('===============================================================================\n', 'yellow');

  if (!fs.existsSync(ARCHIVE_DIR)) {
    log('No archives found yet.', 'cyan');
    return;
  }

  const items = fs.readdirSync(ARCHIVE_DIR);
  const archives = items
    .filter(item => {
      const fullPath = path.join(ARCHIVE_DIR, item);
      try {
        return fs.statSync(fullPath).isDirectory();
      } catch (e) {
        return false;
      }
    })
    .map(item => {
      const fullPath = path.join(ARCHIVE_DIR, item);
      const summaryPath = path.join(fullPath, 'SUMMARY.md');
      const stats = fs.statSync(fullPath);
      return { name: item, path: fullPath, summaryPath, date: stats.mtime };
    })
    .sort((a, b) => b.date - a.date);

  if (archives.length === 0) {
    log('No archived sessions found.', 'cyan');
    return;
  }

  log(`Found ${archives.length} archived session(s):\n`, 'bright');

  archives.forEach((archive, i) => {
    log(`${i + 1}. ${archive.name}`, 'cyan');
    log(`   Date: ${archive.date.toLocaleString()}`, 'reset');

    // Read summary if exists
    if (fs.existsSync(archive.summaryPath)) {
      const summary = fs.readFileSync(archive.summaryPath, 'utf8');
      const costMatch = summary.match(/\*\*Total Cost:\*\* \$([0-9.]+)/);
      const tasksMatch = summary.match(/\*\*Tasks Completed:\*\* (\d+\/\d+)/);

      if (costMatch) log(`   Cost: $${costMatch[1]}`, 'green');
      if (tasksMatch) log(`   Progress: ${tasksMatch[1]}`, 'yellow');
    }

    log('', 'reset');
  });
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--list') || args.includes('-l')) {
    listArchives();
  } else if (args.includes('--help') || args.includes('-h')) {
    log('\nOroboreoArchive\n', 'bright');
    log('Usage:', 'cyan');
    log('  node oroboreo/utils/oreo-archive.js           # Archive current session', 'reset');
    log('  node oroboreo/utils/oreo-archive.js --reset   # Archive and reset for next session', 'reset');
    log('  node oroboreo/utils/oreo-archive.js --list    # List all archives', 'reset');
    log('', 'reset');
  } else {
    const archivePath = archiveSession();
    if (archivePath && args.includes('--reset')) {
      resetSessionFiles(archivePath);
    } else if (archivePath) {
      log('\nTo reset session files for next run, use:', 'cyan');
      log('  node oroboreo/utils/oreo-archive.js --reset', 'yellow');
      log('', 'reset');
    }
  }
}

// Export for use by oreo-run.js
module.exports = { archiveSession, resetSessionFiles };

// Run if called directly
if (require.main === module) {
  main();
}
