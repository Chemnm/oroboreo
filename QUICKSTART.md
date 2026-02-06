# Oroboreo - 5-Minute Quick Start

Get your first autonomous development session running in under 5 minutes.

---

## Prerequisites

- Node.js 18+ installed
- Claude Code CLI: `npm install -g @anthropic-ai/claude-code`
- **AI Provider** (choose one):
  - Claude Pro/Team subscription (recommended for individuals), OR
  - Anthropic API key with pay-as-you-go credits, OR
  - AWS Account with Bedrock access (enterprise)
- An existing project (or create a new one)
- **GitHub CLI (optional)**: Required for auto PR creation
  - Install: https://cli.github.com/
  - Without it: `⚠️ GitHub CLI (gh) not installed. Skipping PR creation.`

---

## Step 1: Install Oroboreo (30 sec)

```bash
npm install -g @oroboreo/cli
```

Verify installation:
```bash
oro-init --help
```

---

## Step 2: Configure AI Provider (1 min)

Navigate to your project and create a `.env` file:

```bash
cd your-project
```

### Option A: Claude Code Subscription (Recommended for Individuals)

**One-time login:**
```bash
npx @anthropic-ai/claude-code login
```

**Create `.env` file:**
```
AI_PROVIDER=subscription
# Leave ANTHROPIC_API_KEY blank
```

**Prerequisites:**
- Active Claude Pro or Team subscription from [claude.ai](https://claude.ai/settings/billing)

### Option B: Anthropic API (Pay-As-You-Go)

**Create `.env` file:**
```
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

**How to get API key:**
1. Go to https://console.anthropic.com/
2. Sign in or create account
3. Generate API key → Copy value
4. Add credits at https://console.anthropic.com/settings/billing

### Option C: AWS Bedrock (Enterprise)

**Create `.env` file:**
```
AI_PROVIDER=bedrock
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

**How to get credentials:**
1. AWS Console → IAM → Users
2. Create user with `bedrock:InvokeModel` permission
3. Generate Access Key → Copy values

---

## Step 3: Initialize (Optional - 1 min)

```bash
oro-init
```

**What it does:**
- Scans your project structure
- Creates `creme-filling.md` with project rules
- Creates empty `cookie-crumbs.md` task list
- Optionally configures AWS credentials

**Skip if:** You already have detailed rules for your project to copy into `creme-filling.md`.

---

## Step 4: Create Tasks (1 min)

### Option A: Generate with Architect (Opus)

```bash
oro-generate "Add user authentication with JWT"
```

**What it does:**
- Spawns Opus 4.6 (thinking model)
- Analyzes your project
- Creates 8-15 detailed tasks in `cookie-crumbs.md`

### Option B: Write Tasks Manually

Edit `cookie-crumbs.md`:

```markdown
**Session**: user-authentication

## Tasks

- [ ] **Task 1: Create User Model** [SIMPLE]
  - **Objective:** Add user schema
  - **Files:** `src/models/user.js`
  - **Verification:** Model exports correctly

- [ ] **Task 2: Add Login API** [COMPLEX]
  - **Objective:** JWT authentication endpoint
  - **Files:** `src/api/auth.js`
  - **Verification:** POST /login returns token
```

---

## Step 5: Run The Golden Loop

```bash
oro-run
```

**What it does:**
1. Reads `cookie-crumbs.md` task list
2. For each task:
   - Selects model (Haiku $1/$5 or Sonnet $3/$15)
   - Spawns Claude Code with Bedrock
   - Executes with full tool access
   - Tracks cost (~$0.01-0.20 per task)
   - Commits to git on completion
3. Shows session summary

**Example output:**
```
===============================================================================
OROBOREO - The Golden Loop
===============================================================================

Task 1: Create User Model
Model: Claude Haiku 4.5
Attempt: 1/5
-------------------------------------------------------------------------------
[Claude Code executes...]

Task 1 COMPLETED!
Cost: $0.0150 (Input: 3,000, Output: 1,500)
Session Total: $0.02

-------------------------------------------------------------------------------
Task 2: Add Login API
Model: Claude Sonnet 4.5
...

===============================================================================
THE GOLDEN LOOP IS COMPLETE!
===============================================================================
Total Cost: $1.22
Tasks Completed: 12
```

---

## Step 6: Test & Iterate

Found issues? Report them:

```bash
# Option A: Write to human-feedback.md
# Edit human-feedback.md with issues

# Option B: Pass directly
oro-feedback "The login button doesn't work"

# Then run fixes
oro-run
```

---

## Bonus: View Costs

```bash
# Export to CSV
oro-costs csv

# Compare with CloudWatch (real token counts)
oro-costs cloudwatch
```

---

## File Reference (Oreo Theme)

| File | Purpose |
|------|---------|
| `oro-run` | Main loop - executes tasks |
| `oro-generate` | Generate NEW feature tasks |
| `oro-feedback` | Generate FIX tasks from issues |
| `oro-init` | Initialize in new project |
| `oro-archive` | Archive completed sessions |
| `oro-costs` | Export/compare costs |
| `oro-diagnose` | Post-mortem analysis for hung tasks |
| `cookie-crumbs.md` | Task list (like PRD.md) |
| `creme-filling.md` | System rules (like AGENTS.md) |
| `progress.txt` | Session memory |
| `human-feedback.md` | Your issue reports |
| `costs.json` | Cost tracking |
| `tests/` | Session verification scripts (archived) |
| `tests/reusable/` | Generic tests (kept across sessions) |

---

## Troubleshooting

### "AWS credentials not found"
- Check `.env` exists in your project directory
- Verify: `aws bedrock list-foundation-models --region us-east-1`

### "cookie-crumbs.md not found"
- Run `oro-init` or create manually

### "Claude Code not found"
- Install: `npm install -g @anthropic-ai/claude-code`

### "Model not enabled"
- AWS Bedrock auto-enables Claude in most regions
- Check AWS Console → Bedrock → Model Access

---

## Workflow Summary

```
1. oro-generate      → Create tasks (NEW features)
         ↓
2. oro-run           → Execute tasks (THE LOOP)
         ↓
3. [Test manually]    → Find issues
         ↓
4. oro-feedback      → Create fix tasks
         ↓
5. oro-run           → Execute fixes
         ↓
   [Repeat until done]
```

---

<p align="center">
  <strong>Welcome to the Golden Loop!</strong><br>
  <em>70% cheaper. Infinitely smarter.</em>
</p>
