# Card System Overhaul — Design Spec

**Date**: 2026-04-26  
**Status**: Draft, awaiting review  
**Author**: Sisyphus (AI orchestrator)  
**Scope**: Full decomposition and redesign of card rendering components  

---

## 1. Why

Current card system has accumulated technical debt:
- **5 inconsistent size contexts** with scattered sizing logic (CSS vars, hardcoded pixels, `.opponent-side` overrides)
- **"Small" layout is a hack** — it hides elements via `display: none` instead of being a real compact design
- **Dual rendering paths** — `Card.tsx` has both React JSX and `cardInnerHTML()` HTML-string generation for animations/legacy
- **CSS scattered** across `Card.module.css`, global `style.css`, and inline styles — no single source of truth

This overhaul replaces the monolithic `Card` with atomic decomposition, unifies sizing, and eliminates `cardInnerHTML`.

---

## 2. Goals

| # | Goal | Metric |
|---|---|---|
| G1 | Single source of truth for card sizing | One token file, no scattered CSS overrides |
| G2 | Proper compact layout for field/hand cards | `layout="compact"` renders a real ART+STATS+NAME card, not just hidden elements |
| G3 | Eliminate `cardInnerHTML` | All card rendering goes through React → `renderToString()` for legacy consumers |
| G4 | Easy to add new card sizes or variants | Add one entry to `CardTokens.ts`, zero CSS changes |
| G5 | Backward compatibility during migration | Existing `<Card card={c} big />` keeps working for at least one release |

---

## 3. Architecture

### 3.1 Component Hierarchy

```
src/react/components/card/
├── CardTokens.ts                     # Design tokens (single source of truth)
├── CardFrame.tsx                     # Core container: border, background, sizing
├── CardFrame.module.css              # Frame styles only (no sub-element sizing)
│
├── atoms/
│   ├── CardHeader.tsx                # Name + attribute orb
│   ├── CardHeader.module.css
│   ├── CardLevel.tsx                 # Star row
│   ├── CardLevel.module.css
│   ├── CardArt.tsx                   # Artwork area + race badge + rarity text
│   ├── CardArt.module.css
│   ├── CardBody.tsx                  # Type/subtype + description
│   ├── CardBody.module.css
│   ├── CardStats.tsx                 # ATK/DEF bar (or equip bonuses)
│   └── CardStats.module.css
│
├── views/
│   ├── FieldCardCompact.tsx          # Monster/spell/trap on game field
│   ├── HandCardCompact.tsx           # Cards in hand
│   ├── DetailCard.tsx                # Card detail modal / hover preview
│   ├── DeckCard.tsx                  # Deckbuilder / collection grid
│   ├── RevealCard.tsx                # Pack opening animation
│   └── CardBack.tsx                  # Opponent facedown cards
│
├── wrappers/                         # Behavioral shells (keep thin!)
│   ├── HandCard.tsx                  # Hover, long-press, selection badges, fusion states
│   ├── FieldCardComponent.tsx        # Equipment badges, passive icons, attack states
│   └── FieldSpellTrapComponent.tsx   # Facedown overlays, activation states
│
└── legacy/
    └── Card.tsx                      # Backward-compat re-export (deprecated)
```

### 3.2 Atomic Components API

Every atom accepts:
```typescript
interface CardAtomProps {
  card: CardData;
  fc?: FieldCard | null;
  size: CardSize;           // 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  tokens: CardSizeTokens;   // from CardTokens.ts
}
```

**CardFrame** is the only component that sets `width`/`height`. All atoms use relative sizing (percentages, flex, `calc`) derived from `tokens`.

### 3.3 Design Tokens (CardTokens.ts)

