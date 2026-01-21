#!/usr/bin/env node
/**
 * 🍪 OROBOREO INSTALLER
 *
 * Copies Oroboreointo any project and runs initialization.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(msg, color = 'reset') {
  console.log(colors[color] + msg + colors.reset);
}

function question(prompt) {
  return new Promise(resolve => rl.question(colors.cyan + prompt + colors.reset, resolve));
}

async function main() {
  log('\n🍪 OROBOREO INSTALLER', 'bright');
  log('═══════════════════════════════════════════════════════════\n', 'yellow');

  // Step 1: Get target directory
  const targetDir = await question('📂 Enter target project directory (default: current): ') || process.cwd();

  if (!fs.existsSync(targetDir)) {
    log(`\n❌ Directory not found: ${targetDir}`, 'yellow');
    process.exit(1);
  }

  const scriptsDir = path.join(targetDir, 'scripts');
  const bedrockDir = path.join(scriptsDir, 'bedrock');

  // Step 2: Create directories
  log('\n📁 Creating directory structure...', 'cyan');
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(bedrockDir, { recursive: true });
  log('✅ Directories created', 'green');

  // Step 3: Copy core files
  log('\n📦 Copying Oroboreocore files...', 'cyan');

  const oroboreoSrc = __dirname; // Where this install.js is located
  const filesToCopy = [
    'oreo-config.js',
    'oreo-init.js',
    'oreo-run.js',
    'oreo-generate.js',
    'oreo-archive.js',
    'oreo-feedback.js'
  ];

  let copiedCount = 0;
  filesToCopy.forEach(file => {
    const srcPath = path.join(oroboreoSrc, file);
    const destPath = path.join(scriptsDir, file);

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      log(`  ✅ ${file}`, 'green');
      copiedCount++;
    } else {
      log(`  ⚠️  ${file} not found in Oroboreodirectory`, 'yellow');
    }
  });

  log(`\n📦 Copied ${copiedCount}/${filesToCopy.length} files`, 'green');

  // Step 4: Create .env.example
  const envExample = `# AWS Bedrock Credentials
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
`;

  fs.writeFileSync(path.join(bedrockDir, '.env.example'), envExample, 'utf8');
  log('✅ Created .env.example', 'green');

  // Step 5: Run initialization
  log('\n🔧 Ready to initialize Oroboreos!', 'bright');
  const runInit = await question('\nRun oreo-init.js now? (yes/no): ');

  if (runInit.toLowerCase() === 'yes' || runInit.toLowerCase() === 'y') {
    log('\n🚀 Launching oreo-init.js...\n', 'cyan');

    const initProcess = spawn('node', [path.join(scriptsDir, 'oreo-init.js')], {
      stdio: 'inherit',
      cwd: targetDir
    });

    initProcess.on('close', (code) => {
      if (code === 0) {
        log('\n✅ Installation complete!', 'green');
        log('\n📋 Next steps:', 'bright');
        log(`  1. cd ${path.relative(process.cwd(), targetDir)}`, 'cyan');
        log('  2. node scripts/oreo-generate.js (create PRD)', 'cyan');
        log('  3. node scripts/oreo-run.js (execute tasks)', 'cyan');
        log('\n🍪 Welcome to the Golden Loop! 🌀\n', 'magenta');
      } else {
        log('\n⚠️  Initialization failed. Run manually:', 'yellow');
        log(`  node scripts/oreo-init.js`, 'cyan');
      }

      rl.close();
    });
  } else {
    log('\n✅ Installation complete!', 'green');
    log('\n📋 Next steps:', 'bright');
    log(`  1. cd ${path.relative(process.cwd(), targetDir)}/scripts`, 'cyan');
    log('  2. node utils/oreo-init.js (initialize)', 'cyan');
    log('  3. node utils/oreo-generate.js (create PRD)', 'cyan');
    log('  4. node utils/oreo-run.js (execute tasks)', 'cyan');
    log('\n🍪 Welcome to the Golden Loop! 🌀\n', 'magenta');

    rl.close();
  }
}

main().catch(err => {
  console.error('❌ Installation error:', err);
  process.exit(1);
});
