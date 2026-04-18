#!/bin/bash
# GitHub Token Rotation Script
# Rotates fine-grained Personal Access Tokens (PAT) for GitHub Actions
#
# Usage: ./scripts/rotate-github-token.sh
#
# Requirements:
#   - GitHub CLI (gh) installed and authenticated with admin permissions
#   - jq for JSON parsing
#
# Rotation Policy: Every 30 days or on developer departure
# Reference: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOKEN_NAME_PREFIX="echosanguo-deploy"
DATE_SUFFIX=$(date +%Y%m%d)
EXPIRATION_MONTHS=1
EXPIRY_DATE=$(date -d "+${EXPIRATION_MONTHS} months" +%Y-%m-%d)

# Token scopes required for deployment workflows
REQUIRED_SCopes="repo,workflow"

echo "🔑 GitHub Token Rotation — $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 1: Identify old token
echo "Searching for existing deploy tokens..."
OLD_TOKEN_ID=""
OLD_TOKEN_NAME=""

# Search for tokens matching our naming pattern
# GitHub API doesn't expose PAT listing for security, so we track locally
TOKEN_META_FILE="${SCRIPT_DIR}/token-metadata.json"

if [[ -f "${TOKEN_META_FILE}" ]]; then
    # Get the most recent token
    LATEST_TOKEN=$(jq -r '.[-1]' "${TOKEN_META_FILE}")
    OLD_TOKEN_ID=$(echo "${LATEST_TOKEN}" | jq -r '.token_id // empty')
    OLD_TOKEN_NAME=$(echo "${LATEST_TOKEN}" | jq -r '.token_name // empty')
    
    if [[ -n "${OLD_TOKEN_NAME}" ]]; then
        echo "✓ Found previous token: ${OLD_TOKEN_NAME}"
        echo "  Token ID: ${OLD_TOKEN_ID}"
        echo "  Created: $(echo "${LATEST_TOKEN}" | jq -r '.created_at')"
    fi
else
    echo "ℹ️  No previous token metadata found (first rotation or manual setup)"
fi

# Step 2: Guide user to create new token
echo ""
echo "📋 Creating new Personal Access Token..."
echo ""
echo "GitHub API doesn't allow programmatic PAT creation for security."
echo "Please create a new token manually at:"
echo "  https://github.com/settings/tokens/new"
echo ""
echo "Configuration:"
echo "  • Description: ${TOKEN_NAME_PREFIX}-${DATE_SUFFIX}"
echo "  • Expiration:  ${EXPIRY_DATE}"
echo "  • Repository access: All repositories (or Wynillo/* only)"
echo "  • Permissions (Fine-grained):"
echo "      - Contents: Read & Write"
echo "      - Workflows: Read & Write"
echo "      - Deployments: Read & Write"
echo ""

# Prompt for new token
read -p "Enter the new token value: " -s NEW_TOKEN
echo ""

if [[ -z "${NEW_TOKEN}" ]]; then
    echo "❌ Token value required. Aborting."
    exit 1
fi

# Validate token format (GitHub PATs start with 'ghp_')
if [[ ! "${NEW_TOKEN}" =~ ^ghp_[A-Za-z0-9]{36}$ ]]; then
    echo "⚠️  Warning: Token doesn't match expected format (ghp_...)"
    echo "   Continuing anyway, but please verify the token is valid."
fi

NEW_TOKEN_NAME="${TOKEN_NAME_PREFIX}-${DATE_SUFFIX}"

# Step 3: Update GitHub secret
echo ""
echo "Updating GitHub secret GITHUB_DEPLOY_TOKEN..."
gh secret set GITHUB_DEPLOY_TOKEN <<< "${NEW_TOKEN}"
echo "✓ Updated GitHub secret"

# Step 4: Test token (optional)
echo ""
echo "Testing token authentication..."
if gh api -H "Authorization: token ${NEW_TOKEN}" /user >/dev/null 2>&1; then
    echo "✓ Token authentication successful"
    CURRENT_USER=$(gh api -H "Authorization: token ${NEW_TOKEN}" /user | jq -r '.login')
    echo "  Authenticated as: ${CURRENT_USER}"
else
    echo "⚠️  Token test failed. Please verify:"
    echo "   • Token has correct scopes (repo, workflow)"
    echo "   • Token is not expired"
    echo "   • Token was copied correctly"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Aborted by user"
        exit 1
    fi
fi

# Step 5: Record metadata
METADATA=$(cat <<EOF
{
  "token_name": "${NEW_TOKEN_NAME}",
  "token_id": "ghp_***",
  "created_at": "$(date -Iseconds)",
  "expires_at": "${EXPIRY_DATE}",
  "created_by": "$(git config user.name || echo 'unknown')",
  "scopes": "${REQUIRED_SCopes}",
  "rotation_reason": "scheduled_rotation"
}
EOF
)

# Append to metadata file
if [[ -f "${TOKEN_META_FILE}" ]]; then
    # Add to existing array
    jq --argjson new "${METADATA}" '. += [$new]' "${TOKEN_META_FILE}" > "${TOKEN_META_FILE}.tmp"
    mv "${TOKEN_META_FILE}.tmp" "${TOKEN_META_FILE}"
else
    # Create new array
    echo "[${METADATA}]" | jq '.' > "${TOKEN_META_FILE}"
fi

echo "✓ Metadata recorded in ${TOKEN_META_FILE}"

# Step 6: Archive old token info
if [[ -n "${OLD_TOKEN_NAME}" ]]; then
    echo ""
    echo "⚠️  Manual cleanup required:"
    echo "   1. Revoke old token '${OLD_TOKEN_NAME}' at:"
    echo "      https://github.com/settings/tokens"
    echo "   2. Wait 24 hours to ensure new token works"
    echo "   3. Update token-metadata.json with actual token_id if needed"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Token rotation completed"
echo ""
echo "Next rotation due: ${EXPIRY_DATE}"
echo ""
echo "IMPORTANT: Store the new token securely if needed for local testing."
echo "The token value will not be shown again."
echo ""
