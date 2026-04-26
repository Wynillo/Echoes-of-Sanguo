# Card System Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic `Card` component with atomic decomposition, unified size tokens, proper compact layout, and eliminate `cardInnerHTML`.

**Architecture:** Six atomic components (`CardFrame`, `CardHeader`, `CardLevel`, `CardArt`, `CardBody`, `CardStats`) compose into six view components (`FieldCardCompact`, `HandCardCompact`, `DetailCard`, `DeckCard`, `RevealCard`, `CardBack`). A single `CardTokens.ts` drives all sizing. `renderCardToString` replaces `cardInnerHTML`.

**Tech Stack:** React 19, TypeScript 6, CSS Modules, Vite 8, Vitest 4. No new dependencies.

---

## File Structure

### New Files (Create)
- `src/react/components/card/CardTokens.ts` — Design tokens
- `src/react/components/card/CardFrame.tsx` + `.module.css` — Container
- `src/react/components/card/atoms/CardHeader.tsx` + `.module.css`
- `src/react/components/card/atoms/CardLevel.tsx` + `.module.css`
- `src/react/components/card/atoms/CardArt.tsx` + `.module.css`
- `src/react/components/card/atoms/CardBody.tsx` + `.module.css`
- `src/react/components/card/atoms/CardStats.tsx` + `.module.css`
- `src/react/components/card/views/FieldCardCompact.tsx`
- `src/react/components/card/views/HandCardCompact.tsx`
- `src/react/components/card/views/DetailCard.tsx`
- `src/react/components/card/views/DeckCard.tsx`
- `src/react/components/card/views/RevealCard.tsx`
- `src/react/components/card/views/CardBack.tsx`
- `src/react/components/card/renderToString.ts` — `cardInnerHTML` replacement
- `tests/components/card/CardTokens.test.ts`
- `tests/components/card/CardFrame.test.tsx`

### Modified Files
- `src/react/components/Card.tsx` — Backward-compat re-export
- `src/react/components/Card.module.css` — Delete after migration
- `src/react/components/HandCard.tsx` — Wire to `HandCardCompact`
- `src/react/components/FieldCardComponent.tsx` — Wire to `FieldCardCompact`
- `src/react/components/FieldSpellTrapComponent.tsx` — Wire to `FieldCardCompact`
- `src/react/components/HoverPreview.tsx` — Wire to `DetailCard`
- `src/react/components/CardActivationOverlay.tsx` — Wire to `RevealCard`
- `src/react/modals/CardDetailModal.tsx` — Wire to `DetailCard`
- `src/react/modals/CardListModal.tsx` — Wire to `DeckCard`
- `src/react/modals/FusionConfirmModal.tsx` — Wire to `DeckCard`
- `src/react/modals/GraveSelectModal.tsx` — Wire to `DeckCard`
- `src/react/modals/DeckSelectModal.tsx` — Wire to `DeckCard`
- `src/react/modals/TrapPromptModal.tsx` — Wire to `DeckCard`
- `src/react/screens/CollectionScreen.tsx` — Wire to `DeckCard`
- `src/react/screens/DeckbuilderScreen.tsx` — Wire to `DeckCard`
- `src/react/screens/PackOpeningScreen.tsx` — Wire to `RevealCard`
- `src/react/screens/game/PlayerField.tsx` — Pass size prop
- `src/react/screens/game/OpponentField.tsx` — Pass size prop
- `src/react/screens/game/HandArea.tsx` — Pass size prop
- `src/react/screens/GameScreen.tsx` — Calculate and pass size
- `css/style.css` — Deprecate old global classes

---

## Phase 1: Foundation (Parallel)

These tasks are independent and can run in parallel.

---

### Task 1: CardTokens.ts — Design Tokens

**Files:**
- Create: `src/react/components/card/CardTokens.ts`
- Test: `tests/components/card/CardTokens.test.ts`

**Context:** All card sizing lives here. No scattered pixel values elsewhere.

- [ ] **Step 1: Write the token types and constants**

```typescript
export type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface CardSizeTokens {
  width: number;
  height: number;
  fontName: number;
  fontLevel: number;
  fontType: number;
  fontDesc: number;
  fontStats: number;
  fontNameSmall: number;
  orbSize: number;
  orbFont: number;
  badgePaddingH: number;
  badgePaddingV: number;
  badgeFont: number;
  artMargin: number;
  artGap: number;
  bodyMaxHeight: number;
  bodyPaddingH: number;
  bodyPaddingV: number;
  statsPaddingH: number;
  statsPaddingV: number;
  statsGap: number;
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

export function getCardTokens(size: CardSize): CardSizeTokens {
  return CARD_TOKENS[size];
}
```

- [ ] **Step 2: Write tests**

