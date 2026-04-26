# TypeScript Guidelines

## Overview
Strict TypeScript configuration with React 19 and ES2020 target. All code must be type-safe.

## Configuration

- **Target:** ES2020
- **Modules:** ESNext with bundler resolution
- **Strict Mode:** Enabled (`strict: true`, `strictNullChecks: true`)
- **JSX:** `react-jsx`
- **No Emit:** Type-check only, Vite handles compilation

## Type Patterns

### Discriminated Unions
Use discriminated unions for type-safe state machines and effect systems:

```typescript
interface EffectDescriptor {
  type: 'trigger' | 'continuous' | 'quick';
  priority: number;
  // ...
}
```

### Type Aliases from External Packages
Re-export types from `@wynillo/tcg-format`:

```typescript
export type { CardType, Attribute, Race } from '@wynillo/tcg-format';
```

### Const Assertions
Use `as const` for enum-like objects:

```typescript
const Rarity = {
  COMMON: 0,
  RARE: 1,
  LEGENDARY: 2,
} as const;
```

## Rules

### Type Safety
- Never use `as any` or type assertions to bypass type checking
- Always enable `strictNullChecks`
- Prefer explicit return types for public APIs
- Use `unknown` over `any` for uncertain types

### Module Resolution
- Use ES modules (`"type": "module"`)
- Import with `.ts`/`.tsx` extensions in mind
- Leverage Vite's bundler resolution

## Examples

### Good
```typescript
type GameState = 
  | { status: 'idle' }
  | { status: 'playing'; field: FieldState }
  | { status: 'gameover'; winner: Player };

function handleEffect(effect: EffectDescriptor): void {
  switch (effect.type) {
    case 'trigger': /* ... */ break;
    case 'continuous': /* ... */ break;
  }
}
```

### Avoid
```typescript
// Too generic
function handleEffect(effect: any): any {}

// Type assertion without justification
const value = someValue as string; // Why not use type guard?
```
