#!/bin/bash
# ============================================================================
# OROBOREO - Run Aider with Prompt File
# ============================================================================
#
# Usage: run-with-aider.sh <prompt-file-path> [file-to-edit ...]
#
# Environment Variables:
#   AIDER_MODEL          - Model string (e.g. azure/gpt-4o, ollama/llama3)
#   AZURE_API_KEY        - Azure OpenAI API key
#   AZURE_API_BASE       - Azure endpoint
#   AZURE_API_VERSION    - API version
#   OPENAI_API_KEY       - OpenAI API key (if using OpenAI directly)
#   AIDER_NO_GIT         - Set to "1" to disable git repo scanning
#   AIDER_READ_FILES     - Space-separated list of read-only context files
#
# ============================================================================

export AIDER_MODEL
export AZURE_API_KEY
export AZURE_API_BASE
export AZURE_API_VERSION
export OPENAI_API_KEY

# Non-OpenAI Azure models (GLM-5, Kimi, DeepSeek, MiniMax, etc.)
# These use services.ai.azure.com instead of cognitiveservices.azure.com
# Model prefix: azure_ai/<model-name>
export AZURE_AI_API_KEY
export AZURE_AI_API_BASE

# Aider/LiteLLM uses AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY
export AZURE_OPENAI_ENDPOINT="${AZURE_API_BASE}"
export AZURE_OPENAI_API_KEY="${AZURE_API_KEY}"

PROMPT_FILE="$1"
shift  # remaining args are files to edit

MODEL="${AIDER_MODEL:-azure/gpt-4o}"

# Build git flag
GIT_FLAG=""
if [ "${AIDER_NO_GIT}" = "1" ]; then
  GIT_FLAG="--no-git"
fi

# Build --file flags for editable files (passed as positional args)
FILE_FLAGS=""
for f in "$@"; do
  FILE_FLAGS="$FILE_FLAGS --file $f"
done

# Build --read flags for read-only context files
READ_FLAGS=""
if [ -n "${AIDER_READ_FILES}" ]; then
  for f in ${AIDER_READ_FILES}; do
    READ_FLAGS="$READ_FLAGS --read $f"
  done
fi

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
  --no-pretty \
  $GIT_FLAG \
  $FILE_FLAGS \
  $READ_FLAGS
