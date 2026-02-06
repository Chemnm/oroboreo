#!/usr/bin/env node
/**
 * OREO-LEARN - Learning Extraction System
 *
 * This script closes the learning loop by extracting patterns from archived
 * sessions and proposing updates to creme-filling.md's SHARED MEMORY section.
 *
 * Uses Claude Sonnet for pattern recognition and automatic categorization
 * into the three SHARED MEMORY subsections.
 *
 * ============================================================================
 * FILE REFERENCES (Oreo Theme)
 * ============================================================================
 *
 * | File               | Purpose                                            |
 * |--------------------|---------------------------------------------------|
 * | archives/          | Source - historical sessions to analyze           |
 * | creme-filling.md   | Target - SHARED MEMORY section gets new learnings |
 * | costs.json         | Cost tracking - learn costs logged here           |
 * | progress.txt       | Session logs - primary source for patterns        |
 * | cookie-crumbs.md   | Task history - secondary source for patterns      |
 *
 * ============================================================================
 * USAGE
 * ============================================================================
 *
 *   # Analyze last 5 sessions (default)
 *   node oroboreo/utils/oreo-learn.js
 *
 *   # Analyze specific number of sessions
 *   node oroboreo/utils/oreo-learn.js --sessions 10
 *
 *   # Auto-approve all (no prompts)
 *   node oroboreo/utils/oreo-learn.js --yes
 *
 *   # Dry run (show proposals without writing)
 *   node oroboreo/utils/oreo-learn.js --dry-run
 *
 *   # Help
 *   node oroboreo/utils/oreo-learn.js --help
 *
 * ============================================================================
 * WORKFLOW
 * ============================================================================
 *
 *   1. Scan archives/ for recent sessions
 *   2. Extract content from progress.txt and cookie-crumbs.md
 *   3. Send to Sonnet for pattern extraction + categorization
 *   4. Deduplicate against existing SHARED MEMORY content
 *   5. Display proposals and get human approval
 *   6. Append approved patterns to appropriate subsections
 *   7. Log cost to costs.json
 *
 * @author Oroboreo - The Golden Loop
 * @version 1.0.0
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { getModelConfig, clearProviderEnv, getPaths, COLORS, COST_FACTORS } = require('./oreo-config.js');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  model: null,  // Will be set after loading env (Sonnet for pattern extraction)
  maxOutputTokens: null,
  paths: {
    ...getPaths(__dirname),
    prompt: path.join(__dirname, '.learn-prompt.txt')
  },
  defaults: {
    sessions: 5  // Default number of sessions to analyze
  }
};

const colors = COLORS;

// ============================================================================
// UTILITIES
// ============================================================================

function log(msg, color = 'reset') {
  console.log(colors[color] + msg + colors.reset);
}

function loadEnv() {
  const locations = [
    path.join(__dirname, '..', '.env')
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

function ensureAwsCredentialsFile() {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const awsDir = path.join(homeDir, '.aws');
  const credentialsFile = path.join(awsDir, 'credentials');

  const provider = (process.env.AI_PROVIDER || 'subscription').toLowerCase();
  if (provider !== 'bedrock') return;

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return;
  }

  if (fs.existsSync(credentialsFile)) {
    return;
  }

  if (!fs.existsSync(awsDir)) {
    log('Creating ~/.aws directory...', 'cyan');
    fs.mkdirSync(awsDir, { recursive: true });
  }

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

function question(rl, prompt) {
  return new Promise(resolve => rl.question(colors.cyan + prompt + colors.reset, resolve));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    sessions: CONFIG.defaults.sessions,
    yes: false,
    dryRun: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--yes' || arg === '-y') {
      options.yes = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--sessions' || arg === '-s') {
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        options.sessions = parseInt(next, 10) || CONFIG.defaults.sessions;
        i++;
      }
    }
  }

  return options;
}

function showHelp() {
  log('\nOROBOREO LEARN - Learning Extraction System\n', 'bright');
  log('Usage:', 'cyan');
  log('  node oroboreo/utils/oreo-learn.js [options]\n', 'reset');
  log('Options:', 'cyan');
  log('  --sessions, -s <n>  Number of recent sessions to analyze (default: 5)', 'reset');
  log('  --yes, -y           Auto-approve all proposed patterns', 'reset');
  log('  --dry-run           Show proposals without writing to file', 'reset');
  log('  --help, -h          Show this help message\n', 'reset');
  log('Examples:', 'cyan');
  log('  node oroboreo/utils/oreo-learn.js', 'reset');
  log('  node oroboreo/utils/oreo-learn.js --sessions 10', 'reset');
  log('  node oroboreo/utils/oreo-learn.js --dry-run', 'reset');
  log('  node oroboreo/utils/oreo-learn.js --yes\n', 'reset');
}

// ============================================================================
// ARCHIVE SCANNER
// ============================================================================

function getRecentArchives(n) {
  if (!fs.existsSync(CONFIG.paths.archives)) return [];

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
    } catch (e) {
      // Ignore errors reading directories
    }
  }

  scanDirectory(CONFIG.paths.archives);

  if (allArchives.length === 0) return [];

  // Sort by full path descending (year/month/name) - most recent first
  allArchives.sort((a, b) => b.path.localeCompare(a.path));

  // Return top N
  return allArchives.slice(0, n);
}

// ============================================================================
// CONTENT EXTRACTOR
// ============================================================================

function extractArchiveContent(archive) {
  const content = {
    name: archive.name,
    path: archive.path,
    progress: '',
    tasks: ''
  };

  const progressPath = path.join(archive.path, 'progress.txt');
  const tasksPath = path.join(archive.path, 'cookie-crumbs.md');

  if (fs.existsSync(progressPath)) {
    try {
      content.progress = fs.readFileSync(progressPath, 'utf8');
    } catch (e) {
      log(`  Warning: Could not read ${progressPath}`, 'yellow');
    }
  }

  if (fs.existsSync(tasksPath)) {
    try {
      content.tasks = fs.readFileSync(tasksPath, 'utf8');
    } catch (e) {
      log(`  Warning: Could not read ${tasksPath}`, 'yellow');
    }
  }

  return content;
}

// ============================================================================
// PATTERN DETECTION PROMPT
// ============================================================================

function buildPatternPrompt(archiveContents, existingSharedMemory) {
  const sessionSummaries = archiveContents.map((content, i) => {
    return `
=== SESSION ${i + 1}: ${content.name} ===

--- PROGRESS LOG ---
${content.progress.slice(0, 10000) || '(empty)'}

--- TASK LIST ---
${content.tasks.slice(0, 5000) || '(empty)'}
`;
  }).join('\n\n');

  return `You are analyzing Oroboreo session logs to extract learnings for the SHARED MEMORY section.

**EXISTING SHARED MEMORY (do not duplicate):**
${existingSharedMemory || '(empty)'}

**SESSION LOGS TO ANALYZE:**
${sessionSummaries}

**YOUR TASK:**

Analyze these session logs and identify learnings. For each pattern, categorize it into ONE of these sections:

1. **Common Pitfalls** (common_pitfalls) - Mistakes that happened, things to avoid
2. **What Works Well** (what_works_well) - Successful patterns, good approaches
3. **Technical Gotchas** (technical_gotchas) - Environment/framework-specific quirks

**OUTPUT FORMAT:**

Return a JSON object with this EXACT structure (no markdown, just raw JSON):

{
  "patterns": [
    {
      "category": "common_pitfalls",
      "title": "Brief title",
      "description": "One-line description with relevant file paths",
      "sessions": ["session-name-1", "session-name-2"],
      "occurrences": 2
    }
  ]
}

**RULES:**
- Only include patterns that appear in 2+ sessions (cross-session learnings)
- Be specific about file paths and code patterns
- Keep descriptions concise (1-2 lines max)
- Mark critical patterns with prefix: "[CRITICAL]"
- DO NOT include patterns already in EXISTING SHARED MEMORY
- If no cross-session patterns found, return: {"patterns": []}
- Return ONLY the JSON object, no explanation or markdown

**IMPORTANT:** Your response must be valid JSON that can be parsed with JSON.parse().
`;
}

// ============================================================================
// DEDUPLICATION
// ============================================================================

function extractExistingSharedMemory() {
  if (!fs.existsSync(CONFIG.paths.rules)) {
    return '';
  }

  const content = fs.readFileSync(CONFIG.paths.rules, 'utf8');

  // Find SHARED MEMORY section
  const sharedMemoryMatch = content.match(/## .*Shared Memory[\s\S]*?(?=\n##\s|---|\*Last updated|$)/i);

  return sharedMemoryMatch ? sharedMemoryMatch[0] : '';
}

function isDuplicate(pattern, existingContent) {
  if (!existingContent) return false;

  const titleLower = pattern.title.toLowerCase();
  const descLower = pattern.description.toLowerCase();

  // Extract keywords from title and description
  const keywords = [...titleLower.split(/\s+/), ...descLower.split(/\s+/)]
    .filter(w => w.length > 3)
    .slice(0, 5);

  // Check if any combination of keywords appears in existing content
  const existingLower = existingContent.toLowerCase();
  const matchCount = keywords.filter(kw => existingLower.includes(kw)).length;

  // Consider duplicate if more than half of keywords match
  return matchCount > keywords.length / 2;
}

// ============================================================================
// FILE WRITER
// ============================================================================

function appendToSharedMemory(patterns) {
  if (patterns.length === 0) return false;

  const rulesPath = CONFIG.paths.rules;
  if (!fs.existsSync(rulesPath)) {
    log('creme-filling.md not found! Run oreo-init.js first.', 'yellow');
    return false;
  }

  let content = fs.readFileSync(rulesPath, 'utf8');

  // Group patterns by category
  const byCategory = {
    common_pitfalls: [],
    what_works_well: [],
    technical_gotchas: []
  };

  patterns.forEach(p => {
    if (byCategory[p.category]) {
      byCategory[p.category].push(p);
    }
  });

  // Insert patterns into each subsection
  const sectionMap = {
    common_pitfalls: '### Common Pitfalls',
    what_works_well: '### What Works Well',
    technical_gotchas: '### Technical Gotchas'
  };

  for (const [category, sectionHeader] of Object.entries(sectionMap)) {
    const patternsForCategory = byCategory[category];
    if (patternsForCategory.length === 0) continue;

    // Find the section
    const sectionIndex = content.indexOf(sectionHeader);
    if (sectionIndex === -1) continue;

    // Find the next section or end marker
    const afterSection = content.slice(sectionIndex + sectionHeader.length);
    const nextSectionMatch = afterSection.match(/\n###\s|\n##\s|\n---/);
    const insertPoint = nextSectionMatch
      ? sectionIndex + sectionHeader.length + nextSectionMatch.index
      : content.length;

    // Build new content
    const newBullets = patternsForCategory.map(p => {
      const prefix = p.title.startsWith('[CRITICAL]') ? '' : '';
      return `- **${prefix}${p.title}**: ${p.description}`;
    }).join('\n');

    // Insert after existing bullets or after section header
    content = content.slice(0, insertPoint) +
              '\n' + newBullets +
              content.slice(insertPoint);
  }

  // Update last updated date
  const dateStr = new Date().toISOString().slice(0, 10);
  content = content.replace(/\*Last updated:.*\*/, `*Last updated: ${dateStr}*`);

  // Write back
  fs.writeFileSync(rulesPath, content, 'utf8');
  return true;
}

