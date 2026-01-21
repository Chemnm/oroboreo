#!/usr/bin/env node
/**
 * OREO-COSTS - Cost Export & CloudWatch Integration
 *
 * Export cost data as CSV or fetch real token counts from AWS CloudWatch
 * to compare estimated vs actual costs.
 *
 * ============================================================================
 * FILE REFERENCES
 * ============================================================================
 *
 * | File                | Purpose                                           |
 * |---------------------|--------------------------------------------------|
 * | bedrock-costs.json  | Source data - tracked by oreo-run.js             |
 * | .env                | AWS credentials for CloudWatch access            |
 *
 * ============================================================================
 * USAGE
 * ============================================================================
 *
 *   # Export costs to CSV
 *   node oroboreo/utils/oreo-costs.js csv
 *
 *   # Compare with CloudWatch (real token counts)
 *   node oroboreo/utils/oreo-costs.js cloudwatch
 *
 *   # Do both
 *   node oroboreo/utils/oreo-costs.js both
 *
 * ============================================================================
 * CLOUDWATCH SETUP
 * ============================================================================
 *
 * CloudWatch metrics require:
 *   1. AWS credentials with cloudwatch:GetMetricStatistics permission
 *   2. Bedrock usage in the last hour (metrics take 5-10 min to appear)
 *
 * @author Oroboreo- The Golden Loop
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const OROBOREO_DIR = path.join(__dirname, '..');
const COSTS_FILE = path.join(OROBOREO_DIR, 'bedrock-costs.json');
const ENV_FILE = path.join(OROBOREO_DIR, '.env');

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

function loadEnv() {
  if (fs.existsSync(ENV_FILE)) {
    const content = fs.readFileSync(ENV_FILE, 'utf8');
    content.split('\n').forEach(line => {
      const [key, ...value] = line.split('=');
      if (key && value.length > 0) {
        process.env[key.trim()] = value.join('=').trim();
      }
    });
    return true;
  }
  return false;
}

// ============================================================================
// CSV EXPORT
// ============================================================================

function exportToCSV() {
  if (!fs.existsSync(COSTS_FILE)) {
    log('No cost data found. Run oreo-run.js first!', 'yellow');
    process.exit(1);
  }

  const costs = JSON.parse(fs.readFileSync(COSTS_FILE, 'utf8'));

  // Create CSV header
  const csvLines = [
    'Task ID,Task Title,Timestamp,Model,Input Tokens,Output Tokens,Total Cost'
  ];

  // Add task rows
  costs.tasks.forEach(task => {
    csvLines.push([
      task.taskId,
      `"${(task.taskTitle || '').replace(/"/g, '""')}"`,
      task.timestamp,
      `"${task.model}"`,
      task.inputTokens,
      task.outputTokens,
      task.totalCostUSD.toFixed(6)
    ].join(','));
  });

  // Add summary row
  csvLines.push('');
  csvLines.push(`TOTAL,,,,,,$${costs.session.totalCost.toFixed(6)}`);

  const csvContent = csvLines.join('\n');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const csvPath = path.join(OROBOREO_DIR, `costs-export-${timestamp}.csv`);

  fs.writeFileSync(csvPath, csvContent, 'utf8');

  log(`\nCost data exported to CSV`, 'green');
  log(`Location: ${path.relative(process.cwd(), csvPath)}`, 'cyan');
  log(`\nSummary:`, 'bright');
  log(`  Tasks: ${costs.tasks.length}`, 'reset');
  log(`  Total Cost: $${costs.session.totalCost.toFixed(4)}`, 'reset');
  if (costs.tasks.length > 0) {
    log(`  Average Cost per Task: $${(costs.session.totalCost / costs.tasks.length).toFixed(4)}`, 'reset');
  }
  log('', 'reset');

  return csvPath;
}

// ============================================================================
// CLOUDWATCH INTEGRATION
// ============================================================================

async function fetchCloudWatchMetrics() {
  log('\nFetching real token counts from AWS CloudWatch...', 'cyan');

  // Dynamic import for AWS SDK (optional dependency)
  let CloudWatchClient, GetMetricStatisticsCommand;
  try {
    const cwModule = await import('@aws-sdk/client-cloudwatch');
    CloudWatchClient = cwModule.CloudWatchClient;
    GetMetricStatisticsCommand = cwModule.GetMetricStatisticsCommand;
  } catch (e) {
    log('AWS SDK not installed. Run: npm install @aws-sdk/client-cloudwatch', 'yellow');
    return [];
  }

  loadEnv();

  const client = new CloudWatchClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000);

  const models = [
    'us.anthropic.claude-opus-4-5-20251101-v1:0',
    'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    'us.anthropic.claude-haiku-4-5-20251001-v1:0'
  ];

  const metrics = [];

  for (const modelId of models) {
    try {
      const inputParams = {
        Namespace: 'AWS/Bedrock',
        MetricName: 'InputTokenCount',
        Dimensions: [{ Name: 'ModelId', Value: modelId }],
        StartTime: oneHourAgo,
        EndTime: now,
        Period: 3600,
        Statistics: ['Sum']
      };

      const inputResponse = await client.send(new GetMetricStatisticsCommand(inputParams));

      const outputParams = {
        Namespace: 'AWS/Bedrock',
        MetricName: 'OutputTokenCount',
        Dimensions: [{ Name: 'ModelId', Value: modelId }],
        StartTime: oneHourAgo,
        EndTime: now,
        Period: 3600,
        Statistics: ['Sum']
      };

      const outputResponse = await client.send(new GetMetricStatisticsCommand(outputParams));

      const inputTokens = inputResponse.Datapoints?.[0]?.Sum || 0;
      const outputTokens = outputResponse.Datapoints?.[0]?.Sum || 0;

      if (inputTokens > 0 || outputTokens > 0) {
        metrics.push({ modelId, inputTokens, outputTokens });
      }
    } catch (err) {
      log(`Could not fetch metrics for ${modelId}: ${err.message}`, 'yellow');
    }
  }

  return metrics;
}

async function compareWithCloudWatch() {
  log('\n===============================================================================', 'yellow');
  log('Comparing Estimated Costs with CloudWatch Data', 'bright');
  log('===============================================================================\n', 'yellow');

  if (!fs.existsSync(COSTS_FILE)) {
    log('No cost data found. Run oreo-run.js first!', 'yellow');
    process.exit(1);
  }

  const costs = JSON.parse(fs.readFileSync(COSTS_FILE, 'utf8'));
  const cloudWatchMetrics = await fetchCloudWatchMetrics();

  if (cloudWatchMetrics.length === 0) {
    log('No CloudWatch metrics found for the last hour.', 'yellow');
    log('Metrics may take 5-10 minutes to appear in CloudWatch.', 'cyan');
    return;
  }

  log('CloudWatch Metrics (Last Hour):\n', 'bright');

  const modelPricing = {
    'opus': { input: 15.0, output: 75.0 },
    'sonnet': { input: 3.0, output: 15.0 },
    'haiku': { input: 1.0, output: 5.0 }
  };

  let totalCloudWatchCost = 0;

  cloudWatchMetrics.forEach(metric => {
    let modelName = 'Unknown';
    let pricing = modelPricing.sonnet;

    if (metric.modelId.includes('opus')) {
      modelName = 'Opus 4.5';
      pricing = modelPricing.opus;
    } else if (metric.modelId.includes('sonnet')) {
      modelName = 'Sonnet 4.5';
      pricing = modelPricing.sonnet;
    } else if (metric.modelId.includes('haiku')) {
      modelName = 'Haiku 4.5';
      pricing = modelPricing.haiku;
    }

    const totalCost = (
      (metric.inputTokens * pricing.input / 1000000) +
      (metric.outputTokens * pricing.output / 1000000)
    );
    totalCloudWatchCost += totalCost;

    log(`  ${modelName}:`, 'cyan');
    log(`    Input Tokens: ${metric.inputTokens.toLocaleString()}`, 'reset');
    log(`    Output Tokens: ${metric.outputTokens.toLocaleString()}`, 'reset');
    log(`    Real Cost: $${totalCost.toFixed(4)}`, 'green');
    log('', 'reset');
  });

  log(`Comparison:`, 'bright');
  log(`  Estimated Cost: $${costs.session.totalCost.toFixed(4)}`, 'cyan');
  log(`  CloudWatch Real Cost: $${totalCloudWatchCost.toFixed(4)}`, 'green');

  const diff = Math.abs(costs.session.totalCost - totalCloudWatchCost);
  const accuracy = totalCloudWatchCost > 0 ? (1 - (diff / totalCloudWatchCost)) * 100 : 0;

  log(`  Difference: $${diff.toFixed(4)}`, 'yellow');
  log(`  Accuracy: ${accuracy.toFixed(1)}%`, accuracy > 80 ? 'green' : 'yellow');
  log('', 'reset');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'csv';

  log('\n===============================================================================', 'yellow');
  log('OROBOREO COSTS', 'bright');
  log('===============================================================================\n', 'yellow');

  if (command === 'csv' || command === 'export') {
    exportToCSV();
  } else if (command === 'cloudwatch' || command === 'cw') {
    await compareWithCloudWatch();
  } else if (command === 'both') {
    exportToCSV();
    await compareWithCloudWatch();
  } else {
    log('Usage:', 'cyan');
    log('  node oroboreo/utils/oreo-costs.js csv          # Export to CSV', 'reset');
    log('  node oroboreo/utils/oreo-costs.js cloudwatch   # Compare with CloudWatch', 'reset');
    log('  node oroboreo/utils/oreo-costs.js both         # Do both', 'reset');
    log('', 'reset');
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
