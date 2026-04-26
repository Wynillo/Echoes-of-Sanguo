# Architecture Guidelines

## Overview
Browser-based TCG engine with React frontend and game engine backend. Powered by PixiJS for rendering and GSAP for animations.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript |
| **Build** | Vite 8 |
| **Styling** | Tailwind CSS 4 |
| **Graphics** | PixiJS 8 (WebGL), GSAP 3 |
| **State** | Core engine state + React contexts |
| **i18n** | i18next, react-i18next |
| **Testing** | Vitest 4, jsdom |

## Project Structure

```
ENGINE/
├── src/
│   ├── main.ts                    # Entry point
│   ├── engine.ts                  # Game engine core
│   ├── types.ts                   # Core type definitions
│   ├── react/
│   │   ├── App.tsx               # React root
│   │   ├── screens/              # Game screens
│   │   ├── components/           # UI components
│   │   ├── modals/               # Modal dialogs
│   │   ├── contexts/             # React contexts
│   │   ├── hooks/                # Custom hooks
│   │   └── utils/                # React utilities
│   └── utils/                     # Shared utilities
├── tests/                         # Test files
├── locales/                       # i18n translations (en.json, de.json)
├── public/                        # Static assets (includes base.tcg)
└── docs/                          # Documentation
```

## Core Modules

### Game Engine (`src/engine.ts`)
- Game state management
- Battle resolution
- Effect system
- Turn flow

### TCG Format (`@wynillo/tcg-format`)
- Card definitions
- Fusion formulas
- Archive format
- Effect strings

### React Frontend (`src/react/`)
- Screen routing
- UI components
- Modal system
- Game contexts

## Design Patterns

### State Management
- **Engine state:** Immutable state transitions
- **React state:** Contexts for global state, local state for UI
- **Events:** TriggerBus for cross-module communication

### Effect System
- Descriptor-based effects
- Priority-based resolution
- Type-safe effect registry

### Module Type
- ES Modules only (`"type": "module"`)
- Named exports preferred
- Re-export from external packages

## Dependencies

### Runtime
- `react`, `react-dom` - UI framework
- `pixi.js` - 2D graphics rendering
- `gsap` - Animations
- `i18next`, `react-i18next` - Internationalization
- `jszip` - Card archive handling
- `@wynillo/echoes-mod-base` - Base card set
- `@wynillo/tcg-format` - TCG format library

### Development
- `vite` - Build tool and dev server
- `typescript` - Type system
- `vitest` - Testing
- `eslint` - Linting
- `tailwindcss` - Styling

## Rules

### Module Boundaries
- Engine code stays in `src/` (not `src/react/`)
- React components in `src/react/`
- Shared utilities in `src/utils/`
- No circular dependencies

### API Design
- Type-safe interfaces over loose objects
- Immutable state where possible
- Pure functions for calculations
- Side effects isolated at boundaries

### Performance
- Use PixiJS for game rendering (not DOM)
- Batch React re-renders with contexts
- Lazy load non-critical assets
- Memoize expensive calculations

### Internationalization
- All user-facing strings in `locales/`
- Use `t()` function from i18next
- Support German (de) and English (en)

## Examples

### Good Structure
```typescript
// src/effects/damage-effect.ts
import { EffectDescriptor } from '../types';
import { calculateDamage } from '../utils/damage-calculator';

export function resolveDamageEffect(
  effect: EffectDescriptor,
  state: GameState
): GameState {
  // Pure function, no side effects
  const damage = calculateDamage(effect.attacker, effect.target);
  return {
    ...state,
    targetHP: state.targetHP - damage,
  };
}
```

### Bad Structure
```typescript
// Mixing UI and engine logic
// src/engine.ts
import { useState } from 'react'; // Don't mix React into engine
```
