/**
 * OREO-STATUS - Enriched Session Status Module
 *
 * Provides a snapshot of the current Oroboreo execution state.
 * Can be imported by any bridge/API for real-time observability.
 *
 * Usage:
 *   const { getSessionStatus } = require('./oreo-status.js');
 *   const status = getSessionStatus();
 *
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import shared state from oreo-run (if loaded as part of the same process)
// Falls back to reading files directly if oreo-run isn't loaded
let oreoRun = null;
try {
  oreoRun = require('./oreo-run.js');
} catch (e) {
  // oreo-run may not be loaded (e.g., standalone bridge usage)
}

const { getPaths } = require('./oreo-config.js');

/**
 * Format milliseconds into a human-readable string
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted string like "5m 30s" or "1h 15m"
 */
function formatElapsed(ms) {
  if (ms < 0) ms = 0;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Read the last N lines from a file
 * @param {string} filePath - Path to the file
 * @param {number} n - Number of lines to read
 * @returns {string[]} Array of last N lines
 */
function tailFile(filePath, n = 5) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    return lines.slice(-n).map(l => l.trim());
  } catch (e) {
    return [];
  }
}

/**
 * Find the most recently modified file in a directory
 * @param {string} projectRoot - Project root path
 * @returns {{ file: string, agoSeconds: number } | null}
 */
function getLastModifiedFile(projectRoot) {
  try {
    const findCmd = `find "${projectRoot}" -type f -mmin -120 -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/oroboreo/archives/*" -printf '%T@ %p\\n' 2>/dev/null | sort -rn | head -1`;
    const result = execSync(findCmd, { timeout: 5000 }).toString().trim();
    if (!result) return null;

    const [timestamp, ...fileParts] = result.split(' ');
    const filePath = fileParts.join(' ');
    const agoSeconds = Math.floor(Date.now() / 1000 - parseFloat(timestamp));
    return {
      file: path.basename(filePath),
      agoSeconds
    };
  } catch (e) {
    return null;
  }
}

/**
 * Parse tasks from cookie-crumbs.md
 * Uses oreo-run's parseTasks if available, otherwise reads directly
 * @param {string} tasksPath - Path to cookie-crumbs.md
 * @returns {Array} Array of task objects
 */
function getTasksStatus(tasksPath) {
  // Try to use oreo-run's parseTasks if available
  if (oreoRun && typeof oreoRun.parseTasks === 'function') {
    return oreoRun.parseTasks();
  }

  // Fallback: read directly
  try {
    if (!fs.existsSync(tasksPath)) return [];
    const content = fs.readFileSync(tasksPath, 'utf8');
    const tasks = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^-\s*\[([ x])\]\s*\*\*Task\s+(\d+):\s*(.+?)\*\*(?:\s*(\[.+?\]))?/i);
      if (match) {
        const [, checkmark, id, title, tag] = match;
        const fullTitle = tag ? `${title.trim()} ${tag}` : title.trim();
        tasks.push({
          id: parseInt(id, 10),
          title: fullTitle,
          completed: checkmark.toLowerCase() === 'x'
        });
      }
    }
    return tasks;
  } catch (e) {
    return [];
  }
}

/**
 * Get enriched session status snapshot
 *
 * @returns {Object} Session status object
 */
function getSessionStatus() {
  const paths = getPaths();
  const progressPath = path.join(process.cwd(), 'oroboreo', 'progress.txt');
  const costsPath = paths.costs;
  const tasksPath = paths.tasks;

  // Get session state from oreo-run if available
  const state = (oreoRun && oreoRun.sessionState) || {};
  const config = (oreoRun && oreoRun.CONFIG) || {};

  // Tasks
  const tasks = getTasksStatus(tasksPath);
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const currentTask = tasks.find(t => !t.completed);

  // Elapsed time
  const taskStartTime = state.taskStartTime || null;
  const elapsedMs = taskStartTime ? Date.now() - taskStartTime : 0;
  const expectedMs = (config.expectedTaskDurationMs) ||
    parseInt(process.env.OREO_EXPECTED_TASK_DURATION_MS || '900000');

  // Session cost from costs.json
  let sessionCost = state.sessionCost || 0;
  if (!sessionCost) {
    try {
      if (fs.existsSync(costsPath)) {
        const costLog = JSON.parse(fs.readFileSync(costsPath, 'utf8'));
        sessionCost = costLog.session?.totalCost || 0;
      }
    } catch (e) {
      // Ignore
    }
  }

  // Provider & model
  const provider = state.provider || (process.env.AI_PROVIDER || 'unknown').toLowerCase();
  const model = state.model || 'unknown';

  return {
    running: state.running || false,
    currentTask: state.currentTask || (currentTask ? {
      id: currentTask.id,
      title: currentTask.title,
      attempt: 1,
      maxAttempts: 5
    } : null),
    tasksComplete: `${completedTasks}/${totalTasks}`,
    lastFileModified: getLastModifiedFile(paths.projectRoot || process.cwd()),
    progressTail: tailFile(progressPath, 5),
    elapsed: {
      ms: elapsedMs,
      formatted: formatElapsed(elapsedMs)
    },
    expectedMs,
    provider,
    model,
    sessionCost
  };
}

module.exports = { getSessionStatus };
