# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 5.1.x   | :white_check_mark: |
| 5.0.x   | :x:                |
| 4.0.x   | :white_check_mark: |
| < 4.0   | :x:                |

## Reporting a Vulnerability

Report security vulnerabilities by opening an issue on GitHub or contacting the maintainers directly. Expect a response within 48 hours. We will acknowledge your report and provide updates as we investigate and address the issue.

---

## Security Headers

The application implements the following security headers to protect against common web vulnerabilities:

### Content-Security-Policy (CSP)

Content-Security-Policy is implemented in three layers for defense-in-depth:

1. **Meta tag in `index.html`** — Applied for static file serving
2. **Vite dev/preview server headers** — Applied during development and local preview
3. **nginx production headers** — Applied in production deployments

**Policy:**
```
default-src 'self'
script-src 'self'
style-src 'self' 'unsafe-inline'
img-src 'self' data: blob:
font-src 'self'
connect-src 'self'
frame-ancestors 'none'
base-uri 'self'
form-action 'self'
```

**Rationale:**
- `'self'` for scripts, styles, and fonts ensures only same-origin resources load
- `'unsafe-inline'` for styles required due to inline loading screen styles in index.html
- `data:` and `blob:` for images needed for canvas operations and dynamic image generation
- `frame-ancestors 'none'` prevents clickjacking (alternative to X-Frame-Options)
- `base-uri 'self'` prevents base tag injection attacks
- `form-action 'self'` prevents form data exfiltration

### Production Headers (Hetzner Deployment)

The nginx server at `nightbeak.dev` is configured with:

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | (see above) | Prevents XSS and injection attacks |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing attacks |
| `X-Frame-Options` | `DENY` | Prevents clickjacking attacks |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Enforces HTTPS |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer information |

Configuration file: `.github/nginx-sanguo.conf`

### Development Server Headers

The Vite dev server (`npm run dev`) sets these headers in `vite.config.js`:

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | (see above) |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Strict-Transport-Security` | `max-age=86400; includeSubDomains` |

For local preview builds (`npm run preview`), the same headers apply.

### GitHub Pages Deployment

**Important:** GitHub Pages does NOT automatically set most security headers. The deployment to GitHub Pages (`.github/workflows/deploy.yml`) relies on GitHub's default headers, which include:

- ✅ Automatic HTTPS
- ✅ HSTS (for custom domains with HTTPS enforcement enabled)
- ✅ CSP via meta tag in `index.html`
- ❌ No X-Content-Type-Options
- ❌ No X-Frame-Options

For production use, deploy to a server where you can configure headers (e.g., nginx, Apache, Cloudflare Workers).

---

## Additional Security Measures

- **MIME-type enforcement**: All static assets (`.tcg`, `.json`, `.mp3`, `.png`) are served with correct MIME types
- **Mod loading security**: External `.tcg` files are validated by `@wynillo/tcg-format` before loading
- **Content integrity**: Build process generates hashed filenames for cacheable assets

---

## References

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN: X-Content-Type-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options)
- [RFC 7034: X-Content-Type-Options](https://www.rfc-editor.org/rfc/rfc7034)

---

## Secret Management & Rotation Policy

### Overview

All secrets used in CI/CD pipelines and application code follow a rotation policy to minimize the blast radius of credential compromise. Long-lived static credentials are minimized in favor of short-lived or rotating secrets.

### Secret Inventory

| Secret | Location | Rotation Period | Owner |
|--------|----------|-----------------|-------|
| `HETZNER_SSH_KEY` | GitHub Actions | 90 days | DevOps |
| `HETZNER_HOST` | GitHub Actions | Static (changes rare) | DevOps |
| `GITHUB_TOKEN` | GitHub Actions (auto) | Per-workflow | GitHub |
| `GITHUB_DEPLOY_TOKEN` | GitHub Actions (manual PAT) | 30 days | DevOps |
| `VITE_TCG_REPO` | Environment variable | Static (configurable) | Dev |

### Rotation Procedures

#### SSH Key Rotation (90 days)

**Automated Script:** `scripts/rotate-ssh-key.sh`

The script performs:
1. Archives the old SSH key
2. Generates a new ED25519 key pair
3. Updates the GitHub secret `HETZNER_SSH_KEY`
4. Uploads the public key to the Hetzner server
5. Tests the new SSH connection
6. Records rotation metadata

**Usage:**
```bash
export HETZNER_HOST="your.hetzner.server"
export HETZNER_USER="deploy"
./scripts/rotate-ssh-key.sh
```

**Manual Steps (if script fails):**
1. Generate new key: `ssh-keygen -t ed25519 -f ~/.ssh/deploy_key_new -C "deploy@$(date +%Y-%m-%d)"`
2. Add public key to server: `ssh deploy@HOST "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys" < deploy_key_new.pub`
3. Update GitHub secret: `gh secret set HETZNER_SSH_KEY < deploy_key_new`
4. Test connection: `ssh -i deploy_key_new deploy@HOST`
5. Remove old key from server's `~/.ssh/authorized_keys`

#### GitHub Token Rotation (30 days)

**Automated Script:** `scripts/rotate-github-token.sh`

The script guides you through:
1. Creating a new fine-grained Personal Access Token (PAT)
2. Updating the GitHub secret `GITHUB_DEPLOY_TOKEN`
3. Recording token metadata (name, expiration, creator)
4. Providing revocation instructions for the old token

**Usage:**
```bash
./scripts/rotate-github-token.sh
```

**Manual Token Creation:**
1. Go to https://github.com/settings/tokens/new
2. Select "Fine-grained tokens"
3. Set expiration: 30 days
4. Repository access: `Wynillo/Echoes-of-Sanguo-ENGINE` (or all repos)
5. Permissions:
   - Contents: Read & Write
   - Workflows: Read & Write
   - Deployments: Read & Write
6. Copy the token and run: `gh secret set GITHUB_DEPLOY_TOKEN`

**Required Scopes:** `repo`, `workflow`

### Secret Metadata Tracking

All rotations are recorded in metadata files:

- **SSH rotations**: `~/.ssh/echosanguo/rotation-log.json`
- **Token rotations**: `scripts/token-metadata.json`

Each record includes:
- Rotation timestamp
- Creator (git user.name)
- Expiration date
- Reason (scheduled, developer departure, suspected compromise)

### Environment-Specific Secrets

**TCG Repository Configuration:**
The TCG repository source is configurable via environment variable:

```bash
# .env or build configuration
VITE_TCG_REPO=Wynillo/Echoes-of-sanguo-MOD-base
```

This allows switching TCG sources without code changes. Default: `Wynillo/Echoes-of-sanguo-MOD-base`

### OIDC Considerations (Future)

For cloud deployments, consider using **GitHub Actions OIDC** to eliminate long-lived credentials entirely:

```yaml
permissions:
  id-token: write  # For OIDC
  contents: read
