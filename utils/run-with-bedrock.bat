@echo off
REM ============================================================================
REM OROBOREO - Run Claude Code with AWS Bedrock
REM ============================================================================
REM
REM This script configures Claude Code to use AWS Bedrock instead of
REM the Anthropic API. It loads credentials from oroboreo/.env.
REM
REM Usage: run-with-bedrock.bat <prompt-file-path>
REM
REM Prerequisites:
REM   - AWS credentials in oroboreo/.env:
REM       AWS_ACCESS_KEY_ID=AKIA...
REM       AWS_SECRET_ACCESS_KEY=...
REM       AWS_REGION=us-east-1
REM
REM   - Bedrock access enabled in your AWS account
REM   - Claude models enabled in Bedrock (us-east-1)
REM
REM ============================================================================

REM Load AWS credentials from oroboreo/.env if it exists
if exist "%~dp0..\.env" (
    echo [INFO] Loading AWS credentials from oroboreo\.env
    for /f "usebackq tokens=1,* delims==" %%a in ("%~dp0..\.env") do (
        set "%%a=%%b"
    )
) else (
    echo [WARNING] oroboreo\.env not found - using environment variables
)

REM Verify AWS credentials are set
if not defined AWS_ACCESS_KEY_ID (
    echo [ERROR] AWS_ACCESS_KEY_ID not set!
    echo Please create oroboreo\.env with your AWS credentials
    exit /b 1
)

REM Set Claude Code to use Bedrock with cross-region inference profile
set CLAUDE_CODE_USE_BEDROCK=1

REM Default model if not set
if not defined ANTHROPIC_MODEL (
    set ANTHROPIC_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0
)

echo [INFO] Claude Code configured for AWS Bedrock
echo [INFO] Model: %ANTHROPIC_MODEL%
echo [INFO] Region: %AWS_REGION%
echo.

REM Run Claude Code with the prompt file
type "%~1" | npx @anthropic-ai/claude-code --print --dangerously-skip-permissions
