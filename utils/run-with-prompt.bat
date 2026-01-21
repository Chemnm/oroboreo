@echo off
REM ============================================================================
REM OROBOREO - Run Claude Code with Prompt File
REM ============================================================================
REM
REM This script executes Claude Code with a prompt file, avoiding CMD line
REM length limits. It's used by oreo-run.js and oreo-feedback.js.
REM
REM Usage: run-with-prompt.bat <prompt-file-path>
REM
REM Environment Variables (set by calling scripts):
REM   CLAUDE_CODE_USE_BEDROCK    - Set to "1" for Bedrock
REM   AWS_REGION                 - AWS region (default: us-east-1)
REM   ANTHROPIC_MODEL            - Model ID to use
REM   CLAUDE_CODE_MAX_OUTPUT_TOKENS - Max output tokens
REM   CLAUDE_CODE_MAX_THINKING_TOKENS        - Thinking budget (Opus only)
REM
REM ============================================================================

type "%~1" | npx @anthropic-ai/claude-code --print --dangerously-skip-permissions
