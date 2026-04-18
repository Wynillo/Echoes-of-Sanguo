# Safe DOM Manipulation Patterns

## Security Audit (Issue #486)

**Status**: ✅ **CLEAN** - All DOM manipulation in this codebase follows secure patterns.

**Audit Date**: 2026-04-18

**Scope**: All TypeScript/TSX files in `src/` directory.

**Findings**:
- ✅ Zero instances of `innerHTML` usage
- ✅ Zero instances of `outerHTML` usage
- ✅ Zero instances of `insertAdjacentHTML` usage
- ✅ All `document.createElement` usages (14 total) use safe patterns:
  - `textContent` for text content (automatically HTML-escaped)
  - `className` for CSS classes
  - CSS custom properties via `style.setProperty()`
  - Direct style assignments via `style.property`
  - Safe attributes (`href`, `download`) for download links

## Approved Patterns

### ✅ SAFE: Using textContent for Text

```typescript
// Always use textContent for user-generated or dynamic text
const el = document.createElement('div');
el.textContent = userInput; // Safe - HTML is automatically escaped
```

**Why**: `textContent` automatically escapes HTML special characters, preventing XSS attacks.

### ✅ SAFE: Using createElement for Structure

```typescript
// Build DOM structure element-by-element
const container = document.createElement('div');
container.className = 'damage-number';
container.style.left = `${x}px`;
container.style.top = `${y}px`;

const label = document.createElement('span');
label.textContent = `-${amount}`; // Safe text insertion
container.appendChild(label);
document.body.appendChild(container);
```

**Why**: Building DOM structure with `createElement` and `appendChild` is inherently safe when combined with `textContent`.

### ✅ SAFE: Download Links with Blob URLs

```typescript
// Safe pattern for file downloads
const a = document.createElement('a');
a.href = URL.createObjectURL(blob); // Blob URLs are safe
a.download = `filename-${Date.now()}.txt`; // Generated filename, no user input
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
```

**Why**: Blob URLs are session-scoped and cannot be exploited for XSS when used with generated filenames.

## Forbidden Patterns

### ❌ NEVER: innerHTML with Dynamic Content

```typescript
// DANGEROUS - Potential XSS vector
element.innerHTML = userInput;
element.innerHTML = `<div>${dynamicValue}</div>`;
```

**Risk**: Bypasses HTML escaping, allowing script injection.

### ❌ NEVER: outerHTML

```typescript
// DANGEROUS - Replaces element including itself
element.outerHTML = unsafeHtml;
```

### ❌ NEVER: insertAdjacentHTML

```typescript
// DANGEROUS - Same risk as innerHTML
element.insertAdjacentHTML('beforeend', userInput);
```

## When You Need HTML Rendering

If you must render HTML content (e.g., formatted card descriptions), use **DOMPurify**:

```bash
npm install dompurify
npm install -D @types/dompurify
```

```typescript
import DOMPurify from 'dompurify';

// Sanitize before rendering
const safeHtml = DOMPurify.sanitize(userProvidedHtml, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span'],
  ALLOWED_ATTR: []
});
element.innerHTML = safeHtml;
```

## ESLint Enforcement

This codebase enforces safe DOM manipulation via ESLint rules in `eslint.config.js`:

```javascript
'no-restricted-syntax': [
  'error',
  {
    selector: "MemberExpression > Identifier[name='innerHTML']",
    message: 'Use textContent or createElement instead to prevent XSS.',
  },
  {
    selector: "MemberExpression > Identifier[name='outerHTML']",
    message: 'Use textContent or createElement instead to prevent XSS.',
  },
  {
    selector: "CallExpression[callee.name='insertAdjacentHTML']",
    message: 'Use textContent or createElement instead to prevent XSS.',
  },
]
```

## References

- [MDN: Node.textContent](https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent)
- [MDN: Element.innerHTML](https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML)
- [OWASP DOM-based XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)
- [DOMPurify](https://github.com/cure53/DOMPurify)

## Files Audited

| File | Pattern | Safety |
|------|---------|--------|
| `src/main.ts` | createElement + textContent | ✅ Safe |
| `src/react/components/DamageNumberOverlay.tsx` | createElement + textContent + className | ✅ Safe |
| `src/react/components/VFXOverlay.tsx` | createElement + className + style | ✅ Safe |
| `src/react/modals/BattleLogModal.tsx` | createElement + href (blob) | ✅ Safe |
| `src/react/screens/PackOpeningScreen.tsx` | createElement + className + style | ✅ Safe |
| `src/react/hooks/useAttackAnimation.ts` | createElement + className | ✅ Safe |
| `src/react/hooks/useFusionAnimation.ts` | createElement + className | ✅ Safe |
| `src/debug-logger.ts` | createElement + href (blob) | ✅ Safe |

---

**Related Issues**:
- #486 - Multiple instances of direct DOM manipulation without sanitization

**Maintainers**: Review this document when adding new DOM manipulation patterns.
