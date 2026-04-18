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

### Production Headers (Hetzner Deployment)

The nginx server at `nightbeak.dev` is configured with:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing attacks |
| `X-Frame-Options` | `DENY` | Prevents clickjacking attacks |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Enforces HTTPS |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer information |

Configuration file: `.github/nginx-sanguo.conf`

### Development Server Headers

The Vite dev server (`npm run dev`) sets these headers in `vite.config.js`:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Strict-Transport-Security` | `max-age=86400; includeSubDomains` |

For local preview builds (`npm run preview`), the same headers apply.

### GitHub Pages Deployment

**Important:** GitHub Pages does NOT automatically set `X-Content-Type-Options` or most security headers. The deployment to GitHub Pages (`.github/workflows/deploy.yml`) relies on GitHub's default headers, which include:

- ✅ Automatic HTTPS
- ✅ HSTS (for custom domains with HTTPS enforcement enabled)
- ❌ No X-Content-Type-Options
- ❌ No X-Frame-Options
- ❌ No Content-Security-Policy

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
