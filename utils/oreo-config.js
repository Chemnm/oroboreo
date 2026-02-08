const path = require('path');
const fs = require('fs');

// ============================================================================
// BEDROCK MODELS - Single Source of Truth
// ============================================================================

// Bedrock Model IDs (for AWS Bedrock)
const MODELS = {
  OPUS: {
    id: 'us.anthropic.claude-opus-4-6-v1',
    name: 'Claude Opus 4.6',
    inputCost: 5.0,
    outputCost: 25.0,
    maxOutput: 100000,
    maxThinking: 32000
    // Previous: 'us.anthropic.claude-opus-4-5-20251101-v1:0' (Opus 4.5)
  },
  SONNET: {
    id: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    name: 'Claude Sonnet 4.5',
    inputCost: 3.0,
    outputCost: 15.0,
    maxOutput: 20000,
    maxThinking: 0
  },
  HAIKU: {
    id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    name: 'Claude Haiku 4.5',
    inputCost: 1.0,
    outputCost: 5.0,
    maxOutput: 8192,
    maxThinking: 0
  }
};

// Anthropic API Model IDs (for direct Claude API)
// Using simple aliases as documented in https://code.claude.com/docs/en/model-config.md
// These aliases automatically resolve to the latest model
const ANTHROPIC_MODELS = {
  OPUS: {
    id: 'opus-4-6',
    name: 'Claude Opus 4.6',
    inputCost: 5.0,
    outputCost: 25.0,
    maxOutput: 100000,
    maxThinking: 32000
    // Previous: 'opus-4-5' (Opus 4.5)
  },
  SONNET: {
    id: 'sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    inputCost: 3.0,
    outputCost: 15.0,
    maxOutput: 20000,
    maxThinking: 0
  },
  HAIKU: {
    id: 'haiku-4-5',
    name: 'Claude Haiku 4.5',
    inputCost: 1.0,
    outputCost: 5.0,
    maxOutput: 8192,
    maxThinking: 0
  }
};

// Microsoft Foundry Model IDs (for Azure AI Foundry)
// Uses @anthropic-ai/foundry-sdk package
// Docs: https://platform.claude.com/docs/en/build-with-claude/claude-in-microsoft-foundry
const FOUNDRY_MODELS = {
  OPUS: {
    id: 'azureml://registries/azureml-anthropic/models/claude-opus-4-6/versions/1',
    name: 'Claude Opus 4.6',
    inputCost: 5.0,
    outputCost: 25.0,
    maxOutput: 100000,
    maxThinking: 32000
    // Previous: 'claude-opus-4-5' (Opus 4.5)
  },
  SONNET: {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    inputCost: 3.0,
    outputCost: 15.0,
    maxOutput: 20000,
    maxThinking: 0
  },
  HAIKU: {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    inputCost: 1.0,
    outputCost: 5.0,
    maxOutput: 8192,
    maxThinking: 0
  }
};

// ============================================================================
// PROVIDER-AWARE MODEL CONFIGURATION
// ============================================================================

/**
 * Clears all provider-specific environment variables
 * This prevents conflicts when switching between providers
 * Works cross-platform (Windows, macOS, Linux)
 */
function clearProviderEnv() {
  // AWS Bedrock variables
  delete process.env.CLAUDE_CODE_USE_BEDROCK;
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.AWS_REGION;

  // Anthropic API variables
  delete process.env.ANTHROPIC_API_KEY;

  // Microsoft Foundry variables (single resource - legacy)
  delete process.env.ANTHROPIC_FOUNDRY_API_KEY;
  delete process.env.ANTHROPIC_FOUNDRY_RESOURCE;
  delete process.env.ANTHROPIC_FOUNDRY_BASE_URL;

  // Microsoft Foundry variables (per-model resources)
  delete process.env.ANTHROPIC_FOUNDRY_RESOURCE_OPUS;
  delete process.env.ANTHROPIC_FOUNDRY_RESOURCE_SONNET;
  delete process.env.ANTHROPIC_FOUNDRY_RESOURCE_HAIKU;
  delete process.env.ANTHROPIC_FOUNDRY_BASE_URL_OPUS;
  delete process.env.ANTHROPIC_FOUNDRY_BASE_URL_SONNET;
  delete process.env.ANTHROPIC_FOUNDRY_BASE_URL_HAIKU;

  // Shared variables that can cause conflicts
  delete process.env.ANTHROPIC_MODEL;
}

/**
 * Returns the Foundry resource/URL for a specific model
 * Supports per-model resources with fallback to single resource
 * @param {string} modelName - 'OPUS', 'SONNET', or 'HAIKU'
 * @returns {Object} { resource, baseUrl } - The resource name or base URL for the model
 */
