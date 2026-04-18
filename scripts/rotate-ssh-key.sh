#!/bin/bash
# SSH Key Rotation Script
# Rotates the HETZNER_SSH_KEY GitHub secret
# 
# Usage: ./scripts/rotate-ssh-key.sh
# 
# Requirements:
#   - GitHub CLI (gh) installed and authenticated
#   - SSH access to the Hetzner server
#   - Environment variables: HETZNER_HOST, HETZNER_USER (default: deploy)
#
# Rotation Policy: Every 90 days or on developer departure

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEY_DIR="${HOME}/.ssh/echosanguo"
KEY_PREFIX="deploy"
DATE_SUFFIX=$(date +%Y%m%d)
ARCHIVE_DIR="${KEY_DIR}/archived"

# Ensure key directory exists
mkdir -p "${KEY_DIR}"
mkdir -p "${ARCHIVE_DIR}"

echo "🔐 SSH Key Rotation — $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 1: Archive old key if exists
OLD_KEY=$(gh secret get HETZNER_SSH_KEY 2>/dev/null || echo "")
if [[ -n "${OLD_KEY}" ]]; then
    OLD_KEY_NAME="deploy_key_$(date -d '@$(stat -c %Y "${KEY_DIR}/${KEY_PREFIX}_key 2>/dev/null || echo 0)' 2>/dev/null || echo 0 +%Y%m%d)_archived"
    if [[ -f "${KEY_DIR}/${KEY_PREFIX}_key" ]]; then
        mv "${KEY_DIR}/${KEY_PREFIX}_key" "${ARCHIVE_DIR}/${OLD_KEY_NAME}"
        mv "${KEY_DIR}/${KEY_PREFIX}_key.pub" "${ARCHIVE_DIR}/${OLD_KEY_NAME}.pub" 2>/dev/null || true
        echo "✓ Archived old key to ${ARCHIVE_DIR}/${OLD_KEY_NAME}"
    fi
fi

# Step 2: Generate new SSH key pair
NEW_KEY_FILE="${KEY_DIR}/${KEY_PREFIX}_key"
echo "Generating new SSH key pair..."
ssh-keygen -t ed25519 -f "${NEW_KEY_FILE}" -C "deploy@${DATE_SUFFIX}" -N "" -q
chmod 600 "${NEW_KEY_FILE}"
chmod 644 "${NEW_KEY_FILE}.pub"
echo "✓ Generated new key: ${NEW_KEY_FILE}"

# Step 3: Update GitHub secret
echo "Updating GitHub secret HETZNER_SSH_KEY..."
gh secret set HETZNER_SSH_KEY < "${NEW_KEY_FILE}"
echo "✓ Updated GitHub secret"

# Step 4: Upload public key to server
HETZNER_HOST="${HETZNER_HOST:-}"
HETZNER_USER="${HETZNER_USER:-deploy}"

if [[ -n "${HETZNER_HOST}" ]]; then
    echo "Uploading public key to ${HETZNER_USER}@${HETZNER_HOST}..."
    
    # Create temporary file with public key
    TEMP_PUB=$(mktemp)
    cat "${NEW_KEY_FILE}.pub" > "${TEMP_PUB}"
    
    # Upload and append to authorized_keys
    scp -i "${NEW_KEY_FILE}" -o StrictHostKeyChecking=accept-new "${TEMP_PUB}" "${HETZNER_USER}@${HETZNER_HOST}:/tmp/new_deploy_key.pub"
    ssh -i "${NEW_KEY_FILE}" -o StrictHostKeyChecking=accept-new "${HETZNER_USER}@${HETZNER_HOST}" \
        "mkdir -p ~/.ssh && cat /tmp/new_deploy_key.pub >> ~/.ssh/authorized_keys && rm /tmp/new_deploy_key.pub"
    
    rm -f "${TEMP_PUB}"
    echo "✓ Uploaded public key to server"
else
    echo "⚠️  HETZNER_HOST not set. Manual upload required:"
    echo "   ssh ${HETZNER_USER}@<host> 'mkdir -p ~/.ssh && cat <(cat ${NEW_KEY_FILE}.pub) >> ~/.ssh/authorized_keys'"
fi

# Step 5: Test new key
echo "Testing new SSH key..."
if [[ -n "${HETZNER_HOST}" ]]; then
    if ssh -i "${NEW_KEY_FILE}" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 "${HETZNER_USER}@${HETZNER_HOST}" "echo 'Connection successful'" >/dev/null 2>&1; then
        echo "✓ SSH connection test passed"
    else
        echo "❌ SSH connection test failed. Manual intervention required."
        exit 1
    fi
fi

# Step 6: Record rotation metadata
METADATA_FILE="${KEY_DIR}/rotation-log.json"
ROTATION_RECORD=$(cat <<EOF
{
  "rotated_at": "$(date -Iseconds)",
  "key_date": "${DATE_SUFFIX}",
  "key_file": "${NEW_KEY_FILE}",
  "archived_key": "${ARCHIVE_DIR}/${OLD_KEY_NAME:-none}",
  "rotated_by": "$(git config user.name || echo 'unknown')",
  "reason": "${1:-scheduled_rotation}"
}
EOF
)

# Append to rotation log (create if doesn't exist)
if [[ -f "${METADATA_FILE}" ]]; then
    # Read existing, append new
    EXISTING=$(cat "${METADATA_FILE}")
    echo "${EXISTING},${ROTATION_RECORD}" | jq -s 'add' > "${METADATA_FILE}.tmp" && mv "${METADATA_FILE}.tmp" "${METADATA_FILE}"
else
    # Create new array with first record
    echo "[${ROTATION_RECORD}]" | jq '.' > "${METADATA_FILE}"
fi

echo "✓ Rotation metadata recorded in ${METADATA_FILE}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SSH key rotation completed successfully"
echo ""
echo "Next steps:"
echo "1. Verify deployment workflow still works"
echo "2. Remove old key from server's authorized_keys (after 7 days)"
echo "3. Next rotation due: $(date -d '+90 days' +%Y-%m-%d)"
echo ""