```typescript
export type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface CardSizeTokens {
  width: number;            // px
  height: number;           // px
  fontName: number;         // px
  fontLevel: number;        // px
  fontType: number;         // px
  fontDesc: number;         // px
  fontStats: number;        // px
  fontNameSmall: number;    // px (compact layout name font)
  orbSize: number;          // px
  orbFont: number;          // px
  badgePaddingH: number;    // px
  badgePaddingV: number;    // px
  badgeFont: number;        // px
  artMargin: number;        // px
  artGap: number;           // px
  bodyMaxHeight: number;    // px
  bodyPaddingH: number;     // px
  bodyPaddingV: number;     // px
  statsPaddingH: number;    // px
  statsPaddingV: number;    // px
  statsGap: number;         // px
}

export const CARD_TOKENS: Record<CardSize, CardSizeTokens> = {
  xs: {
    width: 68, height: 94,
    fontName: 6, fontLevel: 5, fontType: 4, fontDesc: 4, fontStats: 6,
    fontNameSmall: 5, orbSize: 10, orbFont: 6,
    badgePaddingH: 2, badgePaddingV: 1, badgeFont: 5,
    artMargin: 2, artGap: 1, bodyMaxHeight: 0, bodyPaddingH: 2, bodyPaddingV: 1,
    statsPaddingH: 2, statsPaddingV: 1, statsGap: 1,
  },
  sm: {
    width: 104, height: 144,
    fontName: 9, fontLevel: 8, fontType: 6, fontDesc: 6, fontStats: 8,
    fontNameSmall: 7, orbSize: 14, orbFont: 9,
    badgePaddingH: 3, badgePaddingV: 1, badgeFont: 7,
    artMargin: 5, artGap: 1, bodyMaxHeight: 36, bodyPaddingH: 4, bodyPaddingV: 2,
    statsPaddingH: 5, statsPaddingV: 2, statsGap: 4,
  },
  md: {
    width: 140, height: 195,
    fontName: 11, fontLevel: 10, fontType: 8, fontDesc: 8, fontStats: 10,
    fontNameSmall: 9, orbSize: 16, orbFont: 11,
    badgePaddingH: 4, badgePaddingV: 1, badgeFont: 8,
    artMargin: 6, artGap: 2, bodyMaxHeight: 46, bodyPaddingH: 5, bodyPaddingV: 3,
    statsPaddingH: 6, statsPaddingV: 3, statsGap: 4,
  },
  lg: {
    width: 180, height: 248,
    fontName: 11, fontLevel: 12, fontType: 9, fontDesc: 9, fontStats: 12,
    fontNameSmall: 11, orbSize: 20, orbFont: 12,
    badgePaddingH: 5, badgePaddingV: 1, badgeFont: 9,
    artMargin: 6, artGap: 2, bodyMaxHeight: 56, bodyPaddingH: 6, bodyPaddingV: 3,
    statsPaddingH: 8, statsPaddingV: 4, statsGap: 4,
  },
  xl: {
    width: 220, height: 307,
    fontName: 13, fontLevel: 14, fontType: 11, fontDesc: 11, fontStats: 14,
    fontNameSmall: 13, orbSize: 24, orbFont: 14,
    badgePaddingH: 6, badgePaddingV: 2, badgeFont: 11,
    artMargin: 8, artGap: 3, bodyMaxHeight: 72, bodyPaddingH: 8, bodyPaddingV: 4,
    statsPaddingH: 10, statsPaddingV: 5, statsGap: 6,
  },
};
```

### 3.4 Layout Modes

Each view component declares its layout explicitly:

| Layout | Renders |
|---|---|
| `full` | Header + Level + Art + Body (type/subtype + description) + Stats |
| `compact` | Art + Stats + Name (no header, no level, no body) |
| `art-only` | Art only (for very dense mini grids) |
| `none` | Card back pattern (for facedown opponent cards) |

### 3.5 View Components Mapping

| View Component | Layout | Size | Used By |
|---|---|---|---|
| `FieldCardCompact` | `compact` | `xs` or `sm` | `PlayerField`, `OpponentField` |
| `HandCardCompact` | `compact` | `sm` | `HandArea` |
| `DetailCard` | `full` | `lg` | `CardDetailModal`, `HoverPreview` |
| `DeckCard` | `full` | `sm` | `DeckbuilderScreen`, `CollectionScreen` |
| `RevealCard` | `full` | `xl` | `PackOpeningScreen`, `CardActivationOverlay` |
| `CardBack` | `none` | `xs` or `sm` | `OpponentField` (facedown cards) |

**Note**: The `xs` vs `sm` distinction replaces the old `.opponent-side` CSS hack. Opponent field = `xs`, player field = `sm`.

---

## 4. CSS Architecture

### 4.1 File Split Strategy

| File | Contains | Does NOT contain |
|---|---|---|
| `CardFrame.module.css` | `.cardFrame`, type border colors, attribute backgrounds, facedown styles, card-back pattern | Font sizes, padding, margins |
| `CardHeader.module.css` | Header flex layout, name truncation, attribute orb shape | Font sizes, orb dimensions |
| `CardLevel.module.css` | Star row centering, spacing | Font size |
| `CardArt.module.css` | Art area aspect ratio, border, race badge positioning, rarity text positioning | Margin, font sizes |
| `CardBody.module.css` | Body flex column, description clamp | Max-height, padding, font sizes |
| `CardStats.module.css` | Stats bar flex row, ATK/DEF color classes, buff/nerf indicators | Padding, font sizes, gap |

### 4.2 Global CSS Cleanup

Remove from `css/style.css`:
- `.card` sizing rules (moved to `CardFrame.module.css`)
- `.big-card` class (replaced by `size="lg"` or `size="xl"`)
- `.small-card` class (replaced by `size="xs"` and `layout="compact"`)
- `.opponent-side` overrides (replaced by `size="xs"`)
- `#hover-card-render .card` overrides (replaced by `CardFrame` sizing prop)

Mark with `@deprecated` for one release cycle before deleting:
- `--card-w-opp`, `--card-h-opp` (use `size="xs"` instead)
- `.card` class global definition (use `<CardFrame>` instead)

### 4.3 Dynamic Sizing on GameScreen

**Current problem**: `#game-screen` overrides `--card-w` / `--card-h` globally, affecting everything inside.  
**New approach**: `GameScreen` calculates card dimensions from viewport and passes them as inline style props to field/hand components:

