# Oroboreo- 5-Minute Quick Start

Get your first autonomous development session running in under 5 minutes.

---

## Prerequisites

- Node.js 18+ installed
- AWS Account with Bedrock access
- Claude Code CLI: `npm install -g @anthropic-ai/claude-code`
- An existing project (or create a new one)

---

## Step 1: Copy Oroboreoto Your Project (30 sec)

```bash
# Navigate to your project
cd your-project/

# Clone or copy Oroboreos
git clone https://github.com/yourusername/oroboreo.git

# Or just copy the folder
cp -r /path/to/oroboreo ./oroboreo
```

**Result:** You now have `your-project/oroboreo/` folder.

---

## Step 2: Configure AWS Credentials (1 min)

```bash
cd oroboreo
cp .env.example .env
```

Edit `.env` with your AWS credentials:
```
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
node oroboreo/utils/oreo-init.js
```

**What it does:**
- Scans your project structure
- Creates `creme-filling.md` with project rules
- Creates empty `cookie-crumbs.md` task list
- Optionally configures AWS credentials

**Skip if:** You already have `creme-filling.md` and `cookie-crumbs.md`.

---

## Step 4: Create Tasks (1 min)

### Option A: Generate with Architect (Opus)

```bash
node oroboreo/utils/oreo-generate.js "Add user authentication with JWT"
```

**What it does:**
- Spawns Opus 4.5 (thinking model)
- Analyzes your project
- Creates 8-15 detailed tasks in `cookie-crumbs.md`

### Option B: Write Tasks Manually

Edit `oroboreo/cookie-crumbs.md`:

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

## Step 5: Run The Golden Loop (30-60 min)

```bash
node oroboreo/utils/oreo-run.js
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
# Edit oroboreo/human-feedback.md with issues

# Option B: Pass directly
node oroboreo/utils/oreo-feedback.js "The login button doesn't work"

# Then run fixes
node oroboreo/utils/oreo-run.js
```

---

## Bonus: View Costs

```bash
# Export to CSV
node oroboreo/utils/oreo-costs.js csv

# Compare with CloudWatch (real token counts)
node oroboreo/utils/oreo-costs.js cloudwatch
```

---

## File Reference (Oreo Theme)

| File | Purpose |
|------|---------|
| `utils/oreo-run.js` | Main loop - executes tasks |
| `utils/oreo-generate.js` | Generate NEW feature tasks |
| `utils/oreo-feedback.js` | Generate FIX tasks from issues |
| `utils/oreo-init.js` | Initialize in new project |
| `cookie-crumbs.md` | Task list (like PRD.md) |
| `creme-filling.md` | System rules (like AGENTS.md) |
| `progress.txt` | Session memory |
| `human-feedback.md` | Your issue reports |
| `bedrock-costs.json` | Cost tracking |
| `utils/oreo-costs.js` | Export/compare costs |

---

## Troubleshooting

### "AWS credentials not found"
- Check `oroboreo/.env` exists
- Verify: `aws bedrock list-foundation-models --region us-east-1`

### "cookie-crumbs.md not found"
- Run `node oroboreo/utils/oreo-init.js` or create manually

### "Claude Code not found"
- Install: `npm install -g @anthropic-ai/claude-code`

### "Model not enabled"
- AWS Bedrock auto-enables Claude in most regions
- Check AWS Console → Bedrock → Model Access

---

## Workflow Summary

```
1. oreo-generate.js   → Create tasks (NEW features)
         ↓
2. oreo-run.js        → Execute tasks (THE LOOP)
         ↓
3. [Test manually]    → Find issues
         ↓
4. oreo-feedback.js   → Create fix tasks
         ↓
5. oreo-run.js        → Execute fixes
         ↓
   [Repeat until done]
```

---

<p align="center">
  <strong>Welcome to the Golden Loop!</strong><br>
  <em>70% cheaper. Infinitely smarter.</em>
</p>
