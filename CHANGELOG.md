# Changelog

All notable changes to Oroboreo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2026-02-05

### Fixed
- **Archive Sorting:** Fixed `getLatestArchive()` to correctly find the most recent archive by sorting on full path
  - Now properly handles `archives/YYYY/MM/DD-HH-MM-SS-sessionName` structure
  - Previously could return older archives from earlier months

## [1.0.2] - 2026-01-30

### Added
- **Playwright Support:** Added `playwright` as optional dependency for browser automation tasks

### Fixed
- **Dependencies:** Moved `@anthropic-ai/claude-code` from `optionalDependencies` to `peerDependencies`
  - NPM will now warn users if Claude Code CLI is not installed

## [1.0.1] - 2026-01-28

### Fixed
- **Critical NPM Path Resolution Bug:** Scripts now correctly use `process.cwd()/oroboreo/` instead of NPM package location
  - All scripts (`oreo-init`, `oreo-run`, `oreo-generate`, `oreo-feedback`, `oreo-archive`, `oreo-costs`, `oreo-diagnose`) now work correctly when installed via NPM
  - Unified path strategy works for both NPM install and cloned repo scenarios
  - Centralized path configuration in `oreo-config.js` via `getPaths()` function

### Added
- **Linux/macOS Support:** Added `utils/run-with-prompt.sh` shell script for Unix-based systems
  - Properly exports environment variables for containerized environments (GitHub Codespaces)
  - Supports both Bedrock and Anthropic API modes

### Changed
- **CLI Command Prefix:** Changed from `oreo-*` to `oro-*` for shorter commands
  - `oro-init`, `oro-run`, `oro-generate`, `oro-feedback`, `oro-archive`, `oro-costs`, `oro-diagnose`
- `getPaths()` function no longer requires `__dirname` parameter - automatically uses `process.cwd()/oroboreo/`
- Consistent `.env` loading across all scripts using centralized path

## [1.0.0] - 2026-01-26

### Added
- Initial release of Oroboreo CLI
- **Core Commands:**
  - `oreo-init` - Project discovery and setup with AI-powered analysis
  - `oreo-generate` - New feature task generator using Opus 4.5
  - `oreo-feedback` - Fix task generator from human feedback
  - `oreo-run` - Main execution loop (The Golden Loop)
  - `oreo-archive` - Session archival with year/month organization
  - `oreo-costs` - Cost export to CSV and CloudWatch comparison
  - `oreo-diagnose` - Post-mortem analysis for hung/failed tasks

- **Multi-Provider Support:**
  - AWS Bedrock integration (recommended for enterprise)
  - Anthropic API support (Claude Code subscription)
  - Automatic model ID switching based on provider

- **Smart Model Routing:**
  - Opus 4.5 for architecture and PRD generation
  - Sonnet 4.5 for complex task implementation
  - Haiku 4.5 for simple tasks
  - Task complexity tagging ([SIMPLE]/[COMPLEX])

- **Cost Optimization:**
  - Real-time cost tracking in costs.json
  - CloudWatch integration for Bedrock usage
  - 70%+ cost savings vs competitors

- **Archive System:**
  - Year/month folder organization (archives/YYYY/MM/)
  - Session-specific test preservation
  - Execution log archival

- **Git Integration:**
  - Auto-commits on task completion
  - Branch awareness

- **Configuration:**
  - `creme-filling.md` - Universal Laws (system rules)
  - `cookie-crumbs.md` - Task list management
  - `.env` support for credentials

### Documentation
- Comprehensive README with architecture diagrams
- QUICKSTART.md getting started guide
- Provider setup instructions (Bedrock & Anthropic)
- Test organization guidelines

[1.0.3]: https://github.com/Chemnm/oroboreo/releases/tag/v1.0.3
[1.0.2]: https://github.com/Chemnm/oroboreo/releases/tag/v1.0.2
[1.0.1]: https://github.com/Chemnm/oroboreo/releases/tag/v1.0.1
[1.0.0]: https://github.com/Chemnm/oroboreo/releases/tag/v1.0.0
