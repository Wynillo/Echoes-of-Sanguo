# Testing Guidelines

## Overview
Vitest-based testing with jsdom for React components and Node environment for engine tests.

## Framework

- **Test Runner:** Vitest 4
- **Environment:** Node (engine tests), jsdom (React tests)
- **Setup:** `tests/setup.js` - mocks localStorage, window, initializes fixtures
- **Coverage:** V8 coverage via `@vitest/coverage-v8`

## Test Commands

```bash
npm run test          # Run tests once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## Test File Patterns

- **Location:** `tests/` directory
- **Naming:** `*.test.ts` or `*.test.js`
- **Structure:** Follow source structure (e.g., `src/utils/foo.ts` → `tests/utils/foo.test.ts`)

## Test Categories

| Category | Files |
|----------|-------|
| AI Tests | `ai-*.test.js` |
| Engine Tests | `engine.*.test.js` |
| Effect Tests | `effect-*.test.{js,ts}` |
| Security Tests | `security-*.test.{js,ts}` |
| Integration | `*-integration.test.ts` |

## Rules

### Test Structure
- Use `describe()` for grouping related tests
- Use `it()` or `test()` for individual test cases
- Arrange-Act-Assert pattern for test body

### Mocking
- Mock `localStorage`/`sessionStorage` in setup file
- Use Vitest's `vi.mock()` for module mocking
- Clear mocks between tests with `afterEach()`

### Fixtures
- Store test data in `tests/fixtures/`
- Load fixtures in setup file for reuse
- Keep fixtures minimal and focused

### Assertions
- Use Vitest's `expect()` API
- Test specific values, not implementation details
- Include meaningful error messages

## Examples

### Good
```typescript
describe('EffectRegistry', () => {
  let registry: EffectRegistry;

  beforeEach(() => {
    registry = new EffectRegistry();
  });

  it('should register effect with valid descriptor', () => {
    const effect = { type: 'trigger', priority: 1 };
    
    registry.register(effect);
    
    expect(registry.effects).toHaveLength(1);
    expect(registry.effects[0]).toEqual(effect);
  });
});
```

### Avoid
```typescript
// Testing implementation, not behavior
it('should call internal method', () => {
  const spy = vi.spyOn(obj, '_privateMethod');
  obj.doSomething();
  expect(spy).toHaveBeenCalled(); // Don't test private methods
});

// Too many assertions in one test
it('should do everything', () => {
  // 20+ assertions testing multiple concerns
});
```
