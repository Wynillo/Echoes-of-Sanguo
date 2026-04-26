# Security Guidelines

## Overview
Security-first development with ESLint rules, CSP headers, and safe patterns to prevent XSS and common vulnerabilities.

## ESLint Security Rules

Configured in `eslint.config.js` - **NEVER bypass these**:

### Banned APIs (XSS Prevention)
```typescript
// FORBIDDEN - XSS risk
element.innerHTML = userInput;
element.outerHTML = userInput;
element.insertAdjacentHTML('beforeend', userInput);
document.write('<script>...');

// ALLOWED - Safe DOM manipulation
element.textContent = userInput;
element.appendChild(document.createTextNode(userInput));
React.createElement('div', { dangerouslySetInnerHTML: __html }); // Only with sanitized input
```

### Why These Rules Matter
- `innerHTML` and similar APIs execute arbitrary HTML/JS
- `document.write` can inject malicious scripts
- User input must never reach these APIs unsanitized

## Content Security Policy (CSP)

Configured in `vite.config.js`:

### Security Headers
- **CSP:** Restricts script/style sources
- **HSTS:** Enforce HTTPS
- **X-Frame-Options:** Prevent clickjacking
- **X-Content-Type-Options:** Prevent MIME sniffing
- **Referrer-Policy:** Control referrer information

## Secure Coding Patterns

### Input Validation
```typescript
// Good - Validate all inputs
function parseCardId(input: string): number {
  const id = parseInt(input, 10);
  if (isNaN(id) || id < 0 || id > MAX_CARD_ID) {
    throw new Error('Invalid card ID');
  }
  return id;
}

// Bad - Trusting user input
const cardId = parseInt(userInput, 10); // No validation!
```

### Storage Security
```typescript
// Good - Sanitize before storing
function saveToStorage(key: string, value: unknown) {
  const sanitized = JSON.stringify(sanitizeForStorage(value));
  localStorage.setItem(key, sanitized);
}

// Bad - Storing raw user data
localStorage.setItem('userData', JSON.stringify(rawUserInput));
```

### Safe DOM Access
```typescript
// Good - React approach
function Card({ name }: CardProps) {
  return <div className="card-name">{name}</div>; // Automatically escaped
}

// Bad - Manual DOM manipulation
element.innerHTML = `<div>${cardName}</div>`; // XSS vulnerable
```

## Authentication & Authorization

### Session Management
- Use secure, httpOnly cookies (if backend exists)
- Never store tokens in localStorage
- Implement session timeout

### Access Control
- Validate user permissions on server-side
- Never trust client for authorization
- Encrypt sensitive data in transit

## Cryptography

### When to Use
- Hash sensitive data with SHA-256 or stronger
- Use HMAC for integrity verification
- Never roll your own crypto algorithms

### Examples
```typescript
// Good - Using established libraries
const hash = await crypto.subtle.digest(
  'SHA-256',
  new TextEncoder().encode(data)
);

// Bad - Custom hashing (vulnerable)
function customHash(data: string): string {
  // Don't implement your own crypto
}
```

## Testing Security

### Security Test Files
- `security-attacks.test.js` - XSS/CSRF testing
- `storage-security.test.ts` - Storage validation
- `hmac-integrity.test.ts` - Cryptographic integrity

### What to Test
- Input sanitization
- XSS attack vectors
- Storage security
- Authentication flows
- Permission boundaries

## Vulnerability Response

### If Vulnerability Found
1. **Do not discuss publicly**
2. **Document the issue privately**
3. **Fix immediately**
4. **Add test to prevent regression**
5. **Audit similar code**

### Common Vulnerabilities
| Type | Prevention |
|------|------------|
| XSS | Ban innerHTML, escape outputs |
| CSRF | Use anti-CSRF tokens |
| Storage exposure | Sanitize before localStorage |
| Cryptographic weakness | Use standard algorithms only |

## Dependencies Security

### npm Overrides
- Use `overrides` in package.json for security patches
- Keep dependencies updated
- Use `npm audit` regularly

### Third-Party Packages
- Only use packages from trusted sources
- Review package security history
- Pin versions with lock files

## Examples

### Safe React Code
```typescript
// All user content automatically escaped
function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div className="message">
      <p>{message.text}</p> {/* Safe - React escapes */}
      <span>{message.author}</span>
    </div>
  );
}
```

### Unsafe Code (FORBIDDEN)
```typescript
// XSS vulnerable - NEVER DO THIS
function renderUserContent(content: string) {
  container.innerHTML = content; // Executed as HTML!
}

// Slightly better but still risky
function renderUserContent(content: string) {
  container.innerHTML = DOMPurify.sanitize(content); // Only if DOMPurify is audited
}
```

## Rules

### NEVER
- Use `innerHTML`, `outerHTML`, `insertAdjacentHTML` with user input
- Store sensitive data unencrypted in localStorage
- Trust client-side validation for security
- Commit secrets, keys, or credentials
- Bypass ESLint security rules

### ALWAYS
- Validate and sanitize all user inputs
- Use React's built-in escaping
- Keep dependencies updated
- Run security tests
- Report vulnerabilities immediately
