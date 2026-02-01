<p align="center">
  <img src="transparent_logo.svg" alt="Oroboreo Logo" width="450"/>
</p>

# Oroboreo - The Golden Loop

> **The self-improving, cost-optimized autonomous development engine that gets better with every iteration.**

Oroboreo is a  meta-development system that combines Claude Code, AWS Bedrock, intelligent model routing, and self-learning capabilities into a single, autonomous workflow.

---

## What is Oroboreo?

### 1. **Autonomous & Self-Sufficient**
- ✅ Plans its own work (Opus 4.5 PRD generation)
- ✅ Executes with optimal cost/power ratio (Sonnet/Haiku routing)
- ✅ Commits progress automatically (Git integration)
- ✅ Learns from past sessions (Archive analysis)
- ✅ Self-improves over time (Feedback loop)

### 2. **Cost-Optimized & Flexible**
- Supports AWS Bedrock (70%+ savings) OR Anthropic API (Claude Code subscription)
- Smart model routing: Simple tasks → Haiku ($1/$5), Complex → Sonnet ($3/$15)
- Real cost tracking with CloudWatch integration (Bedrock only)
- Typical feature: $1-3 vs $5-10 with competitors
- Easy provider switching with single env variable

### 3. **Production-Ready**
- Full tool execution via Claude Code
- Smart context management (no memory loss)
- Retry logic with exponential backoff
- Archive with year/month structure (archives/YYYY/MM/)
- Git branching and auto-commits
- Post-mortem diagnostics for hung tasks