function getFoundryResource(modelName) {
  const resourceKey = `ANTHROPIC_FOUNDRY_RESOURCE_${modelName}`;
  const urlKey = `ANTHROPIC_FOUNDRY_BASE_URL_${modelName}`;

  return {
    resource: process.env[resourceKey] || process.env.ANTHROPIC_FOUNDRY_RESOURCE,
    baseUrl: process.env[urlKey] || process.env.ANTHROPIC_FOUNDRY_BASE_URL
  };
}

/**
 * Checks if Foundry is properly configured (at least one resource available)
 * @returns {boolean} True if Foundry has valid configuration
 */
function hasFoundryConfig() {
  // Check for single resource (legacy)
  if (process.env.ANTHROPIC_FOUNDRY_RESOURCE || process.env.ANTHROPIC_FOUNDRY_BASE_URL) {
    return true;
  }
  // Check for any per-model resource
  if (process.env.ANTHROPIC_FOUNDRY_RESOURCE_OPUS || process.env.ANTHROPIC_FOUNDRY_BASE_URL_OPUS ||
      process.env.ANTHROPIC_FOUNDRY_RESOURCE_SONNET || process.env.ANTHROPIC_FOUNDRY_BASE_URL_SONNET ||
      process.env.ANTHROPIC_FOUNDRY_RESOURCE_HAIKU || process.env.ANTHROPIC_FOUNDRY_BASE_URL_HAIKU) {
    return true;
  }
  return false;
}

/**
 * Returns the appropriate model configuration based on AI_PROVIDER env var
 * @returns {Object} MODELS object (Bedrock, Anthropic API, Foundry, or Subscription)
 */
function getModelConfig() {
  const provider = (process.env.AI_PROVIDER || 'subscription').toLowerCase();

  if (provider === 'bedrock') {
    return MODELS;
  } else if (provider === 'foundry') {
    return FOUNDRY_MODELS;
  } else {
    // Both 'anthropic' and 'subscription' use the same model aliases
    // The difference is in authentication (API key vs. claude.ai account)
    return ANTHROPIC_MODELS;
  }
}

// ============================================================================
// COMMON PATHS
// ============================================================================

/**
 * Returns paths for user files based on current working directory.
 * All user files go in {cwd}/oroboreo/ subfolder.
 * Works for both NPM install and cloned repo scenarios.
 */
function getPaths() {
  const oroboreoDir = path.join(process.cwd(), 'oroboreo');
  return {
    oroboreoDir: oroboreoDir,
    tasks: path.join(oroboreoDir, 'cookie-crumbs.md'),
    rules: path.join(oroboreoDir, 'creme-filling.md'),
    costs: path.join(oroboreoDir, 'costs.json'),
    progress: path.join(oroboreoDir, 'progress.txt'),
    feedback: path.join(oroboreoDir, 'human-feedback.md'),
    env: path.join(oroboreoDir, '.env'),
    log: path.join(oroboreoDir, 'oreo-execution.log'),
    archives: path.join(oroboreoDir, 'archives'),
    projectRoot: process.cwd()
  };
}

// ============================================================================
// COLORS
// ============================================================================

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// ============================================================================
// COST TRACKING CONSTANTS
// ============================================================================

const COST_FACTORS = {
  // For architect (Opus) - heavy tool use
  ARCHITECT: {
    BASELINE_CONTEXT_TOKENS: 15000,
    TOOL_USE_FACTOR: 3.5,
    OUTPUT_MULTIPLIER: 2.0
  },
  // For init (Sonnet) - moderate tool use
  INIT: {
    BASELINE_CONTEXT_TOKENS: 5000,
    TOOL_USE_FACTOR: 2.0,
    OUTPUT_MULTIPLIER: 1.5
  },
  // For worker tasks - light tool use
  WORKER: {
    TOOL_USE_FACTOR: 1.5,
    OUTPUT_MULTIPLIER: 1.2
  }
};

// ============================================================================
// GIT CONFIGURATION
// ============================================================================
//
// IMPORTANT: Pull Request Automation
//
// - autoCreatePR: Creates PR automatically after session completes
//   Requires: GitHub CLI (gh) installed and authenticated
//   Safe for: All environments
//
// - autoMergeToMain: Automatically merges PR to main branch
//   Requires: autoCreatePR: true AND allowAutoMerge: true
//   WARNING: This bypasses code review! Only use in:
//     - Personal development projects
//     - Local testing environments
//     - Non-production repos
//   NEVER use in:
//     - Team projects
//     - Production repositories
//     - Open source projects
//
// - allowAutoMerge: Safety flag to prevent accidental auto-merge
//   Must be explicitly set to true to enable autoMergeToMain
//
// ============================================================================