// ============================================================================
// COST TRACKING
// ============================================================================

function logLearnCost(promptSize, responseSize) {
  const inputTokens = Math.ceil((promptSize / 4) * COST_FACTORS.WORKER.TOOL_USE_FACTOR);
  const outputTokens = Math.ceil((responseSize / 4) * COST_FACTORS.WORKER.OUTPUT_MULTIPLIER);

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
    taskId: 'LEARN',
    taskTitle: 'Learning Extraction',
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

  log(`\nLearn Cost: $${totalCost.toFixed(4)}`, 'magenta');
  log(`(Estimated: ${inputTokens} input, ${outputTokens} output tokens)`, 'cyan');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  log('\n===============================================================================', 'yellow');
  log('OROBOREO LEARN - Learning Extraction', 'bright');
  log('===============================================================================\n', 'yellow');

  // Load environment
  if (!loadEnv()) {
    log('No .env file found in oroboreo directory', 'yellow');
  }

  // Ensure AWS credentials file exists
  ensureAwsCredentialsFile();

  // Set up provider-aware models - use Sonnet for pattern extraction
  const MODELS = getModelConfig();
  CONFIG.model = MODELS.SONNET;
  CONFIG.maxOutputTokens = String(MODELS.SONNET.maxOutput);

  // Configure provider-specific settings
  const provider = (process.env.AI_PROVIDER || 'subscription').toLowerCase();
  log(`AI Provider: ${provider}`);
  log(`Model: ${CONFIG.model.name}`);
  log(`Sessions to analyze: ${options.sessions}`);
  if (options.dryRun) log('Mode: DRY RUN (no changes will be made)', 'yellow');
  if (options.yes) log('Mode: AUTO-APPROVE (all patterns will be accepted)', 'yellow');
  log('');

  // Validate provider
  if (provider === 'bedrock') {
    if (!process.env.AWS_ACCESS_KEY_ID) {
      log('AWS_ACCESS_KEY_ID not set! Please configure oroboreo/.env', 'yellow');
      process.exit(1);
    }
    process.env.CLAUDE_CODE_USE_BEDROCK = '1';
    process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  } else if (provider === 'foundry') {
    if (!process.env.ANTHROPIC_FOUNDRY_API_KEY) {
      log('ANTHROPIC_FOUNDRY_API_KEY not set! Please configure oroboreo/.env', 'yellow');
      process.exit(1);
    }
    process.env.CLAUDE_CODE_USE_FOUNDRY = '1';
  } else if (provider === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY) {
      log('ANTHROPIC_API_KEY not set! Please configure oroboreo/.env', 'yellow');
      process.exit(1);
    }
  } else if (provider !== 'subscription') {
    log(`Invalid AI_PROVIDER: ${provider}. Valid options: bedrock, foundry, anthropic, subscription`, 'yellow');
    process.exit(1);
  }

  // Step 1: Scan archives
  log('Scanning archives...', 'cyan');
  const archives = getRecentArchives(options.sessions);

  if (archives.length === 0) {
    log('\nNo archives found in oroboreo/archives/', 'yellow');
    log('Run some sessions with oreo-run.js first to generate archives.', 'cyan');
    process.exit(0);
  }

  log(`Found ${archives.length} archive(s):\n`, 'green');
  archives.forEach((a, i) => {
    const relativePath = path.relative(CONFIG.paths.projectRoot, a.path);
    log(`  ${i + 1}. ${relativePath}`, 'reset');
  });
  log('');

  // Step 2: Extract content
  log('Extracting content from archives...', 'cyan');
  const archiveContents = archives.map(a => extractArchiveContent(a));

  // Step 3: Get existing SHARED MEMORY for deduplication
  const existingSharedMemory = extractExistingSharedMemory();
  if (existingSharedMemory) {
    log('Loaded existing SHARED MEMORY for deduplication', 'green');
  }

  // Step 4: Build and execute AI prompt
  log('\nAnalyzing patterns with Sonnet...', 'cyan');
  log('(This may take 15-30 seconds)\n', 'yellow');

  const prompt = buildPatternPrompt(archiveContents, existingSharedMemory);
  fs.writeFileSync(CONFIG.paths.prompt, prompt);

  // Spawn Claude Code
  const scriptExt = process.platform === 'win32' ? '.bat' : '.sh';
  const batFile = path.join(__dirname, `run-with-prompt${scriptExt}`);

  // Clear provider env and set up fresh
  clearProviderEnv();

  const env = {
    ...process.env,
    CLAUDE_CODE_MAX_OUTPUT_TOKENS: CONFIG.maxOutputTokens,
    FORCE_COLOR: '1'
  };

  // Provider-specific configuration
  if (provider === 'bedrock') {
    env.ANTHROPIC_MODEL = CONFIG.model.id;
    env.CLAUDE_CODE_USE_BEDROCK = '1';
    env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
    env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
    env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
  } else if (provider === 'foundry') {
    env.ANTHROPIC_MODEL = CONFIG.model.id;
    env.CLAUDE_CODE_USE_FOUNDRY = '1';
    env.ANTHROPIC_FOUNDRY_API_KEY = process.env.ANTHROPIC_FOUNDRY_API_KEY;
    if (process.env.ANTHROPIC_FOUNDRY_RESOURCE) {
      env.ANTHROPIC_FOUNDRY_RESOURCE = process.env.ANTHROPIC_FOUNDRY_RESOURCE;
    }
    if (process.env.ANTHROPIC_FOUNDRY_BASE_URL) {
      env.ANTHROPIC_FOUNDRY_BASE_URL = process.env.ANTHROPIC_FOUNDRY_BASE_URL;
    }
  } else if (provider === 'anthropic') {
    env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  }

  // Execute and capture output
  const result = await new Promise((resolve, reject) => {
    let outputBuffer = '';

    const child = spawn(batFile, [CONFIG.paths.prompt], {
      env,
      cwd: CONFIG.paths.projectRoot,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout.on('data', (data) => {
      outputBuffer += data.toString();
    });

    child.stderr.on('data', (data) => {
      outputBuffer += data.toString();
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve(outputBuffer);
      } else {
        reject(new Error(`Claude Code exited with code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });

  // Log cost
  const promptContent = fs.readFileSync(CONFIG.paths.prompt, 'utf8');
  logLearnCost(promptContent.length, result.length);

  // Step 5: Parse patterns from response
  let patterns = [];
  try {
    // Find JSON in output (Claude may include some explanation)
    const jsonMatch = result.match(/\{[\s\S]*"patterns"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      patterns = parsed.patterns || [];
    }
  } catch (e) {
    log(`\nFailed to parse patterns from AI response: ${e.message}`, 'yellow');
    log('Raw response saved to .learn-prompt.txt for debugging', 'cyan');
    process.exit(1);
  }

  // Step 6: Filter duplicates
  const originalCount = patterns.length;
  patterns = patterns.filter(p => !isDuplicate(p, existingSharedMemory));

  if (patterns.length === 0) {
    if (originalCount > 0) {
      log(`\nFound ${originalCount} pattern(s), but all are duplicates of existing SHARED MEMORY.`, 'yellow');
    } else {
      log('\nNo cross-session patterns found.', 'yellow');
    }
    log('Nothing to add to creme-filling.md', 'cyan');
    process.exit(0);
  }

  log(`\nFound ${patterns.length} new pattern(s) (${originalCount - patterns.length} duplicates filtered):\n`, 'green');

  // Step 7: Interactive approval
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const approved = [];
  const categoryNames = {
    common_pitfalls: 'Common Pitfalls',
    what_works_well: 'What Works Well',
    technical_gotchas: 'Technical Gotchas'
  };

  for (let i = 0; i < patterns.length; i++) {
    const p = patterns[i];
    const categoryDisplay = categoryNames[p.category] || p.category;

    log('-------------------------------------------------------------------------------', 'cyan');
    log(`Pattern ${i + 1}/${patterns.length}`, 'bright');
    log(`Category: ${categoryDisplay}`, 'yellow');
    log(`Title: ${p.title}`, 'green');
    log(`Description: ${p.description}`, 'reset');
    log(`Sessions: ${p.sessions.join(', ')}`, 'cyan');
    log(`Occurrences: ${p.occurrences}`, 'cyan');
    log('-------------------------------------------------------------------------------', 'cyan');

    if (options.dryRun) {
      log('(Dry run - would be added)\n', 'yellow');
      approved.push(p);
      continue;
    }

    if (options.yes) {
      log('(Auto-approved)\n', 'green');
      approved.push(p);
      continue;
    }

    const answer = await question(rl, '\nAdd to creme-filling.md? [y/n/a(ll)/s(kip all)]: ');
    const choice = answer.toLowerCase().trim();

    if (choice === 'y' || choice === 'yes') {
      approved.push(p);
      log('Approved\n', 'green');
    } else if (choice === 'a' || choice === 'all') {
      approved.push(p);
      // Approve all remaining
      for (let j = i + 1; j < patterns.length; j++) {
        approved.push(patterns[j]);
      }
      log(`Approved all ${patterns.length - i} remaining patterns\n`, 'green');
      break;
    } else if (choice === 's' || choice === 'skip') {
      log('Skipped all remaining patterns\n', 'yellow');
      break;
    } else {
      log('Skipped\n', 'yellow');
    }
  }

  rl.close();

  // Step 8: Write to file
  if (approved.length === 0) {
    log('\nNo patterns approved. creme-filling.md unchanged.', 'yellow');
    process.exit(0);
  }

  if (options.dryRun) {
    log(`\nDry run complete. Would have added ${approved.length} pattern(s) to creme-filling.md`, 'yellow');
    process.exit(0);
  }

  log(`\nWriting ${approved.length} pattern(s) to creme-filling.md...`, 'cyan');

  const success = appendToSharedMemory(approved);

  if (success) {
    log('\n===============================================================================', 'yellow');
    log('LEARNING EXTRACTION COMPLETE!', 'bright');
    log('===============================================================================\n', 'yellow');
    log(`Patterns added: ${approved.length}`, 'green');
    log('Location: oroboreo/creme-filling.md (SHARED MEMORY section)', 'cyan');
    log('\nReview the changes with:', 'bright');
    log('  git diff oroboreo/creme-filling.md\n', 'magenta');
  } else {
    log('\nFailed to write patterns to creme-filling.md', 'yellow');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