### 4. **Extensible & Template-Based**
- Drop into any project in minutes
- Intelligent initialization (discovers your codebase)
- Language-agnostic (works with React, Node, Python, etc.)
- Customizable Universal Laws (your project's rules)

---

## Why Oroboreo?

**A Tool Built from Real Experience**

I've spent 10 years building software across med-tech, logistics, research labs, and startups, from taking a no-code platform (before AI was a thing) from beta to $2M ARR as its first engineer, to architecting cloud infrastructure and deploying AI systems on embedded devices. I've seen what works at scale.

As AI rapidly evolved, I started building tools like this for my own projects and systems that don't just suggest code, but actually complete features autonomously and cost-effectively. Oroboreo is what emerged from that process.

I know there are many similar tools out there. But this is what helps **me** ship faster without breaking the bank or losing context across sessions, and if it helps you too, that's why I'm sharing it.

This isn't about replacing developers. It's about giving devs & builders leverage to focus on architecture and decision-making while the tedious implementation loop runs itself.

---


## 🎯 The Five-Layer System

```
┌─────────────────────────────────────────┐
│ Layer 1: PLANNING (Opus 4.5)            │
│ ├─ Generate comprehensive PRDs          │
│ ├─ Tag task complexity [SIMPLE/COMPLEX] │
│ └─ Cost: $0.30-2 per PRD (one-time)     │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│ Layer 2: ROUTING (Smart Selection)      │
│ ├─ Parse PRD tasks                      │
│ ├─ Select model based on complexity     │
│ └─ Optimize cost vs. quality            │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│ Layer 3: EXECUTION (Claude Code)        │
│ ├─ Full tool access (Read/Write/Edit)   │
│ ├─ Runs smartly (70% cost savings)      │
│ └─ Smart context  (no amnesia)          │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│ Layer 4: MEMORY (Persistent Learning)   │
│ ├─ Archives completed sessions          │
│ ├─ Extracts patterns and insights       │
│ └─ Updates "AGENTS.md" automatically    │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│ Layer 5: FEEDBACK (Self-Improvement)    │
│ ├─ Analyzes historical performance      │
│ ├─ Recommends optimizations             │
│ └─ Improves future PRDs                 │
└─────────────────────────────────────────┘
```

---

## 💰 Cost Optimization

Oroboreo is designed for cost-effective autonomous development:

- **No subscription fees** - Pay only for AI compute you use
- **Smart model routing** - Uses Opus ($5/$25 per 1M tokens) for high-level planning, Sonnet ($3/$15) for complex implementation, Haiku ($1/$5) for simple tasks
- **Multiple provider options** - AWS Bedrock, Anthropic API, or (soon) Google Vertex AI
- **Real-time cost tracking** - Monitor spending per task in `costs.json`
- **Full autonomy** - Complete task loops with auto-retry, not just code suggestions
- **Self-improving** - Archives + feedback loops make it better with every session

**Typical costs**: $1-3 for a 12-task feature implementation

*Example: User authentication feature with 12 tasks (4 simple + 8 complex) using smart routing typically costs $1-2 in API usage.*

---

## 📋 Prerequisites

- **Node.js 18+** installed
- **Claude Code CLI**: `npm install -g @anthropic-ai/claude-code`
- **GitHub CLI (optional)**: Required for auto PR creation
  - Install: https://cli.github.com/
  - Without it, you'll see: `⚠️ GitHub CLI (gh) not installed. Skipping PR creation.`

---

## 🚀 Installation

### Option 1: NPM (Recommended)
```bash
# Install globally
npm install -g @oroboreo/cli

# Verify installation
oro-init --help
```

### Option 2: Clone Repository
```bash
# Clone and copy to your project
git clone https://github.com/chemnm/oroboreo.git
cp -r oroboreo/ your-project/oroboreo/
```

---

## 🍪 The Core Commands

### 🔧 Setup (One-Time)
```bash
# Navigate to your project
cd your-project

# Initialize Oroboreo (AI-powered or manual)
oro-init
# - Discovers your project structure
# - Creates creme-filling.md with Universal Laws
# - Sets up .env for AWS Bedrock (optional AI analysis: ~$0.10-0.30)
```

### 📝 Create Tasks

#### Option A: Generate NEW Feature Tasks
```bash
# Use Opus 4.5 to generate comprehensive task breakdown
oro-generate "Add user authentication with JWT"

# OR: Create new-prompt.md with detailed feature description, then:
oro-generate
# Script will ask if you want to use new-prompt.md
# File is archived and cleared after generation
```
- Opus creates detailed tasks in `cookie-crumbs.md`
- Tags tasks as [SIMPLE] or [COMPLEX]
- Supports inline, interactive, or file-based input
- Cost: ~$0.30-2.00 per PRD depending on the complexity of your project

#### Option B: Generate FIX Tasks from Feedback
```bash
# 1. Write issues you found during testing in human-feedback.md
# 2. Run the feedback architect
oro-feedback
```
- Opus analyzes your feedback + latest archive
- Creates fix tasks in `cookie-crumbs.md`
- Cost: ~$0.15-0.40 per feedback session

#### Option C: Manual Tasks
- Edit `cookie-crumbs.md` directly with your own tasks

### ▶️ Execute Tasks
```bash
# Run the Golden Loop
oro-run
```
- Auto-loops through all tasks in `cookie-crumbs.md`
- Smart model selection (Haiku for [SIMPLE], Sonnet for [COMPLEX])
- Cost tracking in `costs.json`
- Git commits on task completion
- Cost: ~$1-3 per 12-task feature

### 📊 View Costs
```bash
# Export cost data to CSV or compare with CloudWatch
oro-costs
```

### 🔍 Diagnose Issues
```bash
# Post-mortem analysis for hung/failed tasks
oro-diagnose
```
- Analyzes execution logs from archived sessions
- Identifies timeout patterns and error causes
- Shows task duration, output silence periods, and failure reasons
- Helps debug overnight hangs or unexpected failures

---

## 🎬 Quick Start

- **NPM Install (Recommended):** [QUICKSTART.md](QUICKSTART.md)
- **Manual Clone:** [QUICKSTART-CLONE.md](QUICKSTART-CLONE.md)

---

## 🏗️ Architecture

### File Structure
```
your-project/
├── oroboreo/                    # All Oroboreofiles live here
│   ├── cookie-crumbs.md          # Task list (THE PLAN)
│   ├── creme-filling.md          # System rules (THE LAW)
│   ├── progress.txt              # Session memory (THE LEARNINGS)
│   ├── human-feedback.md         # Your feedback input
│   ├── costs.json        # Cost tracking
│   ├── .env                      # AWS credentials (from .env.example)
│   ├── .env.example              # Template for credentials
│   ├── tests/                    # Verification scripts 
│   │   ├── README.md             # Explains test organization
│   │   ├── reusable/             # Generic tests kept across sessions
│   │   │   ├── README.md         # What makes a test reusable
│   │   │   ├── verify-auth.js    # Example: Generic auth check
│   │   │   └── check-api.js      # Example: API health check
│   │   └── verify-task-*.js      # Session-specific tests (archived after)
│   ├── utils/
│   │   ├── oreo-config.js        # Shared configuration (SINGLE SOURCE OF TRUTH)
│   │   ├── oreo-init.js          # Project initialization (SETUP)
│   │   ├── oreo-run.js           # Main execution loop (THE ENGINE)
│   │   ├── oreo-generate.js      # NEW feature task generator (PLANNER)
│   │   ├── oreo-feedback.js      # FIX task generator (ARCHITECT)
│   │   ├── oreo-archive.js       # Session archival with smart test sorting (HISTORIAN)
│   │   ├── oreo-costs.js         # Cost analysis & export (ACCOUNTANT)
│   │   ├── oreo-diagnose.js      # Post-mortem analysis for hung tasks (DEBUGGER)
│   │   ├── install.js            # Installation script
│   │   ├── run-with-prompt.bat   # Execute Claude Code
│   │   └── run-with-bedrock.bat  # Execute with Bedrock config
│   └── archives/                 # Historical sessions (year/month organized)
│       └── 2026/                 # Year folder
│           └── 01/               # Month folder
│               └── feature-name-2026-01-20-14-30/  # Session archive
│                   ├── cookie-crumbs.md
│                   ├── progress.txt
│                   ├── costs.json
│                   ├── oreo-execution.log  # Full execution log
│                   └── tests/              # Session-specific tests only
│                       └── verify-task-*.js
├── src/                          # Your project source
└── ...
```

### File Reference
| File | Purpose |
|------|---------|
| `utils/oreo-config.js` | Shared configuration - model IDs, costs, paths (SINGLE SOURCE OF TRUTH) |
| `utils/oreo-init.js` | Initialize Oroboreoin a new project (AI-powered or manual) |
| `utils/oreo-run.js` | Main loop - executes tasks from cookie-crumbs.md |
| `utils/oreo-generate.js` | Generate tasks for NEW features (uses Opus 4.5) |
| `utils/oreo-feedback.js` | Generate FIX tasks from human feedback (uses Opus 4.5) |
| `utils/oreo-archive.js` | Archive completed sessions with year/month structure (HISTORIAN) |
| `utils/oreo-costs.js` | Export costs to CSV or compare with CloudWatch (ACCOUNTANT) |
| `utils/oreo-diagnose.js` | Post-mortem analysis for hung/failed tasks (DEBUGGER) |
| `cookie-crumbs.md` | Task list with checkboxes (like PRD.md) |
| `creme-filling.md` | System rules injected into every agent (like AGENTS.md) |
| `progress.txt` | Shared memory between agent instances |
| `human-feedback.md` | Where you describe issues for the feedback architect |
| `costs.json` | Real-time cost tracking per task |
| `tests/` | Session-specific verification scripts (archived after session) |
| `tests/reusable/` | Generic verification scripts (persist across sessions) |

### Workflow
1. **Initialize** - Run `oro-init` to set up creme-filling.md (AI-powered or manual)
2. **Plan Tasks** - Choose your approach:
   - **NEW Feature**: `oro-generate "Add user authentication"` (Opus generates fresh tasks)
   - **FIX Issues**: Write issues in `human-feedback.md` → run `oro-feedback` (Opus analyzes archives + creates fix tasks)
   - **Manual**: Write tasks directly in `cookie-crumbs.md`
3. **Execute** - `oro-run` loops through tasks:
   - Parses next incomplete task `- [ ]`
   - Selects model based on `[SIMPLE]`/`[COMPLEX]` tags (Haiku/Sonnet)
   - Spawns Claude Code with Bedrock
   - Tracks cost in `costs.json`
   - Logs execution to `oreo-execution.log`
   - Commits on completion
   - Marks task `- [x]`
   - 30-minute timeout with heartbeat logging
4. **Archive** - Completed sessions preserved in `archives/YYYY/MM/session-name-timestamp/` for learning
5. **Diagnose** - If tasks hang/fail, run `oro-diagnose` on archived session for analysis

---

## 🔐 AI Provider Setup

Choose the one that fits your needs:

### Option 1: AWS Bedrock (Better rate limit for Enterprise)

> 📚 **Official Guide**: See the [Claude Code Bedrock Documentation](https://code.claude.com/docs/en/amazon-bedrock) for detailed setup instructions.

**Prerequisites:**
- AWS Account with Bedrock access (us-east-1 region recommended)
- IAM user with `bedrock:InvokeModel` permission
- Claude models enabled (auto-enabled in most regions)

**Configuration:**
```bash
# Copy the example and fill in your credentials
cd oroboreo
cp .env.example .env

# Edit .env:
AI_PROVIDER=bedrock
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

### Option 2: Anthropic API (Claude Code Subscription)

**Prerequisites:**
- Anthropic API account
- API key from https://console.anthropic.com/

**Configuration:**
```bash
# Copy the example and fill in your credentials
cd oroboreo
cp .env.example .env

# Edit .env:
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

### Model Configuration (Automatic)
Oroboreo automatically uses the correct model IDs based on your provider:

| Model | Cost (per 1M tokens) | Used For |
|-------|---------------------|----------|
| **Opus 4.5** | $5/$25 | Architect (PRD generation) |
| **Sonnet 4.5** | $3/$15 | Complex tasks `[COMPLEX]` |
| **Haiku 4.5** | $1/$5 | Simple tasks `[SIMPLE]` |

**Note:** Costs are identical for both providers.

---

## 🧠 The Creme Filling (System Rules)

Every project has core constraints that should **never** be violated. Define these in `creme-filling.md`:

**Examples:**
- Never expose database credentials in frontend code
- All API routes must use authentication middleware
- Components must follow atomic design principles
- Database queries must use parameterized statements

These rules are injected into every Claude Code instance, ensuring consistent behavior across all tasks.

---

## 🌐 Use Cases

### 1. **Solo Developers**
- Build features 70% cheaper
- Focus on architecture, let Oroboreohandle implementation
- Learn from past sessions (what worked, what didn't)

### 2. **Startups**
- Rapid prototyping with minimal AI costs
- Consistent code quality (Universal Laws)
- Built-in documentation (PRDs + archives)

### 3. **Agencies**
- Template per client (drop in, customize, run)
- Cost tracking for billing
- Historical performance data

### 4. **Open Source Projects**
- Community contributors can generate PRDs
- Maintainers approve, Oroboreo executes
- Transparent cost tracking

---

## 🔮 Roadmap & Planned Features

### 📦 Distribution & Packaging

**NPM Package Distribution**
- [x] Publish to NPM as `@oroboreo/cli`
- [x] Global installation: `npm install -g @oroboreo/cli`
- [ ] NPX support: `npx @oroboreo init`, `npx @oroboreo run`
- [ ] Auto-update notifications for new versions
- [x] Semantic versioning and changelog automation

**Why This Matters:** Eliminate manual folder copying, make installation one command, standardize updates.

---

### 🧪 Autonomous Testing & Verification

**Playwright Browser Automation**
- [ ] Built-in Playwright support for autonomous UI testing
- [ ] Browser test utilities in `tests/reusable/browser-utils.js`
- [ ] Auto-generate browser verification scripts from task descriptions
- [ ] Console log capture and error detection
- [ ] Screenshot and video evidence collection
- [ ] Visual regression testing (compare before/after screenshots)
- [ ] Accessibility testing integration (automated a11y checks)

**Why This Matters:** Eliminates manual UI testing by enabling Claude to verify its own changes. The agent can open browsers, click elements, test workflows, capture console errors, and collect evidence—all without human intervention. This closes the feedback loop and reduces dependency on human verification.

---

### 🔌 Integrations & Extensions

**VS Code Extension**
- [ ] Right-click → "Run Oroboreo Task"
- [ ] Task list management from sidebar
- [ ] Real-time execution progress panel
- [ ] Cost tracker widget in status bar
- [ ] Archive browser for historical sessions

**GitHub Actions Integration**
- [ ] Workflow: Comment `/oroboreo <feature>` on issues/PRs
- [ ] Automated PR creation from completed sessions
- [ ] Branch protection integration (require approval before merge)
- [ ] Cost budgeting controls for CI/CD

**MCP (Model Context Protocol) Server Integrations**
- [ ] Built-in MCP server management (install, configure, enable/disable)
- [ ] Popular MCP server templates (filesystem, git, database, API tools)
- [ ] Auto-discovery of project-relevant MCP servers (e.g., detect Postgres → suggest database MCP)
- [ ] Session-scoped MCP server activation (enable specific tools per task)
- [ ] Cost tracking for MCP tool usage

**Why MCP Matters:** Extends Claude's capabilities beyond code editing to databases, APIs, cloud resources, and custom tooling—all through Anthropic's standardized protocol.

---

### 🎨 UX & Developer Experience

**Real-Time Improvements**
- [ ] Streaming output during agent execution (no more waiting for task completion)
- [ ] Interactive prompts (agent asks clarifying questions mid-task)
- [ ] Task pause/resume functionality
- [ ] Parallel task execution (run multiple tasks concurrently)

**Web UI Dashboard**
- [ ] Cost analytics with charts (daily/weekly/monthly spend)
- [ ] Session explorer with search and filtering
- [ ] Task template library (share common workflows)
- [ ] Visual task breakdown editor (drag-and-drop PRD builder)

**Testing & Quality Assurance**
- [ ] Auto-generate verification tests from task descriptions
- [ ] Code review mode (post-session quality analysis)
- [ ] Security scanning integration (detect common vulnerabilities)
- [ ] Performance profiling for generated code

---

### 🌐 Claude Provider Expansion

**Google Cloud Vertex AI Support**
- [ ] Vertex AI provider option (Claude via Google Cloud)
- [ ] Unified credential management across AWS/GCP/Anthropic
- [ ] Cost comparison dashboard across providers
- [ ] Provider failover/redundancy (fallback to alternative if primary unavailable)

**Why This Matters:** Google Cloud users can access Claude through Vertex AI (via Anthropic partnership), providing alternative to AWS Bedrock or direct Anthropic API.

---

### 🏢 Enterprise & Team Features

**Team Collaboration Mode**
- [ ] Shared task queues (assign tasks to team members)
- [ ] Session replay (review how agent completed tasks)
- [ ] Approval workflows (review PRDs before execution)
- [ ] Cost allocation per team/project

**Audit & Compliance**
- [ ] Comprehensive audit logs (who ran what, when, and cost)
- [ ] SSO integration (Google, Okta, Azure AD)
- [ ] Role-based access control (dev, reviewer, admin)
- [ ] Compliance reports (SOC2, GDPR, HIPAA-friendly logging)

---

### 🚀 Multi-Language & Framework Support

**Project Templates**
- [ ] React/Next.js starter template
- [ ] Python/FastAPI template
- [ ] Go microservices template
- [ ] Rust CLI tool template
- [ ] Community-contributed templates marketplace

---

### 🔭 Future Vision: Provider-Agnostic Architecture

**⚠️ Architectural Rewrite Required**

The current version is built on [Claude Code](https://code.claude.com), which is specifically designed for Anthropic's Claude models (Opus, Sonnet, Haiku). Supporting other model providers (OpenAI GPT, Google Gemini, local LLMs) would require:

1. **Replace Claude Code** with custom agent system
2. **Abstract tool execution** (file operations, bash, git) to work across models
3. **Normalize model APIs** (different providers use different formats)
4. **Reimplement cost tracking** (each provider has unique pricing/token counting)
5. **Handle capability differences** (not all models support extended thinking, tool use, etc.)

**Planned (Post-1.0):**
- [ ] Build unified agent abstraction layer
- [ ] Prototype with OpenAI + local LLM + Claude support
- [ ] Evaluate tradeoffs (complexity vs. flexibility)
- [ ] Community feedback on demand for multi-model support

**Why Not Now?** Maintaining quality for Claude models takes priority. Multi-model support would delay core features. I will revisit based on user demand.

---

## 🤝 Contributing

Obsess over building the future of autonomous development! Contributions welcome:

1. Fork the repo
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

---

## 📜 License

MIT License - Use freely, commercially or personally.

---

## 🙏 Acknowledgments

- **Anthropic** for Claude Code integration
- **AWS** for bedrock and easy enterprise level model access
- **The Ouroboros** (the eternal snake) for inspiration 🐍
- **The Ralph Wiggum Loop**  AI Loop Technique for Claude Code 🔁
- **Oreo**  Yum 🍪
- **Oro**  GOLD 🪙

---

## 📬 Support

- **Issues:** [GitHub Issues](https://github.com/chemnm/oroboreo/issues)
- **Discussions:** [GitHub Discussions](https://github.com/chemnm/oroboreo/discussions)
- **Collaboration and Sponsorships:** [Email](mailto:info@oroboreo.dev)

---

<p align="center">
  <strong>🍪 Oroboreo Dev 🌀</strong><br>
  <em>The Golden Loop that gets better forever</em>
</p>