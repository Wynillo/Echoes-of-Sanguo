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
img-src 'self' data: blob: https:
font-src 'self'
connect-src 'self' https://raw.githubusercontent.com
frame-ancestors 'none'
base-uri 'self'
form-action 'self'
```

**Rationale:**
- `'self'` for scripts, styles, and fonts ensures only same-origin resources load
- `'unsafe-inline'` for styles required due to inline loading screen styles in index.html
- `data:`, `blob:`, and `https:` for images needed for canvas operations, dynamic image generation, and loading card artwork from HTTPS sources
- `https://raw.githubusercontent.com` for `connect-src` allows loading external `.tcg` mod files from trusted GitHub repositories (see `ALLOWED_MOD_SOURCES` in `src/mod-api.ts`)
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
| `Content-Security-Policy` | (see above, includes `https://raw.githubusercontent.com` for mod loading) |
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

### Capacitor/Android Configuration

For Android builds, CSP is configured in `capacitor.config.ts` via the `server.csp` property. This policy is applied to the WebView at runtime:

```ts
capacitor.config.ts
server: {
  androidScheme: 'https',
  csp: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self' https://raw.githubusercontent.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
}
```

**Note:** The Android CSP allows `'unsafe-inline'` for scripts due to Capacitor's runtime requirements, but maintains strict origin policies for all other directives.

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