```tsx
// GameScreen.tsx
const fieldSize = calculateFieldSize(); // returns 'xs' | 'sm' based on viewport

<PlayerField cardSize={fieldSize} />
<OpponentField cardSize={fieldSize === 'sm' ? 'xs' : 'xs'} />
<HandArea cardSize={fieldSize} />
```

This removes CSS variable spaghetti and makes sizing predictable.

---

## 5. Migration Plan

### Phase 1: Add New System (Backward-Compatible)

1. Create `src/react/components/card/` directory
2. Implement `CardTokens.ts`
3. Implement all atoms (`CardFrame`, `CardHeader`, `CardLevel`, `CardArt`, `CardBody`, `CardStats`) with their module CSS
4. Implement all view components (`FieldCardCompact`, `HandCardCompact`, `DetailCard`, `DeckCard`, `RevealCard`, `CardBack`)
5. Implement `renderToString` wrapper for legacy consumers
6. **Do NOT delete old code yet**

### Phase 2: Migrate Consumers

1. Update `HandArea` to use `<HandCard>` wrapping `<HandCardCompact>`
2. Update `PlayerField` / `OpponentField` to use `<FieldCardComponent>` wrapping `<FieldCardCompact>`
3. Update `CardDetailModal` to use `<DetailCard>`
4. Update `HoverPreview` to use `<DetailCard>`
5. Update `DeckbuilderScreen` to use `<DeckCard>`
6. Update `CollectionScreen` to use `<DeckCard>`
7. Update `PackOpeningScreen` to use `<RevealCard>`
8. Update `CardActivationOverlay` to use `<RevealCard>`

### Phase 3: Remove Legacy

1. Replace `Card.tsx` with backward-compat re-export
2. Delete `Card.module.css`
3. Remove deprecated global CSS classes from `style.css` (after one release cycle)
4. Delete `cardInnerHTML` function entirely

---

## 6. API Changes

### New Components

```tsx
<CardFrame card={card} size="sm" layout="compact" fc={fc} />
<DetailCard card={card} fc={fc} />        // size="lg" layout="full"
<DeckCard card={card} />                  // size="sm" layout="full"
<RevealCard card={card} />                // size="xl" layout="full"
<CardBack size="xs" />                    // facedown card back
```

### Legacy Wrapper (Temporary)

Old code still works:
```tsx
import { Card } from './components/Card.js';
<Card card={card} big />    // → internally renders <DetailCard>
<Card card={card} small />  // → internally renders <DeckCard> or <HandCardCompact>
```

### renderToString Replacement

```tsx
import { renderCardToString } from './components/card/renderToString.js';

// Replaces cardInnerHTML(card, dimmed, rotated, fc)
const html = renderCardToString({ card, dimmed, rotated, fc, size: 'sm', layout: 'compact' });
```

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Animation consumers break when `cardInnerHTML` is removed | High | Keep `cardInnerHTML` as a thin wrapper around `renderCardToString` during Phase 2 |
| Mobile game-screen dynamic sizing regressions | High | Test on multiple viewports; keep calculation formula identical |
| Visual regression from removing `.opponent-side` overrides | Medium | Manually verify opponent card readability at `xs` size |
| Bundle size increase from more components | Low | Tree-shaking eliminates unused atoms; no new dependencies |

---

## 8. Testing Checklist

- [ ] All card sizes render correctly (xs/sm/md/lg/xl)
- [ ] Compact layout shows art + stats + name (not hidden elements)
- [ ] Full layout shows all sections
- [ ] Card back renders correctly for facedown opponent cards
- [ ] Equipment badges and passive icons render on field cards
- [ ] Hover preview renders correctly with `lg` size
- [ ] Pack opening reveal renders correctly with `xl` size
- [ ] GameScreen field cards resize correctly on viewport changes
- [ ] Mobile portrait (< 540px) and landscape (< 450px height) layouts work
- [ ] `renderCardToString` output matches old `cardInnerHTML` output (pixel-diff or visual comparison)

---

## 9. Open Questions

1. Should `CardFrame` support inline art images (instead of placeholder SVGs), or is that out of scope?
2. Should we add a `mini` size (smaller than `xs`) for very dense grids (e.g. 10+ cards in a modal)?
3. Should the new system support animated card frames (e.g. holographic border for ultra-rare cards), or is that a future enhancement?

---

## 10. Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-26 | Full decomposition (Approach C) chosen | User explicitly selected over B; future-proofs for new card types and design tokens |
| 2026-04-26 | CSS Modules over Tailwind for card internals | Cards need pixel-precise control; Tailwind utility classes become unwieldy at this density |
| 2026-04-26 | Size tokens as TypeScript objects over CSS variables | Enables runtime size calculation (GameScreen dynamic sizing) and type safety |
| 2026-04-26 | `renderToString` wrapper instead of keeping `cardInnerHTML` | Single rendering path = no drift between React and HTML outputs |
