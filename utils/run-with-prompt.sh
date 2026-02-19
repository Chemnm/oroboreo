#!/bin/bash
# ============================================================================
# OROBOREO - Run Claude Code with Prompt File
# ============================================================================
#
# This script executes Claude Code with a prompt file, avoiding command line
# length limits. It's used by oreo-run.js and oreo-feedback.js.
#
# Usage: run-with-prompt.sh <prompt-file-path> [model-id]
#
# Arguments:
#   $1 - Prompt file path (required)
#   $2 - Model ID (optional, for Anthropic direct API)
#
# Environment Variables (set by calling scripts):
#   CLAUDE_CODE_USE_BEDROCK    - Set to "1" for Bedrock (uses ANTHROPIC_MODEL env var)
#   AWS_REGION                 - AWS region (default: us-east-1)
#   ANTHROPIC_MODEL            - Model ID for Bedrock
#   CLAUDE_CODE_MAX_OUTPUT_TOKENS - Max output tokens
#   CLAUDE_CODE_MAX_THINKING_TOKENS        - Thinking budget (Opus only)
#
# ============================================================================

# Export all environment variables so they propagate to child processes (npx spawns node)
# This is required in containerized environments (GitHub Codespaces) where env inheritance is unreliable
export AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY
export AWS_REGION
export CLAUDE_CODE_USE_BEDROCK
export ANTHROPIC_MODEL
export ANTHROPIC_API_KEY
export CLAUDE_CODE_MAX_OUTPUT_TOKENS
export CLAUDE_CODE_MAX_THINKING_TOKENS

# Check if model parameter is provided (for Anthropic direct API)
if [ -z "$2" ]; then
    # No model specified - use environment variables only (Bedrock mode)
    cat "$1" | npx @anthropic-ai/claude-code --print --dangerously-skip-permissions
else
    # Model specified - use --model flag (Anthropic direct API mode)
    cat "$1" | npx @anthropic-ai/claude-code --model "$2" --print --dangerously-skip-permissions
fi
