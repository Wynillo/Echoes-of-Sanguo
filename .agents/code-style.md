# Code Style Guidelines

## Overview
React 19 + TypeScript codebase with Tailwind CSS 4 for styling. Zero border-radius design for retro aesthetic.

## File Structure

```
src/
├── main.ts                    # Entry point
├── types.ts                   # Core types
├── *.ts                       # Engine modules (camelCase)
├── react/
│   ├── App.tsx               # Root component
│   ├── screens/              # Screen components (PascalCase)
│   ├── components/           # Reusable UI (PascalCase)
│   ├── modals/               # Modal components (PascalCase)
│   ├── contexts/             # React contexts (PascalCase)
│   ├── hooks/                # Custom hooks (camelCase, use*)
│   └── utils/                # Utility functions (camelCase)
└── utils/                    # Shared utilities (camelCase)
```

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (engine) | camelCase | `effect-registry.ts` |
| Files (React) | PascalCase | `GameScreen.tsx` |
| Components | PascalCase | `CardSelector`, `BattlePanel` |
| Functions | camelCase | `calculateDamage`, `resolveEffect` |
| Types/Interfaces | PascalCase | `GameState`, `CardEffect` |
| Enums | PascalCase | `CardType`, `Rarity` |
| Enum Values | UPPER_SNAKE_CASE | `Rarity.COMMON`, `CardType.MONSTER` |
| Constants | UPPER_SNAKE_CASE | `MAX_FIELD_SIZE`, `DEFAULT_HP` |
| Custom Hooks | camelCase with `use` | `useAudio`, `useGameState` |

## Code Organization

### Module Structure
- Exports at bottom of file or inline with `export` keyword
- Group related exports together
- Re-export types from external packages

### Functions
- Keep functions small and focused (single responsibility)
- Use named exports for utilities
- Default exports only for main module entry points

### Comments
- JSDoc comments for public APIs
- Inline comments for complex logic
- Avoid obvious comments

## Styling (Tailwind CSS)

- **Zero border-radius:** All corners are sharp (retro aesthetic)
- **Custom theme:** CSS variables for colors (bg, panel, gold, text)
- **Font family:** Pixel fonts for retro look
- **Responsive:** Mobile-first approach

## ESLint Rules

Configured in `eslint.config.js`:

### Security Rules
- Ban `innerHTML`, `outerHTML`, `insertAdjacentHTML`
- Ban `document.write()`
- Prevent XSS vulnerabilities

### React Rules
- Enforce React Hooks rules
- Valid JSX syntax
- Component naming

## Examples

### Good
```typescript
// File: src/utils/damage-calculator.ts
import { Card, BattleConfig } from '../types';

export function calculateDamage(
  attacker: Card,
  defender: Card,
  config: BattleConfig
): number {
  const baseDamage = attacker.attack - defender.defense;
  return Math.max(0, baseDamage * config.multiplier);
}
```

```typescript
// File: src/react/components/CardSelector.tsx
export function CardSelector({ cards, onSelect }: CardSelectorProps) {
  return (
    <div className="card-selector">
      {cards.map(card => (
        <Card key={card.id} card={card} onClick={() => onSelect(card)} />
      ))}
    </div>
  );
}
```

### Avoid
```typescript
// Wrong file naming
src/utils/DamageCalculator.ts  // Should be: damage-calculator.ts

// Wrong component naming
function cardSelector() {}     // Should be: function CardSelector()

// Inconsistent naming
const cardList = [];           // Should be: const cards = [];
```
