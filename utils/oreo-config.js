const path = require('path');

// ============================================================================
// BEDROCK MODELS - Single Source of Truth
// ============================================================================

// Bedrock Model IDs (for AWS Bedrock)
const MODELS = {
  OPUS: {
    id: 'us.anthropic.claude-opus-4-5-20251101-v1:0',
    name: 'Claude Opus 4.5',
    inputCost: 5.0,
    outputCost: 25.0,
    maxOutput: 100000,
    maxThinking: 32000
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
    id: 'opus-4-5',
    name: 'Claude Opus 4.5',
    inputCost: 5.0,
    outputCost: 25.0,
    maxOutput: 100000,
    maxThinking: 32000
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

  // Shared variables that can cause conflicts
  delete process.env.ANTHROPIC_MODEL;
}

/**
 * Returns the appropriate model configuration based on AI_PROVIDER env var
 * @returns {Object} MODELS object (Bedrock, Anthropic API, or Subscription)
 */
function getModelConfig() {
  const provider = (process.env.AI_PROVIDER || 'subscription').toLowerCase();

  // Both 'anthropic' and 'subscription' use the same model aliases
  // The difference is in authentication (API key vs. claude.ai account)
  return (provider === 'bedrock') ? MODELS : ANTHROPIC_MODELS;
}

// ============================================================================
// COMMON PATHS
// ============================================================================

function getPaths(baseDir) {
  return {
    tasks: path.join(baseDir, '..', 'cookie-crumbs.md'),
    rules: path.join(baseDir, '..', 'creme-filling.md'),
    costs: path.join(baseDir, '..', 'costs.json'),
    archives: path.join(baseDir, '..', 'archives'),
    projectRoot: path.join(baseDir, '..', '..')
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

const GIT_CONFIG = {
  // Always commits to branch after archive
  autoCommit: true,

  // Create pull request after successful session
  autoCreatePR: true,  // Set to true to auto-create PR via GitHub CLI

  // Auto-merge PR to main (DANGEROUS - dev only!)
  autoMergeToMain: false,  // Requires autoCreatePR: true and allowAutoMerge: true

  // Safety: Prevent auto-merge in production
  // Set to true to allow autoMergeToMain (requires manual confirmation)
  allowAutoMerge: false,

  // PR base branch (usually 'main' or 'master')
  baseBranch: 'main',

  // PR title format
  prTitleFormat: 'Oroboreos: {sessionName}',  // {sessionName} will be replaced

  // PR body template
  prBodyTemplate: `
## Session Summary
{summary}

## Tasks Completed
{tasksCompleted}/{totalTasks}

## Archive
See \`oroboreo/archives/{archiveName}\` for full session logs.

🤖 Generated by [Oroboreos](https://github.com/user/oroboreo) - The Golden Loop
  `.trim()
};

module.exports = {
  MODELS,
  ANTHROPIC_MODELS,
  getModelConfig,
  clearProviderEnv,
  getPaths,
  COLORS,
  COST_FACTORS,
  GIT_CONFIG
};