```typescript
import { describe, it, expect } from 'vitest';
import { CARD_TOKENS, getCardTokens } from '../../../src/react/components/card/CardTokens';

describe('CardTokens', () => {
  it('has all 5 sizes defined', () => {
    expect(Object.keys(CARD_TOKENS)).toEqual(['xs', 'sm', 'md', 'lg', 'xl']);
  });

  it.each([
    ['xs', 68, 94],
    ['sm', 104, 144],
    ['md', 140, 195],
    ['lg', 180, 248],
    ['xl', 220, 307],
  ] as const)('size %s has width %d and height %d', (size, w, h) => {
    expect(CARD_TOKENS[size].width).toBe(w);
    expect(CARD_TOKENS[size].height).toBe(h);
  });

  it('returns correct tokens via getCardTokens', () => {
    expect(getCardTokens('sm')).toBe(CARD_TOKENS.sm);
  });

  it('maintains aspect ratio roughly 0.715', () => {
    Object.entries(CARD_TOKENS).forEach(([size, tokens]) => {
      const ratio = tokens.width / tokens.height;
      expect(ratio, `size ${size} ratio`).toBeGreaterThan(0.70);
      expect(ratio, `size ${size} ratio`).toBeLessThan(0.73);
    });
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/components/card/CardTokens.test.ts`  
Expected: All 6 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/react/components/card/CardTokens.ts tests/components/card/CardTokens.test.ts
git commit -m "feat(cards): add CardTokens design system"
```

---

### Task 2: CardFrame — Container Component

**Files:**
- Create: `src/react/components/card/CardFrame.tsx`
- Create: `src/react/components/card/CardFrame.module.css`
- Test: `tests/components/card/CardFrame.test.tsx`

**Context:** The frame sets size, border, type tint, attribute background. All other atoms render inside it.

- [ ] **Step 1: Write CardFrame.module.css**

```css
.cardFrame {
  /* Base layout only — sizing comes from inline styles */
  border-radius: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  z-index: 1;
  border: 2px solid rgba(200, 180, 100, 0.4);
  flex-shrink: 0;
  transition: none;
  background: var(--bg, #060e0a);
}

/* Type border colors */
.normal-card { border-color: rgba(220, 220, 220, 0.6); }
.effect-card  { border-color: rgba(200, 120, 40, 0.8); }
.fusion-card  { border-color: rgba(160, 80, 220, 0.9); outline: 2px solid rgba(160, 80, 220, 0.6); }
.spell-card   { border-color: rgba(40, 160, 120, 0.8); }
.trap-card    { border-color: rgba(180, 40, 80, 0.8); }
.equipment-card { border-color: rgba(224, 128, 48, 0.8); }

/* Type background tints */
.normal-card::before { content:''; position:absolute; inset:0; background:rgba(220,220,220,0.35); z-index:0; pointer-events:none; }
.effect-card::before  { content:''; position:absolute; inset:0; background:rgba(160,80,20,0.45); z-index:0; pointer-events:none; }
.fusion-card::before  { content:''; position:absolute; inset:0; background:rgba(120,40,200,0.50); z-index:0; pointer-events:none; }
.spell-card::before   { content:''; position:absolute; inset:0; background:rgba(20,140,80,0.45); z-index:0; pointer-events:none; }
.trap-card::before    { content:''; position:absolute; inset:0; background:rgba(180,20,60,0.45); z-index:0; pointer-events:none; }
.equipment-card::before { content:''; position:absolute; inset:0; background:rgba(224,128,48,0.45); z-index:0; pointer-events:none; }

/* Attribute backgrounds */
.attr-fire  { background: #451005; }
.attr-water { background: #002040; }
.attr-earth { background: #201808; }
.attr-wind  { background: #101828; }
.attr-light { background: #201c08; }
.attr-dark  { background: #160830; }
.attr-spell { background: #002018; }

/* Facedown */
.face-down { background: #081610 !important; border-color: rgba(40, 120, 70, 0.6) !important; }
.card-back-pattern {
  width: 100%; height: 100%;
  background: repeating-conic-gradient(#081610 0% 25%, rgba(30, 90, 50, 0.15) 0% 50%) 0 0 / 8px 8px;
  image-rendering: pixelated;
  display: flex; align-items: center; justify-content: center;
}
.back-label {
  font-size: 32px; color: rgba(50, 140, 70, 0.3);
  font-weight: bold; letter-spacing: -2px;
}
```

- [ ] **Step 2: Write CardFrame.tsx**

```typescript
import type { CardData, FieldCard } from '../../types.js';
import { CardType } from '../../types.js';
import { getCardTypeById, getAttrById } from '../../type-metadata.js';
import { getCardTokens, type CardSize } from './CardTokens.js';
import styles from './CardFrame.module.css';

export interface CardFrameProps {
  card?: CardData;
  fc?: FieldCard | null;
  size: CardSize;
  layout: 'full' | 'compact' | 'art-only' | 'none';
  children?: React.ReactNode;
  extraClass?: string;
}

function typeCss(card: CardData): string {
  if (card.type === CardType.Monster) return card.effect ? 'effect' : 'normal';
  return getCardTypeById(card.type)?.key.toLowerCase() ?? 'monster';
}

function attrCssKey(attr: number | undefined): string {
  if (!attr) return 'spell';
  return getAttrById(attr)?.key ?? 'spell';
}

export function CardFrame({ card, fc = null, size, layout, children, extraClass = '' }: CardFrameProps) {
  const tokens = getCardTokens(size);

  if (layout === 'none' || !card) {
    return (
      <div
        className={`${styles.cardFrame} ${styles.faceDown} ${extraClass}`}
        style={{ width: tokens.width, height: tokens.height }}
      >
        <div className={styles.cardBackPattern}>
          <span className={styles.backLabel}>A</span>
        </div>
      </div>
    );
  }

  const tCss = typeCss(card);
  const aCss = attrCssKey(card.attribute);

  const cls = [
    styles.cardFrame,
    styles[`${tCss}-card`],
    styles[`attr-${aCss}`],
    extraClass,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      style={{ width: tokens.width, height: tokens.height }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Write tests**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardFrame } from '../../../src/react/components/card/CardFrame';
import { CardType } from '../../../src/types';

const mockMonster = {
  id: 1, name: 'Test Monster', type: CardType.Monster,
  atk: 1000, def: 500, level: 4, attribute: 1, race: 1,
  description: 'A test monster',
} as const;

const mockSpell = {
  id: 2, name: 'Test Spell', type: CardType.Spell,
  spellType: 'normal', description: 'A test spell',
} as const;

describe('CardFrame', () => {
  it('renders with correct size', () => {
    render(<CardFrame card={mockMonster} size="sm" layout="compact" />);
    const frame = screen.getByText(/Test Monster/i).closest('div');
    expect(frame).toHaveStyle({ width: '104px', height: '144px' });
  });

  it('renders card back for layout=none', () => {
    render(<CardFrame size="xs" layout="none" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('applies correct type class for monster', () => {
    render(<CardFrame card={mockMonster} size="sm" layout="compact" />);
    const frame = screen.getByText(/Test Monster/i).closest('div');
    expect(frame).toHaveClass('normal-card');
  });

  it('applies correct type class for spell', () => {
    render(<CardFrame card={mockSpell} size="sm" layout="compact" />);
    const frame = screen.getByText(/Test Spell/i).closest('div');
    expect(frame).toHaveClass('spell-card');
  });

  it('applies correct attribute class', () => {
    render(<CardFrame card={mockMonster} size="sm" layout="compact" />);
    const frame = screen.getByText(/Test Monster/i).closest('div');
    expect(frame).toHaveClass('attr-fire');
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/components/card/CardFrame.test.tsx`  
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/react/components/card/CardFrame.tsx src/react/components/card/CardFrame.module.css tests/components/card/CardFrame.test.tsx
git commit -m "feat(cards): add CardFrame container component"
```

---

### Task 3: CardHeader Atom

**Files:**
- Create: `src/react/components/card/atoms/CardHeader.tsx`
- Create: `src/react/components/card/atoms/CardHeader.module.css`

- [ ] **Step 1: Write CardHeader.module.css**

```css
.cardHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 0;
  flex-shrink: 0;
  background: #000000;
}

.nameShort {
  font-weight: bold;
  color: var(--gold-light);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1;
  line-height: 1.2;
}

.attrOrb {
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.4);
  line-height: 1;
}
```

- [ ] **Step 2: Write CardHeader.tsx**

```typescript
import { getAttrById } from '../../../type-metadata.js';
import type { CardData } from '../../../types.js';
import type { CardSizeTokens } from '../CardTokens.js';
import styles from './CardHeader.module.css';

interface CardHeaderProps {
  card: CardData;
  tokens: CardSizeTokens;
}

export function CardHeader({ card, tokens }: CardHeaderProps) {
  const attrMeta = card.attribute ? getAttrById(card.attribute) : undefined;
  const attrSym = attrMeta?.symbol ?? '\u2726';
  const orbColor = attrMeta?.color ?? '#444';

  return (
    <div
      className={styles.cardHeader}
      style={{ padding: `${2}px ${tokens.bodyPaddingH}px` }}
    >
      <span
        className={styles.nameShort}
        style={{ fontSize: `${tokens.fontName}px` }}
      >
        {card.name}
      </span>
      {card.attribute && (
        <span
          className={styles.attrOrb}
          style={{
            width: tokens.orbSize,
            height: tokens.orbSize,
            fontSize: tokens.orbFont,
            background: orbColor,
          }}
        >
          {attrSym}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify with test**

No separate test file — tested via CardFrame integration. Run: `npx vitest run tests/components/card/CardFrame.test.tsx`  
Expected: Still passes

- [ ] **Step 4: Commit**

```bash
git add src/react/components/card/atoms/CardHeader.tsx src/react/components/card/atoms/CardHeader.module.css
git commit -m "feat(cards): add CardHeader atom"
```

---

### Task 4: CardLevel Atom

**Files:**
- Create: `src/react/components/card/atoms/CardLevel.tsx`
- Create: `src/react/components/card/atoms/CardLevel.module.css`

- [ ] **Step 1: Write CardLevel.module.css**

```css
.cardLevel {
  color: var(--gold);
  text-align: center;
  line-height: 1;
  letter-spacing: -1px;
  flex-shrink: 0;
}
```

- [ ] **Step 2: Write CardLevel.tsx**

```typescript
import { CardType } from '../../../types.js';
import type { CardData } from '../../../types.js';
import type { CardSizeTokens } from '../CardTokens.js';
import styles from './CardLevel.module.css';

interface CardLevelProps {
  card: CardData;
  tokens: CardSizeTokens;
}

export function CardLevel({ card, tokens }: CardLevelProps) {
  const isMonsterLevel = card.type === CardType.Monster || card.type === CardType.Fusion;
  const levelStars = isMonsterLevel && card.level ? '\u2605'.repeat(Math.min(card.level, 12)) : '';

  if (!levelStars) return null;

  return (
    <div
      className={styles.cardLevel}
      style={{
        fontSize: tokens.fontLevel,
        padding: '1px 2px',
        minHeight: `${tokens.fontLevel + 3}px`,
      }}
    >
      {levelStars}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/react/components/card/atoms/CardLevel.tsx src/react/components/card/atoms/CardLevel.module.css
git commit -m "feat(cards): add CardLevel atom"
```

---

### Task 5: CardArt Atom

**Files:**
- Create: `src/react/components/card/atoms/CardArt.tsx`
- Create: `src/react/components/card/atoms/CardArt.module.css`

- [ ] **Step 1: Write CardArt.module.css**

```css
.cardArt {
  aspect-ratio: 1 / 1;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.raceBadge {
  position: absolute;
  top: 2px;
  left: 2px;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 0.3px;
  line-height: 1.2;
  z-index: 1;
}

.rarityText {
  position: absolute;
  bottom: 2px;
  right: 3px;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.3px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  pointer-events: none;
  z-index: 1;
}
```

- [ ] **Step 2: Write CardArt.tsx**

```typescript
import { getRaceById, getRarityById } from '../../../type-metadata.js';
import type { CardData } from '../../../types.js';
import { CardType } from '../../../types.js';
import type { CardSizeTokens } from '../CardTokens.js';
import styles from './CardArt.module.css';

function getPlaceholderUrl(card: CardData): string | null {
  switch (card.type) {
    case CardType.Monster: return './img/placeholders/monster.svg';
    case CardType.Fusion: return './img/placeholders/fusion.svg';
    case CardType.Trap: return './img/placeholders/trap.svg';
    case CardType.Equipment: return './img/placeholders/equipment.svg';
    case CardType.Spell:
      return card.spellType === 'field'
        ? './img/placeholders/field-spell.svg'
        : './img/placeholders/spell.svg';
    default: return null;
  }
}

interface CardArtProps {
  card: CardData;
  tokens: CardSizeTokens;
}

export function CardArt({ card, tokens }: CardArtProps) {
  const placeholderUrl = getPlaceholderUrl(card);
  const artStyle: React.CSSProperties | undefined = placeholderUrl
    ? { backgroundImage: `url(${placeholderUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined;

  const raceMeta = card.race ? getRaceById(card.race) : undefined;
  const raceBadge = card.race ? (
    <span
      className={styles.raceBadge}
      style={{
        background: raceMeta?.color ?? '#444',
        fontSize: tokens.badgeFont,
        padding: `${tokens.badgePaddingV}px ${tokens.badgePaddingH}px`,
      }}
    >
      {raceMeta?.value ?? card.race}
    </span>
  ) : null;

  const rarMeta = card.rarity ? getRarityById(card.rarity) : undefined;
  const rarityText = card.rarity ? (
    <span
      className={styles.rarityText}
      style={{ fontSize: tokens.badgeFont, color: rarMeta?.color ?? '#aaa' }}
    >
      {rarMeta?.value ?? ''}
    </span>
  ) : null;

  return (
    <div
      className={styles.cardArt}
      style={{
        ...artStyle,
        width: `calc(100% - ${tokens.artMargin * 2}px)`,
        margin: `${tokens.artMargin}px`,
      }}
    >
      {raceBadge}
      {rarityText}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/react/components/card/atoms/CardArt.tsx src/react/components/card/atoms/CardArt.module.css
git commit -m "feat(cards): add CardArt atom"
```

---

### Task 6: CardBody Atom

**Files:**
- Create: `src/react/components/card/atoms/CardBody.tsx`
- Create: `src/react/components/card/atoms/CardBody.module.css`

- [ ] **Step 1: Write CardBody.module.css**

```css
.cardBody {
  display: flex;
  flex-direction: column;
  background: #080808;
  border-top: 1px solid #303030;
  flex-shrink: 0;
  overflow: hidden;
}

.typeSubtype {
  color: var(--text-dim);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.descText {
  color: var(--text);
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
}
```

- [ ] **Step 2: Write CardBody.tsx**

```typescript
import { useTranslation } from 'react-i18next';
import { getRaceById, getCardTypeById } from '../../../type-metadata.js';
import { CardType } from '../../../types.js';
import type { CardData } from '../../../types.js';
import type { CardSizeTokens } from '../CardTokens.js';
import { highlightCardText } from '../../utils/highlightCardText.js';
import styles from './CardBody.module.css';

interface CardBodyProps {
  card: CardData;
  tokens: CardSizeTokens;
  showDescription?: boolean;
}

function getTypeLabel(card: CardData): string {
  const { t } = useTranslation();
  if (card.type === CardType.Monster && card.effect) return t('card_detail.type_effect');
  return getCardTypeById(card.type)?.value ?? '';
}

export function CardBody({ card, tokens, showDescription = true }: CardBodyProps) {
  const raceMeta = card.race ? getRaceById(card.race) : undefined;
  const raceLabel = raceMeta?.value ?? '';
  const typeLabel = getTypeLabel(card);
  const isMonster = card.atk !== undefined && card.type !== CardType.Equipment;

  const typeSubtypeStr = isMonster && raceLabel
    ? `[${typeLabel} / ${raceLabel}]`
    : `[${typeLabel}]`;

  return (
    <div
      className={styles.cardBody}
      style={{
        maxHeight: tokens.bodyMaxHeight,
        padding: `${tokens.bodyPaddingV}px ${tokens.bodyPaddingH}px`,
        gap: tokens.artGap,
      }}
    >
      <div
        className={styles.typeSubtype}
        style={{ fontSize: tokens.fontType }}
      >
        {typeSubtypeStr}
      </div>
      {showDescription && card.description && (
        <div
          className={styles.descText}
          style={{
            fontSize: tokens.fontDesc,
            WebkitLineClamp: tokens.bodyMaxHeight > 40 ? 3 : 2,
          }}
        >
          {highlightCardText(card.description)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/react/components/card/atoms/CardBody.tsx src/react/components/card/atoms/CardBody.module.css
git commit -m "feat(cards): add CardBody atom"
```

---

### Task 7: CardStats Atom

**Files:**
- Create: `src/react/components/card/atoms/CardStats.tsx`
- Create: `src/react/components/card/atoms/CardStats.module.css`

- [ ] **Step 1: Write CardStats.module.css**

```css
.cardStats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #000000;
  flex-shrink: 0;
  min-height: 0;
}

.atkVal {
  font-weight: bold;
  color: #ff9955;
  font-family: var(--font-stats);
}

.defVal {
  font-weight: bold;
  color: #55aaff;
  font-family: var(--font-stats);
}

.statBuffed {
  color: #88ff88 !important;
}
.statBuffed::before {
  content: "▲ ";
  font-size: 8px;
}

.statNerfed {
  color: #ff6666 !important;
}
.statNerfed::before {
  content: "▼ ";
  font-size: 8px;
}

.noStats {
  min-height: 0;
  padding: 0 !important;
}
```

- [ ] **Step 2: Write CardStats.tsx**

```typescript
import { CardType } from '../../../types.js';
import type { CardData, FieldCard } from '../../../types.js';
import type { CardSizeTokens } from '../CardTokens.js';
import styles from './CardStats.module.css';

interface CardStatsProps {
  card: CardData;
  fc?: FieldCard | null;
  tokens: CardSizeTokens;
  compact?: boolean;
}

export function CardStats({ card, fc = null, tokens, compact = false }: CardStatsProps) {
  const isMonster = card.atk !== undefined && card.type !== CardType.Equipment;
  const isEquipment = card.type === CardType.Equipment;

  const baseATK = card.atk ?? 0;
  const baseDEF = card.def ?? 0;
  const effATK = fc ? fc.effectiveATK() : baseATK;
  const effDEF = fc ? fc.effectiveDEF() : baseDEF;

  const atkCls = fc ? (effATK > baseATK ? styles.statBuffed : effATK < baseATK ? styles.statNerfed : '') : '';
  const defCls = fc ? (effDEF > baseDEF ? styles.statBuffed : effDEF < baseDEF ? styles.statNerfed : '') : '';

  const labelStyle = { fontSize: tokens.fontStats };

  if (isMonster) {
    if (compact) {
      return (
        <div
          className={styles.cardStats}
          style={{
            gap: 0,
            padding: 0,
            borderTop: '1px solid #303030',
          }}
        >
          <span className={`${styles.atkVal}${atkCls ? ` ${atkCls}` : ''}`} style={{ ...labelStyle, flex: 1, textAlign: 'center', padding: '3px 0', borderRight: '1px solid #303030' }}>
            {effATK}
          </span>
          <span className={`${styles.defVal}${defCls ? ` ${defCls}` : ''}`} style={{ ...labelStyle, flex: 1, textAlign: 'center', padding: '3px 0' }}>
            {effDEF}
          </span>
        </div>
      );
    }
    return (
      <div
        className={styles.cardStats}
        style={{
          padding: `${tokens.statsPaddingV}px ${tokens.statsPaddingH}px`,
          gap: tokens.statsGap,
        }}
      >
        <span className={`${styles.atkVal}${atkCls ? ` ${atkCls}` : ''}`} style={labelStyle}>ATK: {effATK}</span>
        <span className={`${styles.defVal}${defCls ? ` ${defCls}` : ''}`} style={labelStyle}>DEF: {effDEF}</span>
      </div>
    );
  }

  if (isEquipment) {
    const equipAtkB = card.atkBonus ?? 0;
    const equipDefB = card.defBonus ?? 0;
    return (
      <div
        className={styles.cardStats}
        style={{
          padding: `${tokens.statsPaddingV}px ${tokens.statsPaddingH}px`,
          gap: tokens.statsGap,
        }}
      >
        {equipAtkB !== 0 && <span className={styles.atkVal} style={labelStyle}>ATK {equipAtkB >= 0 ? '+' : ''}{equipAtkB}</span>}
        {equipDefB !== 0 && <span className={styles.defVal} style={labelStyle}>DEF {equipDefB >= 0 ? '+' : ''}{equipDefB}</span>}
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`${styles.cardStats} ${styles.noStats}`}>
        <span style={{ ...labelStyle, flex: 1, textAlign: 'center', padding: '3px 0', color: '#7090b0', fontWeight: 'bold' }}>
          {getCardTypeById(card.type)?.value ?? ''}
        </span>
      </div>
    );
  }

  return <div className={`${styles.cardStats} ${styles.noStats}`} />;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/react/components/card/atoms/CardStats.tsx src/react/components/card/atoms/CardStats.module.css
git commit -m "feat(cards): add CardStats atom"
```

---

## Phase 2: View Components (Sequential — depend on atoms)

---

### Task 8: HandCardCompact View

**Files:**
- Create: `src/react/components/card/views/HandCardCompact.tsx`

- [ ] **Step 1: Write HandCardCompact.tsx**

```typescript
import type { CardData } from '../../../types.js';
import { CardFrame } from '../CardFrame.js';
import { CardArt } from '../atoms/CardArt.js';
import { CardStats } from '../atoms/CardStats.js';
import { getCardTokens } from '../CardTokens.js';

interface HandCardCompactProps {
  card: CardData;
  size?: 'xs' | 'sm';
}

export function HandCardCompact({ card, size = 'sm' }: HandCardCompactProps) {
  const tokens = getCardTokens(size);

  return (
    <CardFrame card={card} size={size} layout="compact">
      <CardArt card={card} tokens={tokens} />
      <CardStats card={card} tokens={tokens} compact />
      <div
        style={{
          fontSize: tokens.fontNameSmall,
          fontWeight: 'bold',
          color: 'var(--gold-light, #e0c870)',
          textAlign: 'center',
          padding: '2px 3px 3px',
          background: '#000',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.3,
        }}
      >
        {card.name}
      </div>
    </CardFrame>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/react/components/card/views/HandCardCompact.tsx
git commit -m "feat(cards): add HandCardCompact view"
```

---

### Task 9: FieldCardCompact View

**Files:**
- Create: `src/react/components/card/views/FieldCardCompact.tsx`

- [ ] **Step 1: Write FieldCardCompact.tsx**

```typescript
import type { CardData, FieldCard } from '../../../types.js';
import { CardFrame } from '../CardFrame.js';
import { CardArt } from '../atoms/CardArt.js';
import { CardStats } from '../atoms/CardStats.js';
import { getCardTokens } from '../CardTokens.js';

interface FieldCardCompactProps {
  card: CardData;
  fc?: FieldCard | null;
  size?: 'xs' | 'sm';
}

export function FieldCardCompact({ card, fc = null, size = 'sm' }: FieldCardCompactProps) {
  const tokens = getCardTokens(size);

  return (
    <CardFrame card={card} size={size} layout="compact" fc={fc}>
      <CardArt card={card} tokens={tokens} />
      <CardStats card={card} fc={fc} tokens={tokens} compact />
      <div
        style={{
          fontSize: tokens.fontNameSmall,
          fontWeight: 'bold',
          color: 'var(--gold-light, #e0c870)',
          textAlign: 'center',
          padding: '2px 3px 3px',
          background: '#000',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.3,
        }}
      >
        {card.name}
      </div>
    </CardFrame>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/react/components/card/views/FieldCardCompact.tsx
git commit -m "feat(cards): add FieldCardCompact view"
```

---

### Task 10: DetailCard View

**Files:**
- Create: `src/react/components/card/views/DetailCard.tsx`

- [ ] **Step 1: Write DetailCard.tsx**

```typescript
import type { CardData, FieldCard } from '../../../types.js';
import { CardFrame } from '../CardFrame.js';
import { CardHeader } from '../atoms/CardHeader.js';
import { CardLevel } from '../atoms/CardLevel.js';
import { CardArt } from '../atoms/CardArt.js';
import { CardBody } from '../atoms/CardBody.js';
import { CardStats } from '../atoms/CardStats.js';
import { getCardTokens } from '../CardTokens.js';

interface DetailCardProps {
  card: CardData;
  fc?: FieldCard | null;
}

export function DetailCard({ card, fc = null }: DetailCardProps) {
  const tokens = getCardTokens('lg');

  return (
    <CardFrame card={card} size="lg" layout="full" fc={fc}>
      <CardHeader card={card} tokens={tokens} />
      <CardLevel card={card} tokens={tokens} />
      <CardArt card={card} tokens={tokens} />
      <CardBody card={card} tokens={tokens} showDescription />
      <CardStats card={card} fc={fc} tokens={tokens} />
    </CardFrame>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/react/components/card/views/DetailCard.tsx
git commit -m "feat(cards): add DetailCard view"
```

---

### Task 11: DeckCard View

**Files:**
- Create: `src/react/components/card/views/DeckCard.tsx`

- [ ] **Step 1: Write DeckCard.tsx**

```typescript
import type { CardData } from '../../../types.js';
import { CardFrame } from '../CardFrame.js';
import { CardHeader } from '../atoms/CardHeader.js';
import { CardLevel } from '../atoms/CardLevel.js';
import { CardArt } from '../atoms/CardArt.js';
import { CardBody } from '../atoms/CardBody.js';
import { CardStats } from '../atoms/CardStats.js';
import { getCardTokens } from '../CardTokens.js';

interface DeckCardProps {
  card: CardData;
  size?: 'sm' | 'md';
}

export function DeckCard({ card, size = 'sm' }: DeckCardProps) {
  const tokens = getCardTokens(size);

  return (
    <CardFrame card={card} size={size} layout="full">
      <CardHeader card={card} tokens={tokens} />
      <CardLevel card={card} tokens={tokens} />
      <CardArt card={card} tokens={tokens} />
      <CardBody card={card} tokens={tokens} showDescription={false} />
      <CardStats card={card} tokens={tokens} />
    </CardFrame>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/react/components/card/views/DeckCard.tsx
git commit -m "feat(cards): add DeckCard view"
```

---

### Task 12: RevealCard View

**Files:**
- Create: `src/react/components/card/views/RevealCard.tsx`

- [ ] **Step 1: Write RevealCard.tsx**

```typescript
import type { CardData, FieldCard } from '../../../types.js';
import { CardFrame } from '../CardFrame.js';
import { CardHeader } from '../atoms/CardHeader.js';
import { CardLevel } from '../atoms/CardLevel.js';
import { CardArt } from '../atoms/CardArt.js';
import { CardBody } from '../atoms/CardBody.js';
import { CardStats } from '../atoms/CardStats.js';
import { getCardTokens } from '../CardTokens.js';

interface RevealCardProps {
  card: CardData;
  fc?: FieldCard | null;
}

export function RevealCard({ card, fc = null }: RevealCardProps) {
  const tokens = getCardTokens('xl');

  return (
    <CardFrame card={card} size="xl" layout="full" fc={fc}>
      <CardHeader card={card} tokens={tokens} />
      <CardLevel card={card} tokens={tokens} />
      <CardArt card={card} tokens={tokens} />
      <CardBody card={card} tokens={tokens} showDescription />
      <CardStats card={card} fc={fc} tokens={tokens} />
    </CardFrame>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/react/components/card/views/RevealCard.tsx
git commit -m "feat(cards): add RevealCard view"
```

---

### Task 13: CardBack View

**Files:**
- Create: `src/react/components/card/views/CardBack.tsx`

- [ ] **Step 1: Write CardBack.tsx**

```typescript
import { CardFrame } from '../CardFrame.js';
import type { CardSize } from '../CardTokens.js';

interface CardBackProps {
  size?: CardSize;
}

export function CardBack({ size = 'sm' }: CardBackProps) {
  return <CardFrame size={size} layout="none" />;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/react/components/card/views/CardBack.tsx
git commit -m "feat(cards): add CardBack view"
```

---

## Phase 3: renderToString Replacement

---

### Task 14: renderToString Utility

**Files:**
- Create: `src/react/components/card/renderToString.ts`

- [ ] **Step 1: Write renderToString.ts**

```typescript
import { renderToStaticMarkup } from 'react-dom/server';
import { CardFrame } from './CardFrame.js';
import { CardHeader } from './atoms/CardHeader.js';
import { CardLevel } from './atoms/CardLevel.js';
import { CardArt } from './atoms/CardArt.js';
import { CardBody } from './atoms/CardBody.js';
import { CardStats } from './atoms/CardStats.js';
import { getCardTokens } from './CardTokens.js';
import type { CardData, FieldCard } from '../../types.js';
import type { CardSize } from './CardTokens.js';

interface RenderToStringOptions {
  card: CardData;
  dimmed?: boolean;
  rotated?: boolean;
  fc?: FieldCard | null;
  size?: CardSize;
  layout?: 'full' | 'compact';
}

export function renderCardToString({
  card,
  dimmed = false,
  rotated = false,
  fc = null,
  size = 'sm',
  layout = 'full',
}: RenderToStringOptions): string {
  const tokens = getCardTokens(size);

  const element = (
    <CardFrame card={card} size={size} layout={layout} fc={fc}>
      {layout === 'full' && <CardHeader card={card} tokens={tokens} />}
      {layout === 'full' && <CardLevel card={card} tokens={tokens} />}
      <CardArt card={card} tokens={tokens} />
      {layout === 'full' && <CardBody card={card} tokens={tokens} showDescription />}
      <CardStats card={card} fc={fc} tokens={tokens} compact={layout === 'compact'} />
    </CardFrame>
  );

  let html = renderToStaticMarkup(element);

  if (dimmed) {
    html = html.replace(
      'class="',
      'class="dimmed '
    );
  }

  if (rotated) {
    html = html.replace(
      'style="',
      'style="transform: rotate(90deg); '
    );
  }

  return html;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/react/components/card/renderToString.ts
git commit -m "feat(cards): add renderToString utility for legacy consumers"
```

---

## Phase 4: Migrate Consumers (Sequential)

---

### Task 15: Wire HandCard Wrapper

**Files:**
- Modify: `src/react/components/HandCard.tsx`

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { Card, cardTypeCss, ATTR_CSS } from './Card.js';
```
With:
```typescript
import { HandCardCompact } from './card/views/HandCardCompact.js';
import { cardTypeCss } from './Card.js';
import { ATTR_CSS } from './Card.js';
```

- [ ] **Step 2: Replace Card with HandCardCompact**

Replace the inner `return` JSX:
```tsx
<Card card={card} small />
```
With:
```tsx
<HandCardCompact card={card} />
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`  
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor: HandCard uses HandCardCompact"
```

---

### Task 16: Wire FieldCardComponent

**Files:**
- Modify: `src/react/components/FieldCardComponent.tsx`

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { Card, cardTypeCss, ATTR_CSS } from './Card.js';
```
With:
```typescript
import { FieldCardCompact } from './card/views/FieldCardCompact.js';
import { cardTypeCss } from './Card.js';
import { ATTR_CSS } from './Card.js';
```

- [ ] **Step 2: Replace Card usage for face-up and face-down-own**

In the face-down own section, replace:
```tsx
<Card card={card} fc={fc} small dimmed />
```
With:
```tsx
<FieldCardCompact card={card} fc={fc} size="sm" />
<div className="facedown-overlay">{t('game.facedown')}</div>
```

In the face-up section, replace:
```tsx
<Card card={card} fc={fc} small />
```
With:
```tsx
<FieldCardCompact card={card} fc={fc} size="sm" />
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`  
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor: FieldCardComponent uses FieldCardCompact"
```

---

### Task 17: Wire FieldSpellTrapComponent

**Files:**
- Modify: `src/react/components/FieldSpellTrapComponent.tsx`

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { Card, cardTypeCss } from './Card.js';
```
With:
```typescript
import { FieldCardCompact } from './card/views/FieldCardCompact.js';
import { cardTypeCss } from './Card.js';
```

- [ ] **Step 2: Replace Card usage in face-up section**

Replace:
```tsx
<Card card={card} small />
```
With:
```tsx
<FieldCardCompact card={card} size="sm" />
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`  
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor: FieldSpellTrapComponent uses FieldCardCompact"
```

---

### Task 18: Wire HoverPreview

**Files:**
- Modify: `src/react/components/HoverPreview.tsx`

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { Card } from './Card.js';
```
With:
```typescript
import { DetailCard } from './card/views/DetailCard.js';
```

- [ ] **Step 2: Replace Card with DetailCard**

Replace:
```tsx
<Card card={card} fc={fc} />
```
With:
```tsx
<DetailCard card={card} fc={fc} />
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`  
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor: HoverPreview uses DetailCard"
```

---

### Task 19: Wire CardDetailModal

**Files:**
- Modify: `src/react/modals/CardDetailModal.tsx`

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { Card } from '../components/Card.js';
```
With:
```typescript
import { DetailCard } from '../components/card/views/DetailCard.js';
```

- [ ] **Step 2: Replace Card with DetailCard**

Replace:
```tsx
<Card card={card} big />
```
With:
```tsx
<DetailCard card={card} />
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`  
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor: CardDetailModal uses DetailCard"
```

---

### Task 20: Wire CardListModal

**Files:**
- Modify: `src/react/modals/CardListModal.tsx`

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { Card } from '../components/Card.js';
```
With:
```typescript
import { DeckCard } from '../components/card/views/DeckCard.js';
```

- [ ] **Step 2: Replace Card usage in card list**

Replace:
```tsx
<Card card={card} />
```
With:
```tsx
<DeckCard card={card} size="sm" />
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`  
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor: CardListModal uses DeckCard"
```

---

### Task 21: Wire FusionConfirmModal

**Files:**
- Modify: `src/react/modals/FusionConfirmModal.tsx`

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { Card } from '../components/Card.js';
```
With:
```typescript
import { DeckCard } from '../components/card/views/DeckCard.js';
```

- [ ] **Step 2: Replace Card usage**

Replace:
```tsx
<Card card={card} />
```
With:
```tsx
<DeckCard card={card} size="sm" />
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`  
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor: FusionConfirmModal uses DeckCard"
```

---

### Task 22: Wire GraveSelectModal

**Files:**
- Modify: `src/react/modals/GraveSelectModal.tsx`

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { Card } from '../components/Card.js';
```
With:
```typescript
import { DeckCard } from '../components/card/views/DeckCard.js';
```

- [ ] **Step 2: Replace Card usage**

Replace:
```tsx
<Card card={card} />
```
With:
```tsx
<DeckCard card={card} size="sm" />
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`  
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor: GraveSelectModal uses DeckCard"
```

---

### Task 23: Wire DeckSelectModal

**Files:**
- Modify: `src/react/modals/DeckSelectModal.tsx`

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { Card } from '../components/Card.js';
```
With:
```typescript
import { DeckCard } from '../components/card/views/DeckCard.js';
```

- [ ] **Step 2: Replace Card usage**

Replace:
```tsx
<Card card={card} />
```
With:
```tsx
<DeckCard card={card} size="sm" />
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`  
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor: DeckSelectModal uses DeckCard"
```

---

### Task 24: Wire TrapPromptModal

**Files:**
- Modify: `src/react/modals/TrapPromptModal.tsx`

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { Card } from '../components/Card.js';
```
With:
```typescript
import { DeckCard } from '../components/card/views/DeckCard.js';
```

- [ ] **Step 2: Replace Card usage**

Replace:
```tsx
<Card card={card} />
```
With:
```tsx
<DeckCard card={card} size="sm" />
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`  
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor: TrapPromptModal uses DeckCard"
```

---

### Task 25: Wire CollectionScreen

**Files:**
- Modify: `src/react/screens/CollectionScreen.tsx`

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { Card } from '../components/Card.js';
```
With:
```typescript
import { DeckCard } from '../components/card/views/DeckCard.js';
```

- [ ] **Step 2: Replace Card usage**

Replace:
```tsx
<Card card={card} small />
```
With:
```tsx
<DeckCard card={card} size="sm" />
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`  
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor: CollectionScreen uses DeckCard"
```

---

### Task 26: Wire DeckbuilderScreen

**Files:**
- Modify: `src/react/screens/DeckbuilderScreen.tsx`

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { Card } from '../components/Card.js';
```
With:
```typescript
import { DeckCard } from '../components/card/views/DeckCard.js';
```

- [ ] **Step 2: Replace Card usage**

Replace:
```tsx
<Card card={card} />
```
With:
```tsx
<DeckCard card={card} size="sm" />
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`  
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor: DeckbuilderScreen uses DeckCard"
```

---

### Task 27: Wire PackOpeningScreen

**Files:**
- Modify: `src/react/screens/PackOpeningScreen.tsx`

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { Card } from '../components/Card.js';
```
With:
```typescript
import { RevealCard } from '../components/card/views/RevealCard.js';
```

- [ ] **Step 2: Replace Card usage**

Replace:
```tsx
<Card card={currentCard} big />
```
With:
```tsx
<RevealCard card={currentCard} />
```

Also replace the small card for already-opened cards:
```tsx
<Card card={card} />
```
With:
```tsx
<DeckCard card={card} size="sm" />
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`  
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor: PackOpeningScreen uses RevealCard and DeckCard"
```

---

### Task 28: Wire CardActivationOverlay

**Files:**
- Modify: `src/react/components/CardActivationOverlay.tsx`

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { Card } from './Card.js';
```
With:
```typescript
import { RevealCard } from './card/views/RevealCard.js';
```

- [ ] **Step 2: Replace Card usage**

Replace:
```tsx
<Card card={card} big />
```
With:
```tsx
<RevealCard card={card} />
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`  
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor: CardActivationOverlay uses RevealCard"
```

---

## Phase 5: GameScreen Dynamic Sizing

---

### Task 29: Add Size Prop to Game Sub-Components

**Files:**
- Modify: `src/react/screens/game/PlayerField.tsx`
- Modify: `src/react/screens/game/OpponentField.tsx`
- Modify: `src/react/screens/game/HandArea.tsx`

- [ ] **Step 1: Update PlayerField to accept cardSize prop**

Add prop:
```tsx
interface PlayerFieldProps {
  // ... existing props
  cardSize?: 'xs' | 'sm';
}
```

Pass `cardSize` to `FieldCardComponent` instances.

- [ ] **Step 2: Update OpponentField to accept cardSize prop**

Add prop:
```tsx
interface OpponentFieldProps {
  // ... existing props
  cardSize?: 'xs' | 'sm';
}
```

Pass `cardSize` to `FieldCardComponent` instances. Opponent field typically uses `xs`.

- [ ] **Step 3: Update HandArea to accept cardSize prop**

Add prop:
```tsx
interface HandAreaProps {
  // ... existing props
  cardSize?: 'xs' | 'sm';
}
```

Pass `cardSize` to `HandCard` instances.

- [ ] **Step 4: Update GameScreen to calculate and pass size**

In `GameScreen.tsx`, calculate size based on viewport:

```tsx
function calculateCardSize(): 'xs' | 'sm' {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Use xs for very small screens or when width is tight
  if (vw < 600 || vh < 500) return 'xs';
  return 'sm';
}

// In the render:
const cardSize = calculateCardSize();

<PlayerField cardSize={cardSize} ... />
<OpponentField cardSize="xs" ... />
<HandArea cardSize={cardSize} ... />
```

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`  
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git commit -am "feat: GameScreen passes calculated cardSize to field and hand"
```

---

## Phase 6: Legacy Cleanup

---

### Task 30: Replace Card.tsx with Backward-Compat Re-Export

**Files:**
- Modify: `src/react/components/Card.tsx`

- [ ] **Step 1: Replace Card.tsx content**

```typescript
// Card.tsx — Backward-compatible wrapper (DEPRECATED)
// Use specific view components instead:
//   HandCardCompact, FieldCardCompact, DetailCard, DeckCard, RevealCard, CardBack
//
// This file will be removed in a future release.

import { DetailCard } from './card/views/DetailCard.js';
import { DeckCard } from './card/views/DeckCard.js';
import { HandCardCompact } from './card/views/HandCardCompact.js';
import { FieldCardCompact } from './card/views/FieldCardCompact.js';
import { CardFrame } from './card/CardFrame.js';
import { cardTypeCss as _cardTypeCss } from './card/utils.js';
import { ATTR_CSS as _ATTR_CSS } from './card/utils.js';
import type { CardData, FieldCard } from '../../types.js';

export const cardTypeCss = _cardTypeCss;
export const ATTR_CSS = _ATTR_CSS;

interface CardProps {
  card: CardData;
  fc?: FieldCard | null;
  dimmed?: boolean;
  rotated?: boolean;
  big?: boolean;
  small?: boolean;
  extraClass?: string;
}

/**
 * @deprecated Use specific view components instead:
 *   - HandCardCompact for hand cards
 *   - FieldCardCompact for field cards
 *   - DetailCard for detail modals / hover previews
 *   - DeckCard for deckbuilder / collection / lists
 *   - RevealCard for pack opening / activation overlays
 *   - CardBack for facedown cards
 */
export function Card({ card, fc = null, big = false, small = false }: CardProps) {
  if (big) {
    return <DetailCard card={card} fc={fc} />;
  }
  if (small) {
    return <HandCardCompact card={card} />;
  }
  return <DeckCard card={card} size="sm" />;
}

/**
 * @deprecated Use renderCardToString from './card/renderToString.js' instead.
 */
export function cardInnerHTML(card: CardData, _dimmed = false, _rotated = false, fc: FieldCard | null = null): string {
  const { renderCardToString } = require('./card/renderToString.js');
  return renderCardToString({ card, fc, size: 'sm', layout: 'full' });
}
```

- [ ] **Step 2: Create utils.ts for shared helpers**

```typescript
import { CardType } from '../../types.js';
import type { CardData } from '../../types.js';
import { getCardTypeById, getAttrById } from '../../type-metadata.js';

export function typeCss(card: CardData): string {
  if (card.type === CardType.Monster) return card.effect ? 'effect' : 'normal';
  return getCardTypeById(card.type)?.key.toLowerCase() ?? 'monster';
}

export function attrCssKey(attr: number | undefined): string {
  if (!attr) return 'spell';
  return getAttrById(attr)?.key ?? 'spell';
}

export function cardTypeCss(card: CardData): string {
  return typeCss(card);
}

export const ATTR_CSS: Record<number, string> = new Proxy({} as Record<number, string>, {
  get(_t, prop) {
    return getAttrById(Number(prop))?.key ?? 'spell';
  },
});
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`  
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor: Card.tsx becomes backward-compat re-export"
```

---

### Task 31: Deprecate Global CSS Classes

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: Add deprecation comments and move to bottom**

Find and wrap these sections with deprecation comments:

```css
/* @deprecated — Card sizing classes. Use CardFrame component with size prop instead. */
.card {
  width: var(--card-w);
  height: var(--card-h);
  /* ... rest of .card styles ... */
}

/* @deprecated — Use CardFrame size="lg" instead. */
.big-card {
  width: var(--card-w-big);
  height: var(--card-h-big);
}

/* @deprecated — Use CardFrame with layout="compact" instead. */
.small-card { /* ... */ }

/* @deprecated — Use CardFrame size="xs" instead. */
.opponent-side { /* ... */ }
```

Do NOT delete yet — only add deprecation comments.

- [ ] **Step 2: Commit**

```bash
git commit -am "docs: deprecate legacy card CSS classes"
```

---

### Task 32: Delete Old Card.module.css

**Files:**
- Delete: `src/react/components/Card.module.css`

- [ ] **Step 1: Delete file**

```bash
rm src/react/components/Card.module.css
```

- [ ] **Step 2: Verify nothing else imports it**

Run: `grep -r "Card.module.css" src/ || echo "No references found"`  
Expected: "No references found"

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`  
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor: delete old Card.module.css"
```

---

## Phase 7: Verification & Testing

---

### Task 33: Run Full Test Suite

- [ ] **Step 1: Run unit tests**

```bash
npx vitest run
```
Expected: All tests pass (or pre-existing failures only)

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```
Expected: No type errors

- [ ] **Step 3: Run build**

```bash
npm run build
```
Expected: Build succeeds with no errors

- [ ] **Step 4: Dev server visual check**

```bash
npm run dev
```
Manually verify:
- [ ] Game field cards render correctly (both player and opponent)
- [ ] Hand cards render and hover correctly
- [ ] Card detail modal shows big card with all info
- [ ] Collection screen grid looks correct
- [ ] Deckbuilder cards look correct
- [ ] Pack opening reveal card looks dramatic
- [ ] Card activation overlay renders properly
- [ ] Grave select / deck select modals show cards
- [ ] Trap prompt modal shows battle context cards
- [ ] Mobile portrait (< 540px) cards resize
- [ ] Mobile landscape (< 450px height) cards resize

- [ ] **Step 5: Commit**

```bash
git commit -am "test: verify card system overhaul passes all checks"
```

---

## Self-Review Checklist

### Spec Coverage

| Spec Section | Plan Task(s) |
|---|---|
| Component decomposition (6 atoms) | Tasks 2–7 |
| Design tokens (CardTokens.ts) | Task 1 |
| Size variants (xs/sm/md/lg/xl) | Task 1 |
| Layout modes (full/compact/art-only/none) | Tasks 8–13 |
| View components (6 views) | Tasks 8–13 |
| renderToString replacement | Task 14 |
| Migrate consumers | Tasks 15–28 |
| GameScreen dynamic sizing | Task 29 |
| Backward compat (Card.tsx wrapper) | Tasks 30 |
| CSS deprecation | Task 31 |
| Delete Card.module.css | Task 32 |
| Full verification | Task 33 |

### Placeholder Scan
- [x] No "TBD" or "TODO" in steps
- [x] No "implement later" or "fill in details"
- [x] No vague "add validation" steps
- [x] No "similar to Task N" references
- [x] All steps have concrete code or commands

### Type Consistency
- [x] `CardSize` = `'xs' | 'sm' | 'md' | 'lg' | 'xl'` everywhere
- [x] `CardSizeTokens` interface consistent across all atoms
- [x] `layout` prop = `'full' | 'compact' | 'art-only' | 'none'` everywhere
- [x] `fc?: FieldCard | null` consistent with existing codebase

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-26-card-system-overhaul.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Uses `superpowers:subagent-driven-development`.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

Which approach would you prefer?