```

This allows authentication to supported cloud providers (AWS, GCP, Azure) without storing secrets.

Reference: [GitHub Actions OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)

---

## Incident Response

### Suspected Credential Compromise

If a secret is suspected to be leaked or compromised:

#### Immediate Actions (within 1 hour)

1. **Revoke the compromised secret:**
   - SSH Key: Remove from server's `~/.ssh/authorized_keys`
   - GitHub Token: Revoke at https://github.com/settings/tokens
   - GitHub Secret: Remove via `gh secret delete SECRET_NAME`

2. **Rotate all related secrets:**
   - If SSH key compromised → rotate SSH key AND GitHub tokens
   - If GitHub token compromised → rotate ONLY that token

3. **Audit recent activity:**
   - GitHub: Check https://github.com/settings/security-log
   - Server: Check `/var/log/auth.log` for unauthorized SSH access
   - GitHub Actions: Review recent workflow runs for anomalies

4. **Notify the team:**
   - Open a high-priority issue or contact maintainers
   - Document the incident timeline

#### Post-Incident (within 24 hours)

1. **Root cause analysis:**
   - How was the credential exposed?
   - Was it logged, committed, or leaked via other means?

2. **Remediation:**
   - Fix the exposure vector (e.g., add to `.gitignore`, update CI/CD)
   - Implement additional monitoring

3. **Update rotation policy:**
   - If rotation period was too long, reduce it
   - Add additional detection mechanisms

#### Incident Reporting Template

```markdown
## Security Incident Report

**Date:** YYYY-MM-DD HH:MM UTC
**Severity:** Critical / High / Medium / Low
**Affected Secret:** [Name]

### Timeline
- HH:MM - Incident detected
- HH:MM - Credential revoked
- HH:MM - New credential rotated
- HH:MM - Audit completed

### Root Cause
[Brief description]

### Actions Taken
- [ ] Credential revoked
- [ ] New credential issued
- [ ] Activity audit completed
- [ ] Exposure vector fixed

### Lessons Learned
[What we'll do differently]
```

### Developer Departure Checklist

When a developer with secret access leaves the project:

- [ ] Rotate `HETZNER_SSH_KEY` (run `scripts/rotate-ssh-key.sh`)
- [ ] Rotate `GITHUB_DEPLOY_TOKEN` (run `scripts/rotate-github-token.sh`)
- [ ] Remove from GitHub repository collaborators (if applicable)
- [ ] Remove from server's `authorized_keys` file
- [ ] Update any shared documentation or password manager entries

---

## Compliance & References

This secret management policy aligns with:

- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [CWE-324: Use of a Key Past its Expiration Date](https://cwe.mitre.org/data/definitions/324.html)
- [NIST SP 800-57: Recommendation for Key Management](https://csrc.nist.gov/publications/detail/sp/800-57/part-1/rev-5/final)

### Audit Trail

All secret rotations are logged with:
- Timestamp of rotation
- Person who performed rotation (git user.name)
- Reason for rotation
- Old and new key identifiers (redacted)

Logs retained for: **12 months**
