@echo off
REM ============================================================================
REM OROBOREO - Run Claude Code with Prompt File
REM ============================================================================
REM
REM This script executes Claude Code with a prompt file, avoiding CMD line
REM length limits. It's used by oreo-run.js and oreo-feedback.js.
REM
REM Usage: run-with-prompt.bat <prompt-file-path> [model-id]
REM
REM Arguments:
REM   %1 - Prompt file path (required)
REM   %2 - Model ID (optional, for Anthropic direct API)
REM
REM Environment Variables (set by calling scripts):
REM   CLAUDE_CODE_USE_BEDROCK    - Set to "1" for Bedrock (uses ANTHROPIC_MODEL env var)
REM   AWS_REGION                 - AWS region (default: us-east-1)
REM   ANTHROPIC_MODEL            - Model ID for Bedrock
REM   CLAUDE_CODE_MAX_OUTPUT_TOKENS - Max output tokens
REM   CLAUDE_CODE_MAX_THINKING_TOKENS        - Thinking budget (Opus only)
REM
REM ============================================================================

REM Check if model parameter is provided (for Anthropic direct API)
if "%~2"=="" (
    REM No model specified - use environment variables only (Bedrock mode)
    type "%~1" | npx @anthropic-ai/claude-code --print --dangerously-skip-permissions
) else (
    REM Model specified - use --model flag (Anthropic direct API mode)
    type "%~1" | npx @anthropic-ai/claude-code --model "%~2" --print --dangerously-skip-permissions
)
