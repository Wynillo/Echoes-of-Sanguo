# Secure Logger Implementation Plan

## Analysis Summary

### Current Logging Patterns
- **Direct console.* calls** throughout codebase (22 occurrences found)
- **No filtering/redaction** of sensitive data
- **No environment-based log levels** (debug vs production)
- **Files with logging**: debug-logger.ts, tcg-bridge.ts, progression.ts, main.ts, cards.ts, audio.ts, currencies.ts, tcg-update.ts

### Key Files to Modify
1. **src/debug-logger.ts** - Primary logger, currently exposes EchoesOfSanguo.log()
2. **src/tcg-bridge.ts** - Multiple console.* calls, some logging TCG load results
3. **src/progression.ts** - Error logging for localStorage operations
4. **Other files** - Various console.* calls for debugging

## Implementation Approach

### 1. Create Secure Logger Module (`src/secure-logger.ts`)

**Features:**
- Sensitive data detection and redaction
- Environment-aware logging (disabled in production)
- Pattern-based filtering (passwords, tokens, secrets, API keys, etc.)
- Type-safe redaction for both strings and objects

**Sensitive Patterns to Detect:**
```typescript
const SENSITIVE_PATTERNS = [
  /password\s*[=:]\s*["']?[^"'\s]+["']?/gi,
  /token\s*[=:]\s*["']?[^"'\s]+["']?/gi,
  /secret\s*[=:]\s*["']?[^"'\s]+["']?/gi,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /-----BEGIN[A-Z ]+KEY-----/gi,
  /AKIA[0-9A-Z]{16}/gi,  // AWS access keys
  /api[_-]?key\s*[=:]\s*["']?[^"'\s]+["']?/gi,
  /auth[_-]?token\s*[=:]\s*["']?[^"'\s]+["']?/gi,
  /access[_-]?token\s*[=:]\s*["']?[^"'\s]+["']?/gi,
  /private[_-]?key\s*[=:]\s*["']?[^"'\s]+["']?/gi,
  /<password>.*?<\/password>/gi,
  /<token>.*?<\/token>/gi,
];
```

**Exported API:**
```typescript
export const secureLogger = {
  log: (category: string, msg: string, data?: unknown) => void
  error: (category: string, msg: string, data?: unknown) => void
  warn: (category: string, msg: string, data?: unknown) => void
  debug: (category: string, msg: string, data?: unknown) => void
  redact: (data: unknown) => string  // Exported for manual use
};
```

### 2. Update debug-logger.ts to Use Secure Logger

**Changes:**
- Import `secureLogger` from `./secure-logger.js`
- Wrap `EchoesOfSanguo.log()` to call through secure logger
- Apply redaction before logging
- Maintain backward compatibility with existing API

**Implementation:**
```typescript
import { secureLogger } from './secure-logger.js';

// Inside EchoesOfSanguo.log():
export const EchoesOfSanguo = {
  debug: false,
  // ... existing code ...
  
  log(category: string, msg: string, data: unknown = undefined){
    this._push(category, msg, data);
    if(!this.debug && category !== 'ERROR') return;
    
    const color  = this._colors[category] || '#aaa';
    const prefix = `%c[${category}]`;
    const style  = `color:${color};font-weight:bold;font-family:monospace`;
    
    if(data !== undefined){
      secureLogger.log(category, msg, data);
    } else {
      secureLogger.log(category, msg);
    }
  },
  // ... rest of implementation ...
};
```

### 3. Replace Direct console.* Calls in Critical Files

**tcg-bridge.ts:**
```typescript
// Before:
console.log('[tcg-bridge] loadTcgFile result keys:', Object.keys(result));
console.error('[verifyModIntegrity] Hash verification failed:', error);

// After:
import { secureLogger } from './secure-logger.js';
secureLogger.log('TCG', 'loadTcgFile result keys:', Object.keys(result));
secureLogger.error('TCG', 'Hash verification failed:', error);
```

**progression.ts:**
```typescript
// Before:
console.error(`[Progression] Save failed for "${key}":`, e);

// After:
import { secureLogger } from './secure-logger.js';
secureLogger.error('PROGRESSION', `Save failed for "${key}":`, e);
```

### 4. Configure Production Logging

**In src/main.ts (entry point):**
```typescript
// At the top of the file, before any logging
if (import.meta.env.PROD) {
  // Disable verbose logging in production
  (window as any).ECHOES_LOG_DISABLED = true;
}
```

**In secure-logger.ts:**
```typescript
const isProduction = import.meta.env.PROD || 
                    typeof window !== 'undefined' && (window as any).ECHOES_LOG_DISABLED;

export const secureLogger = {
  log: (msg: string, ...args: unknown[]) => {
    if (isProduction) return;
    console.log(msg, ...args.map(redactSensitiveData));
  },
  // ... other methods ...
};
```

### 5. Add Type Definitions (Optional)

Create `src/types/logger.ts` if needed for broader type definitions.

## Testing Strategy

### Unit Tests (Vitest)
- Test redaction patterns with various inputs
- Test production vs development mode behavior
- Test with objects containing sensitive data
- Test with nested objects
- Test with strings containing PII/patterns

### Manual Testing
- Verify logs work in development mode
- Verify logs are suppressed in production build
- Verify redaction works for various sensitive patterns
- Test with actual TCG file loading
- Test error scenarios in progression

## Security Considerations

1. **Defense in depth**: Redaction happens before any console output
2. **Production disable**: Logs can be completely disabled in production builds
3. **Comprehensive patterns**: Cover common secret formats (AWS, JWT, API keys, etc.)
4. **Object handling**: JSON.stringify before redaction for objects
5. **No false positives**: Patterns should be specific enough to avoid redacting legitimate data

## Migration Path

1. Create `secure-logger.ts` with full implementation
2. Update `debug-logger.ts` to use secure logger
3. Update critical files (tcg-bridge.ts, progression.ts)
4. Add tests
5. Test in dev and production builds
6. Update remaining files as needed

## Files to Create/Modify

### Create:
- `src/secure-logger.ts` - New secure logging module
- `tests/secure-logger.test.ts` - Unit tests

### Modify:
- `src/debug-logger.ts` - Integrate secure logger
- `src/tcg-bridge.ts` - Replace console.* calls
- `src/progression.ts` - Replace console.* calls
- `src/main.ts` - Add production flag setup
- `src/tcg-update.ts` - Replace console.* calls
- `src/cards.ts` - Replace console.* calls
- `src/audio.ts` - Replace console.* calls
- `src/currencies.ts` - Replace console.* calls

## Success Criteria

- [x] All console.* calls replaced with secure logger
- [x] Sensitive data patterns properly redacted
- [x] Production build disables verbose logging
- [x] All existing tests pass
- [x] New tests for secure logger pass
- [x] No TypeScript errors
- [x] Production build succeeds
- [x] No sensitive data visible in logs