/**
 * Helper to parse boolean env vars with a default value
 */
function envBool(key, defaultValue) {
  const val = process.env[key];
  if (val === undefined || val === '') return defaultValue;
  return val === 'true' || val === '1';
}

/**
 * Returns GIT_CONFIG by reading env vars at call time (not module load time).
 * This ensures .env values are available even when oreo-config.js is
 * require()'d before loadEnv() runs.
 */
function getGitConfig() {
  return {
    // Always commits to branch after archive
    autoCommit: envBool('GIT_AUTO_COMMIT', true),

    // Create pull request after successful session
    autoCreatePR: envBool('GIT_AUTO_CREATE_PR', true),

    // Auto-merge PR to main (DANGEROUS - dev only!)
    autoMergeToMain: envBool('GIT_AUTO_MERGE', false),

    // Safety: Prevent auto-merge in production
    // Must be explicitly set to true to enable autoMergeToMain
    allowAutoMerge: envBool('GIT_ALLOW_AUTO_MERGE', false),

    // PR base branch (usually 'main' or 'master')
    baseBranch: process.env.GIT_BASE_BRANCH || 'main',

    // PR title format
    prTitleFormat: process.env.GIT_PR_TITLE_FORMAT || 'Oroboreo: {sessionName}',

    // PR body template
    prBodyTemplate: `
## Session Summary
{summary}

## Tasks Completed
{tasksCompleted}/{totalTasks}

## Archive
See \`oroboreo/archives/{archiveName}\` for full session logs.

🤖 Generated by [Oroboreo](https://oroboreo.dev) - The Golden Loop
    `.trim()
  };
}

// ============================================================================
// REUSABLE UTILITIES SYNC
// ============================================================================

/**
 * Syncs reusable test utilities from the package to the user's project.
 * Called on every oro-run, oro-generate, and oro-feedback invocation.
 *
 * - Creates oroboreo/tests/reusable/ if it doesn't exist
 * - Copies new files that don't exist in the user's project
 * - Updates existing files if the package version is newer (by comparing content)
 *
 * This ensures users who update via `npm update -g @oroboreo/cli` get
 * the latest utilities without re-running oro-init.
 */
function syncReusableUtils() {
  const packageTestsDir = path.join(__dirname, '..', 'tests');
  const userOroboreoDir = path.join(process.cwd(), 'oroboreo');
  const userTestsDir = path.join(userOroboreoDir, 'tests');
  const userReusableDir = path.join(userTestsDir, 'reusable');

  // Only sync if the user has an oroboreo directory (project is initialized)
  if (!fs.existsSync(userOroboreoDir)) return;

  // Ensure directories exist
  if (!fs.existsSync(userReusableDir)) {
    fs.mkdirSync(userReusableDir, { recursive: true });
  }

  // Files to sync from package -> user project
  const filesToSync = [
    { src: path.join(packageTestsDir, 'README.md'), dest: path.join(userTestsDir, 'README.md') },
    { src: path.join(packageTestsDir, 'reusable', 'README.md'), dest: path.join(userReusableDir, 'README.md') },
    { src: path.join(packageTestsDir, 'reusable', 'browser-utils.js'), dest: path.join(userReusableDir, 'browser-utils.js') },
    { src: path.join(packageTestsDir, 'reusable', 'verify-ui.js'), dest: path.join(userReusableDir, 'verify-ui.js') }
  ];

  for (const file of filesToSync) {
    if (!fs.existsSync(file.src)) continue;

    const srcContent = fs.readFileSync(file.src, 'utf8');

    if (!fs.existsSync(file.dest)) {
      // File doesn't exist in user project - copy it
      fs.writeFileSync(file.dest, srcContent, 'utf8');
    } else {
      // File exists - update if package version is different
      const destContent = fs.readFileSync(file.dest, 'utf8');
      if (srcContent !== destContent) {
        fs.writeFileSync(file.dest, srcContent, 'utf8');
      }
    }
  }
}

module.exports = {
  MODELS,
  ANTHROPIC_MODELS,
  FOUNDRY_MODELS,
  getModelConfig,
  clearProviderEnv,
  getFoundryResource,
  hasFoundryConfig,
  getPaths,
  syncReusableUtils,
  COLORS,
  COST_FACTORS,
  getGitConfig
};
