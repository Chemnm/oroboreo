#!/usr/bin/env node
/**
 * OREO-DIAGNOSE - Post-Mortem Analysis Tool
 *
 * Analyzes oreo-execution.log to identify hangs, timeouts, and failures.
 * Helps diagnose what went wrong in failed or hung Oroboreo sessions.
 *
 * ============================================================================
 * USAGE
 * ============================================================================
 *
 *   node oroboreo/utils/oreo-diagnose.js
 *
 *   # Or specify a custom log file
 *   node oroboreo/utils/oreo-diagnose.js path/to/custom.log
 *
 * @author Oroboreo - The Golden Loop
 * @version 1.0.0
 */

const fs = require('fs');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function colorize(text, color) {
  return `${COLORS[color] || COLORS.reset}${text}${COLORS.reset}`;
}

function analyzeLog(logPath) {
  if (!fs.existsSync(logPath)) {
    console.log(colorize(`\nError: Log file not found: ${logPath}`, 'red'));
    console.log('Run oreo-run.js at least once to generate logs.\n');
    return;
  }

  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');

  const tasks = [];
  let currentTask = null;

  // Parse log file
  for (const line of lines) {
    // Match task start: [timestamp] [INFO] Task N: Title
    if (line.includes('[INFO] Task') && line.match(/Task \d+:/)) {
      const match = line.match(/Task (\d+): (.+)/);
      if (match) {
        currentTask = {
          id: match[1],
          title: match[2],
          startTime: line.match(/\[(.*?)\]/)[1],
          events: [],
          spawned: false,
          completed: false,
          pid: null
        };
        tasks.push(currentTask);
      }
    }

    // Track all events for current task
    if (currentTask) {
      currentTask.events.push(line);

      // Track important events
      if (line.includes('Spawning Claude Code agent')) {
        currentTask.spawned = true;
      }

      if (line.includes('Agent spawned (PID:')) {
        const pidMatch = line.match(/PID: (\d+)/);
        if (pidMatch) currentTask.pid = pidMatch[1];
      }

      if (line.includes('[SUCCESS]') || line.includes('COMPLETED!')) {
        currentTask.completed = true;
        currentTask.endTime = line.match(/\[(.*?)\]/)[1];
      }

      if (line.includes('timeout')) {
        currentTask.timedOut = true;
      }

      if (line.includes('Git operation timeout')) {
        currentTask.gitTimeout = true;
      }
    }
  }

  // Print analysis
  console.log('\n' + '='.repeat(80));
  console.log(colorize('OROBOREO POST-MORTEM ANALYSIS', 'cyan'));
  console.log('='.repeat(80) + '\n');

  console.log(colorize(`Log file: ${logPath}`, 'white'));
  console.log(colorize(`Total tasks found: ${tasks.length}`, 'white'));
  console.log('');

  // Identify hung tasks
  console.log(colorize('=== HUNG TASKS (spawned but never completed) ===', 'yellow'));
  console.log('');

  let hungCount = 0;
  for (const task of tasks) {
    if (task.spawned && !task.completed) {
      hungCount++;
      console.log(colorize(`Task ${task.id}: ${task.title}`, 'red'));
      console.log(`  Started:  ${task.startTime}`);
      if (task.pid) console.log(`  PID:      ${task.pid}`);
      console.log(`  Status:   ${colorize('HUNG (never completed)', 'red')}`);
      if (task.timedOut) {
        console.log(`  Cause:    ${colorize('Task execution timeout (30 minutes)', 'yellow')}`);
      } else if (task.gitTimeout) {
        console.log(`  Cause:    ${colorize('Git operation timeout (1 minute)', 'yellow')}`);
      } else {
        console.log(`  Cause:    ${colorize('Unknown - no timeout logged', 'yellow')}`);
      }

      // Find last event
      const lastEvent = task.events[task.events.length - 1];
      const lastTimestamp = lastEvent.match(/\[(.*?)\]/);
      if (lastTimestamp) {
        const hangDuration = calculateDuration(task.startTime, lastTimestamp[1]);
        console.log(`  Duration: ${hangDuration}`);
      }
      console.log(`  Last log: ${lastEvent.substring(0, 100)}...`);
      console.log('');
    }
  }

  if (hungCount === 0) {
    console.log(colorize('  No hung tasks found ✓', 'green'));
    console.log('');
  }

  // Show completed tasks
  console.log(colorize('=== COMPLETED TASKS ===', 'green'));
  console.log('');

  for (const task of tasks) {
    if (task.completed && task.startTime && task.endTime) {
      const duration = calculateDuration(task.startTime, task.endTime);
      console.log(colorize(`Task ${task.id}: ${duration}`, 'green'));
    }
  }

  if (tasks.filter(t => t.completed).length === 0) {
    console.log(colorize('  No completed tasks found', 'yellow'));
  }

  console.log('');

  // Show failed/incomplete tasks
  console.log(colorize('=== FAILED/INCOMPLETE TASKS ===', 'yellow'));
  console.log('');

  let failedCount = 0;
  for (const task of tasks) {
    if (!task.spawned || (!task.completed && !task.spawned)) {
      failedCount++;
      console.log(colorize(`Task ${task.id}: ${task.title}`, 'yellow'));
      console.log(`  Status: ${task.spawned ? 'Started but not completed' : 'Never started'}`);
      console.log('');
    }
  }

  if (failedCount === 0) {
    console.log(colorize('  No failed tasks found ✓', 'green'));
  }

  console.log('');

  // Summary
  console.log('='.repeat(80));
  console.log(colorize('SUMMARY', 'cyan'));
  console.log('='.repeat(80) + '\n');

  const completedCount = tasks.filter(t => t.completed).length;
  const hungTaskCount = tasks.filter(t => t.spawned && !t.completed).length;

  console.log(`Total tasks:      ${tasks.length}`);
  console.log(colorize(`Completed:        ${completedCount}`, 'green'));
  console.log(colorize(`Hung:             ${hungTaskCount}`, hungTaskCount > 0 ? 'red' : 'green'));
  console.log(colorize(`Failed:           ${failedCount}`, failedCount > 0 ? 'yellow' : 'green'));
  console.log('');

  if (hungCount > 0) {
    console.log(colorize('⚠️  RECOMMENDATION:', 'yellow'));
    console.log('  - Hung tasks detected. The improvements in oreo-run.js should prevent this.');
    console.log('  - Check network connectivity, GitHub status, and AWS Bedrock status.');
    console.log('  - Review the execution log for more details.');
    console.log('');
  } else if (completedCount === tasks.length && tasks.length > 0) {
    console.log(colorize('✅ All tasks completed successfully!', 'green'));
    console.log('');
  }
}

function calculateDuration(startTime, endTime) {
  try {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  } catch (e) {
    return 'unknown';
  }
}

// Main
const { getPaths } = require('./oreo-config.js');

const customLogPath = process.argv[2];
const defaultLogPath = getPaths().log;
const logPath = customLogPath || defaultLogPath;

analyzeLog(logPath);
