#!/bin/bash
# ============================================================================
# OROBOREO - Run Aider with Prompt File
# ============================================================================
#
# This script executes Aider with a prompt file in non-interactive batch mode.
# It's used by oreo-run.js when AI_PROVIDER=aider.
#
# Usage: run-with-aider.sh <prompt-file-path>
#
# Arguments:
#   $1 - Prompt file path (required)
#
# Environment Variables (set by oreo-run.js):
#   AIDER_MODEL          - Model string (e.g. azure/gpt-4o, ollama/llama3)
#   AZURE_API_KEY        - Azure OpenAI API key
#   AZURE_API_BASE       - Azure endpoint (e.g. https://your-resource.openai.azure.com)
#   AZURE_API_VERSION    - API version (e.g. 2024-08-01-preview)
#   OPENAI_API_KEY       - OpenAI API key (if using OpenAI directly)
#
# ============================================================================

# Export all environment variables so they propagate to child processes
export AIDER_MODEL
export AZURE_API_KEY
export AZURE_API_BASE
export AZURE_API_VERSION
export OPENAI_API_KEY

PROMPT_FILE="$1"
MODEL="${AIDER_MODEL:-azure/gpt-4o}"

# Run aider in non-interactive batch mode:
#   --yes              = auto-confirm all changes (like --dangerously-skip-permissions)
#   --no-git           = Oroboreo handles git itself
#   --no-auto-commits  = belt-and-suspenders: never commit even if git is detected
#   --message-file     = pass prompt as a file (avoids command line length limits)
#   --no-pretty        = plain output for log parsing
aider \
  --model "$MODEL" \
  --edit-format diff \
  --yes \
  --no-auto-commits \
  --no-browser \
  --no-detect-urls \
  --no-gitignore \
  --no-show-model-warnings \
  --map-tokens 0 \
  --max-chat-history-tokens 4000 \
  --message-file "$PROMPT_FILE" \
  --no-pretty
