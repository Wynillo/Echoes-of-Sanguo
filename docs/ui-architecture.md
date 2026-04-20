# UI Architecture — Echoes of Sanguo

**Date:** 2026-04-17
**Group:** G9
**Dependencies:** G1 (Engine-Core)

---

## Overview

The UI layer of Echoes of Sanguo is built with **React 19**, **TypeScript 6**, and **Vite 8**. It uses the **Context API** for state management across 6 specialized contexts. The UI communicates with the pure TypeScript game engine exclusively through the `UICallbacks` interface.

**Key Technologies:**

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.4 | UI framework with Context-based state |
| TypeScript | 6.0 | Type safety |
| Vite | 8.0.8 | Build tool and dev server |
| GSAP | 3.14.2 | Animations (attacks, effects, transitions) |
| i18next | 25.10.10 | Internationalization |
| react-i18next | 16.6.6 | React bindings for i18next |
| react-icons | 5.6.0 | Icon library |

**Architecture Principle:** The engine (in `src/engine.ts`, `src/field.ts`, etc.) is pure TypeScript with no React dependencies. All UI interaction flows through the `UICallbacks` interface.

---

## Architecture

### Layers Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Screens (14+)                                              │
│  PressStart, Title, Starter, Campaign, Dialogue,           │
│  Opponent, GameScreen, DuelResult, Shop, PackOpening,      │
│  Collection, Deckbuilder, SaveSlot, SavePoint              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Contexts (6)                                               │
│  ┌─────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ GameContext │ │ ProgressionCtx  │ │   ModalContext  │   │
│  └─────────────┘ └─────────────────┘ └─────────────────┘   │
│  ┌─────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ ScreenContext│ │ SelectionContext│ │ CampaignContext │   │
│  └─────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Engine (Pure TypeScript)                                   │
│  GameEngine, Field, Rules, EffectRegistry, AIBehaviors     │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
src/react/
├── App.tsx                 # Root component with provider tree
├── index.tsx               # React entry point
├── contexts/               # React Context providers
│   ├── GameContext.tsx     # Game state and engine communication
│   ├── ProgressionContext.tsx  # Coins, collection, deck
│   ├── ModalContext.tsx    # Modal state management
│   ├── ScreenContext.tsx   # Screen routing and navigation
│   ├── SelectionContext.tsx    # Card selection modes
│   ├── CampaignContext.tsx # Campaign progress and nodes
│   └── GamepadContext.tsx  # Controller input handling
├── screens/                # Screen components
│   ├── PressStartScreen.tsx
│   ├── TitleScreen.tsx
│   ├── StarterScreen.tsx
│   ├── CampaignScreen.tsx
│   ├── DialogueScreen.tsx
│   ├── OpponentScreen.tsx
│   ├── GameScreen.tsx      # Main duel screen
│   ├── DuelResultScreen.tsx
│   ├── ShopScreen.tsx
│   ├── PackOpeningScreen.tsx
│   ├── CollectionScreen.tsx
│   ├── DeckbuilderScreen.tsx
│   ├── SaveSlotScreen.tsx
│   ├── SavePointScreen.tsx
│   └── game/               # GameScreen sub-components
│       ├── HandArea.tsx
│       ├── PlayerField.tsx
│       ├── OpponentField.tsx
│       ├── LPPanel.tsx
│       └── PhaseControls.tsx
├── components/             # Reusable UI components
│   ├── Card.tsx            # Card rendering component
│   ├── HandCard.tsx        # Hand card with interactions
│   ├── FieldCardComponent.tsx  # Field monster display
│   ├── FieldSpellTrapComponent.tsx
│   ├── HoverPreview.tsx    # Card hover preview
│   ├── CardActivationOverlay.tsx
│   ├── VFXOverlay.tsx      # Visual effects overlay
│   ├── DamageNumberOverlay.tsx
│   ├── ErrorBoundary.tsx
│   └── RaceIcon.tsx
├── modals/                 # Modal components
│   ├── ModalOverlay.tsx    # Modal container
│   ├── CardDetailModal.tsx
│   ├── CardListModal.tsx
│   ├── BattleLogModal.tsx
│   ├── CoinTossModal.tsx
│   ├── TrapPromptModal.tsx
│   ├── GraveSelectModal.tsx
│   ├── DeckSelectModal.tsx
│   ├── FusionConfirmModal.tsx
│   ├── GauntletTransitionModal.tsx
│   ├── HowToPlayModal.tsx
│   ├── OptionsModal.tsx
│   ├── ResultModal.tsx
│   ├── ConfirmModal.tsx
│   └── AlertModal.tsx
├── hooks/                  # Custom React hooks
│   ├── useAnimatedNumber.ts
│   ├── useAttackAnimation.ts
│   ├── useFusionAnimation.ts
│   ├── useAudio.ts
│   ├── useKeyboardShortcuts.ts
│   ├── useLongPress.ts
│   ├── useGamepad.ts
│   ├── useHapticFeedback.ts
│   ├── usePwaInstall.ts
│   └── useFocusTrap.ts
└── utils/                  # Utility functions
    ├── pack-logic.ts
    └── highlightCardText.tsx
```

---

## 6 Contexts

### 1. GameContext

Manages the active game session, engine instance, and duel state.

```typescript
interface GameCtx {
  gameState: GameState | null;           // Current game state from engine
  gameRef: React.MutableRefObject<GameEngineType | null>;
  logEntries: string[];                  // Battle log messages
  pendingDraw: number;                   // Cards drawn this turn (for animation)
  lastOpponent: OpponentConfig | null;   // Current opponent configuration
  startGame: (opponentConfig?: OpponentConfig | null) => void;
  clearPendingDraw: () => void;
}
```

**Key Responsibilities:**
- Creates and holds the `GameEngine` instance
- Implements `UICallbacks` interface for engine communication
- Handles duel checkpoint save/restore on page reload
- Manages campaign duel flow and gauntlet sequences
- Processes duel results and distributes rewards

### 2. ProgressionContext

Manages player progression data from localStorage.

```typescript
interface ProgressionCtx {
  coins: number;                         // Jade coins balance
  currencies: Record<string, number>;    // All currency types
  collection: CollectionEntry[];         // Owned cards with counts
  opponents: Record<number, OpponentRecord>;  // Win/loss records
  currentDeck: string[];                 // Current 40-card deck
  activeSlot: SlotId | null;             // Active save slot
  refresh: () => void;                   // Reload from localStorage
  setCurrentDeck: (ids: string[]) => void;
  loadDeck: () => void;                  // Load deck from Progression
}
```

### 3. ModalContext

Centralized modal state management with type-safe modal variants.

```typescript
type ModalState =
  | null
  | { type: 'card-detail'; card: CardData; fc?: FieldCard | null; ... }
  | { type: 'trap-prompt'; opts: PromptOptions; resolve: (v: boolean) => void }
  | { type: 'grave-select'; cards: CardData[]; resolve: (card: CardData) => void }
  | { type: 'deck-select'; cards: CardData[]; resolve: (card: CardData) => void }
  | { type: 'result'; resultType: 'victory' | 'defeat'; coinsEarned: number; ... }
  | { type: 'main-options' }
  | { type: 'battle-log' }
  | { type: 'coin-toss'; playerGoesFirst: boolean; resolve: () => void }
  | { type: 'gauntlet-transition'; duelIndex: number; totalDuels: number; ... }
  | { type: 'how-to-play' }
  | { type: 'fusion-confirm'; handCard: CardData; fieldCard: CardData; ... }
  | { type: 'confirm'; message: string; onConfirm: () => void }
  | { type: 'alert'; message: string };

interface ModalCtx {
  modal: ModalState;
  openModal: (m: ModalState) => void;
  closeModal: () => void;
}
```

### 4. ScreenContext

Manages screen routing with GSAP transitions and browser history integration.

```typescript
type Screen =
  | 'press-start'
  | 'title'
  | 'starter'
  | 'opponent'
  | 'game'
  | 'shop'
  | 'pack-opening'
  | 'collection'
  | 'deckbuilder'
  | 'save-point'
  | 'save-slots'
  | 'campaign'
  | 'dialogue'
  | 'duel-result';

interface ScreenCtx {
  screen: Screen;
  screenData: Record<string, unknown> | null;  // Data passed to screen
  setScreen: (s: Screen) => void;
  navigateTo: (s: Screen, data?: Record<string, unknown>) => void;
  navigateBack: () => void;  // Browser back button support
}
```

### 5. SelectionContext

Tracks complex selection states for game interactions.

```typescript
type SelMode =
  | 'hand'
  | 'attack'
  | 'fusion1'
  | 'spell-target'
  | 'field-spell-target'
  | 'grave-target'
  | 'trap-target'
  | 'equip-target'
  | 'place-monster'
  | 'place-spell'
  | null;

interface Selection {
  mode: SelMode;
  handIndex: number | null;
  attackerZone: number | null;
  fusion1: { handIndex: number } | null;
  fusionGroup: number[];                    // Multi-card fusion
  fusionGroupPreview: FusionChainResult | null;
  spellHandIndex: number | null;
  spellFieldZone: number | null;
  spellCard: CardData | null;
  trapFieldZone: number | null;
  equipHandIndex: number | null;
  equipCard: CardData | null;
  placeHandIndex: number | null;
  placePosition: 'atk' | 'def' | null;
  placeFaceDown: boolean;
  callback: ((card: CardData) => void) | null;
  hint: string;
}

interface SelectionCtx {
  sel: Selection;
  setSel: (s: Partial<Selection>) => void;
  resetSel: () => void;
}
```

### 6. CampaignContext

Manages campaign state, node unlocking, and duel preparation.

```typescript
interface CampaignCtx {
  campaignData: CampaignData;              // Loaded campaign structure
  progress: CampaignProgress;              // Completed nodes, current chapter
  isNodeUnlocked: (nodeId: string) => boolean;
  completeNode: (nodeId: string) => void;  // Mark node complete, give rewards
  hasCampaign: boolean;                    // Whether campaign data exists
  getOpponentForNode: (nodeId: string) => OpponentConfig | undefined;
  pendingDuel: PendingDuel | null;         // Duel about to start
  setPendingDuel: (d: PendingDuel | null) => void;
  refreshCampaignProgress: () => void;
}
```

---

## Screens (14)

| Screen | File | Purpose |
|--------|------|---------|
| **PressStart** | `PressStartScreen.tsx` | Initial "Press Any Key" screen |
| **Title** | `TitleScreen.tsx` | Main menu with New/Load/Options |
| **Starter** | `StarterScreen.tsx` | First-time starter deck selection |
| **Campaign** | `CampaignScreen.tsx` | Node-based campaign map |
| **Dialogue** | `DialogueScreen.tsx` | Story dialogue scenes |
| **Opponent** | `OpponentScreen.tsx` | Free duel opponent selection |
| **GameScreen** | `GameScreen.tsx` | Main duel gameplay |
| **DuelResult** | `DuelResultScreen.tsx` | Post-duel results and rewards |
| **Shop** | `ShopScreen.tsx` | Card pack purchasing |
| **PackOpening** | `PackOpeningScreen.tsx` | Card reveal animation |
| **Collection** | `CollectionScreen.tsx` | Card binder view |
| **Deckbuilder** | `DeckbuilderScreen.tsx` | 40-card deck construction |
| **SaveSlot** | `SaveSlotScreen.tsx` | Save slot selection/management |
| **SavePoint** | `SavePointScreen.tsx` | Hub menu (Campaign/Shop/Collection/etc) |

### Screen Flow

```
[Press Start]
    ↓
[Title] → [Save Slots] → [Starter] (first time only)
    ↓
[Save Point] ─┬─→ [Campaign] → [Dialogue] → [Game] → [Duel Result]
              ├─→ [Opponent] → [Game] → [Duel Result]
              ├─→ [Shop] → [Pack Opening]
              ├─→ [Collection]
              └─→ [Deckbuilder]
```

---

## GameScreen Sub-Components

The main duel screen (`GameScreen.tsx`) is composed of specialized sub-components in `src/react/screens/game/`:

### HandArea

Renders the player's hand with fusion selection and playability indicators.

```typescript
// Key features:
// - Displays cards in hand with small Card layout
// - Shows fusion group selection (multi-card fusion)
// - Handles long-press for fusion selection
// - Animates newly drawn cards
// - Shows fusion preview bar when 2+ cards selected
```

### PlayerField

Renders the player's monster and spell/trap zones.

```typescript
// 5 monster zones + 5 spell/trap zones
// Handles:
// - Monster placement and fusion with field
// - Spell/trap activation
// - Equipment targeting
// - Attack selection
// - Viewing own cards (right-click)
```

### OpponentField

Renders the opponent's field (face-down cards for hidden info).

```typescript
// Shows face-down cards for opponent's hidden information
// Handles attack target selection
// Allows viewing face-up opponent cards
```

### LPPanel

Life Points display with animated number transitions.

```typescript
interface Props {
  playerLp: number;
  oppLp: number;
  playerDeck: number;
  oppDeck: number;
}
// Uses useAnimatedNumber for smooth LP changes
```

### PhaseControls

Phase display and control buttons.

```typescript
// PhaseDivider - Shows current phase name and turn number
// DirectAttackButton - Appears when direct attack is possible
// NextPhaseButton - Advances phase or ends turn
```

---

## Components

### Card

The core card rendering component with multiple size variants.

```typescript
interface CardProps {
  card: CardData;
  fc?: FieldCard | null;        // Field card instance (for stat bonuses)
  dimmed?: boolean;             // Reduced opacity
  rotated?: boolean;            // Horizontal layout
  big?: boolean;                // Full size (for modals)
  small?: boolean;              // Compact size (for hand/field)
  extraClass?: string;
}
```

**Features:**
- Type-based styling (normal monster, effect monster, spell, trap, fusion)
- Attribute orb and race badge display
- Rarity indicator
- Effective ATK/DEF calculation from FieldCard bonuses
- Placeholder artwork based on card type

### HandCard

Interactive hand card with long-press support.

```typescript
interface HandCardProps {
  card: CardData;
  index: number;
  playable: boolean;            // Can be played this turn
  dimmed?: boolean;
  fusionable: boolean;          // Can fuse with selected card
  targetable: boolean;          // Is a valid fusion target
  fusionSelected?: boolean;     // In fusion group
  fusionIndex?: number;         // Order in fusion chain
  newlyDrawn: boolean;          // Just drawn this turn
  drawDelay: number;            // Stagger animation delay
  onClick: () => void;
  onLongPress?: () => void;     // For fusion selection
}
```

### FieldCardComponent

Monster card on the field with state indicators.

```typescript
interface FieldCardComponentProps {
  fc: FieldCard;
  owner: 'player' | 'opponent';
  zone: number;
  selected: boolean;            // Selected as attacker
  targetable: boolean;          // Can be targeted
  interactive: boolean;         // Can interact (owner only)
  canAttack: boolean;           // Ready to attack
  viewable?: boolean;           // Can be viewed
  onOwnClick?: () => void;
  onAttackerSelect?: () => void;
  onDefenderClick?: () => void;
  onViewClick?: () => void;
  onDetail?: () => void;
}
```

**Visual indicators:**
- Face-down vs face-up rendering
- Equipment badge (⚔)
- Passive ability icons (🛡️ indestructible, 🚫 cantBeAttacked, ✦ effectImmune, ⚡ piercing)
- Stat bonuses from field spells and equipment

### FieldSpellTrapComponent

Spell and trap cards on the field.

```typescript
interface FieldSpellTrapComponentProps {
  fst: FieldSpellTrap;
  owner: 'player' | 'opponent';
  zone: number;
  interactive: boolean;
  onClick?: () => void;
  onDetail?: () => void;
}
```

### HoverPreview

Global hover preview component showing full card details.

```typescript
// Positioned absolutely near cursor
// Shows full Card component + description + effect text
// Only on desktop (pointer: fine)
// Uses GSAP for smooth appear/disappear
```

### CardActivationOverlay

Fullscreen overlay for card activation animations.

```typescript
// Shows when spells/traps/effects activate
// Displays card big with effect text
// Skippable by clicking
// Uses GSAP timeline for entrance/exit
```

### VFXOverlay

Particle effects overlay for buffs, heals, and damage.

```typescript
// Effect types: 'buff', 'heal', 'damage'
// Anchored to specific field zones
// CSS animations with GSAP coordination
// Auto-cleanup after animation
```

---

## Custom Hooks

### useAnimatedNumber

Smooth number transitions using GSAP.

```typescript
function useAnimatedNumber(target: number, duration = 0.7): number;

// Usage in LPPanel:
const playerLpDisplay = useAnimatedNumber(playerLp);
// Returns interpolated value for display
```

### useAttackAnimation

Module-level imperative attack animation.

```typescript
// Called by GameContext's uiCallbacks.playAttackAnimation
export function playAttackAnim(
  atkOwner: Owner,
  atkZone: number,
  defOwner: Owner,
  defZone: number | null,  // null for direct attack
): Promise<void>;

// Creates DOM clone of attacker card
// Animates to defender position
// Spawns impact burst effect
// Returns promise for engine sync
```

### useFusionAnimation

Multi-card fusion sequence animation.

```typescript
export function playFusionAnim(
  owner: Owner,
  handIdx1: number,
  handIdx2: number,
  resultZone: number,
): Promise<void>;

export function playFusionChainAnim(
  owner: Owner,
  handIndices: number[],
  resultZone: number,
): Promise<void>;

// Clones all material cards
// Animates to center with rotation
// Glow phase with box-shadow
// Flash burst with particle effects
// Result card pops on field
```

### useAudio

Audio initialization and button click SFX.

```typescript
export function useAudioInit(): void;

// Call once in root component
// Initializes Web Audio API
// Handles tab visibility (suspend/resume)
// Plays sfx_button on all button clicks
```

### useKeyboardShortcuts

Global keyboard controls for gameplay.

```typescript
interface Params {
  gameState: GameState | null;
  gameRef: React.MutableRefObject<GameEngine | null>;
  resetSel: () => void;
  onHideDirect: () => void;
}

// Key bindings:
// B / E - Advance phase
// T - End turn
// Escape - Cancel selection
// ? - Toggle help overlay
```

### useLongPress

Touch-friendly long press detection.

```typescript
interface UseLongPressOptions {
  onLongPress: () => void;
  onClick?: () => void;
  threshold?: number;      // ms (default 400)
  moveThreshold?: number;  // px (default 10)
}

// Returns pointer event handlers
// Cancels on excessive movement
// Adds CSS class during press
```

---

## UICallbacks Interface

The bridge between engine and UI. Implemented in `GameContext` and passed to `GameEngine`.

```typescript
interface UICallbacks {
  // Core rendering
  render: (state: GameState) => void;
  log: (msg: string) => void;

  // User prompts
  prompt?: (opts: PromptOptions) => Promise<boolean>;
  showResult?: (result: 'victory' | 'defeat') => void;
  showActivation?: (card: CardData, text: string) => Promise<void> | void;

  // Animations
  playAttackAnimation?: (
    atkOwner: Owner,
    atkZone: number,
    defOwner: Owner,
    defZone: number | null,
  ) => Promise<void>;

  playFusionAnimation?: (
    owner: Owner,
    handIdx1: number,
    handIdx2: number,
    resultZone: number,
  ) => Promise<void>;

  playFusionChainAnimation?: (
    owner: Owner,
    handIndices: number[],
    resultZone: number,
  ) => Promise<void>;

  playVFX?: (
    type: 'buff' | 'heal' | 'damage',
    owner: Owner,
    zone?: number,
  ) => Promise<void>;

  // Audio
  playSfx?: (sfxId: string) => void;

  // Visual feedback
  showDamageNumber?: (amount: number, owner: Owner) => void;
  onDraw?: (owner: Owner, count: number) => void;

  // Selection prompts
  selectFromDeck?: (cards: CardData[]) => Promise<CardData>;
  showCoinToss?: (playerGoesFirst: boolean) => Promise<void>;

  // Duel lifecycle
  onDuelEnd?: (
    result: 'victory' | 'defeat',
    opponentId: number | null,
    stats: DuelStats,
  ) => void;
}
```

**Important:** All callback methods that trigger UI updates or animations must return Promises so the engine can await completion before continuing.

---

## State Management

### Data Flow Diagram

```
User Action
    ↓
React Component (onClick handler)
    ↓
GameContext.gameRef.current.method()
    ↓
GameEngine processes logic
    ↓
GameEngine calls uiCallbacks.render(newState)
    ↓
GameContext setGameState(newState)
    ↓
React re-renders components with new state
```

### Example: Monster Summon Flow

```typescript
// 1. User clicks hand card
function onHandCardClick(card: CardData, index: number) {
  // 2. Set selection mode
  setSel({
    mode: 'place-monster',
    placeHandIndex: index,
    placePosition: 'atk',
    placeFaceDown: false,
    hint: t('game.hint_place')
  });
}

// 3. User clicks empty monster zone
function onMonsterZoneSelect(zone: number) {
  const game = gameRef.current;
  if (!game) return;

  // 4. Call engine method
  game.summonMonster('player', handIndex, zone, 'atk');

  // 5. Engine processes:
  //    - Removes card from hand
  //    - Creates FieldCard on field
  //    - Triggers onSummon effects
  //    - Calls uiCallbacks.render(newState)

  // 6. Reset selection
  resetSel();
}

// 7. React re-renders with new gameState
//    - HandArea shows card removed
//    - PlayerField shows new monster
```

---

## Animation (GSAP)

GSAP is used for all animations. Three patterns are employed:

### 1. Component-Based Animations

```typescript
// HoverPreview.tsx
useEffect(() => {
  if (hover) {
    tween.current = gsap.to(el, {
      duration: 0.12,
      ease: 'power1.out',
      opacity: 1,
      y: 0,
    });
  } else {
    tween.current = gsap.to(el, {
      duration: 0.13,
      delay: 0.06,
      ease: 'power1.in',
      opacity: 0,
      y: 4,
    });
  }
}, [hover]);
```

### 2. Imperative Module-Level Animations

```typescript
// useAttackAnimation.ts - called by engine
export function playAttackAnim(...): Promise<void> {
  return new Promise(resolve => {
    const tl = gsap.timeline({ onComplete: resolve });
    tl.to(clone, { duration: 0.12, x: -dx * 0.14, scale: 1.18 });
    tl.to(clone, { duration: 0.16, x: dx, y: dy });
    // ...
  });
}
```

### 3. Screen Transitions

```typescript
// ScreenContext.tsx
gsap.to(overlay, {
  opacity: 1,
  duration: 0.18,
  ease: 'none',
  onComplete() {
    setScreen(newScreen);
    gsap.to(overlay, { opacity: 0, duration: 0.28 });
  },
});
```

### useAnimatedNumber Hook

```typescript
export function useAnimatedNumber(target: number, duration = 0.7): number {
  const [display, setDisplay] = useState(target);
  const obj = useRef({ val: target });

  useEffect(() => {
    const tw = gsap.to(obj.current, {
      val: target,
      duration,
      ease: 'power2.out',
      onUpdate() { setDisplay(Math.round(obj.current.val)); },
    });
    return () => { tw.kill(); };
  }, [target, duration]);

  return display;
}
```

---

## Internationalization (i18n)

### i18next Setup

```typescript
// src/i18n.ts
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from '../locales/de.json';
import en from '../locales/en.json';

export const i18nReady = i18next
  .use(initReactI18next)
  .init({
    lng: Progression.getSettings().lang ?? 'en',
    fallbackLng: 'en',
    resources: {
      de: { translation: de },
      en: { translation: en },
    },
    interpolation: { escapeValue: false },
  })
  .then(() => {
    document.documentElement.lang = i18next.language;
  });

export default i18next;
```

### Usage with useTranslation

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();

  return (
    <button>{t('game.btn_attack')}</button>
    // With interpolation:
    <span>{t('game.hint_selected', { name: card.name })}</span>
    // With default:
    <span>{t('custom.key', { defaultValue: 'Fallback text' })}</span>
  );
}
```

### Locale File Structure

```json
{
  "game": {
    "btn_attack": "Attack",
    "btn_end": "End Turn",
    "hint_selected": "Selected: {{name}}",
    "phase_main": "Main Phase",
    "phase_battle": "Battle Phase"
  },
  "card_action": {
    "summon": "Summon",
    "activate": "Activate",
    "fusion": "Fuse"
  }
}
```

---

## Examples

### Context Provider Tree

```typescript
// App.tsx provider nesting order (important!)
export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <ErrorBoundary>
        <ScreenProvider>        {/* 1. Screen routing */}
          <ProgressionProvider> {/* 2. Save data */}
            <CampaignProvider>  {/* 3. Campaign state */}
              <ModalProvider>   {/* 4. Modals */}
                <SelectionProvider> {/* 5. Selection state */}
                  <GameProvider>    {/* 6. Game engine */}
                    <GamepadProvider> {/* 7. Controller input */}
                      <Router />
                    </GamepadProvider>
                  </GameProvider>
                </SelectionProvider>
              </ModalProvider>
            </CampaignProvider>
          </ProgressionProvider>
        </ScreenProvider>
      </ErrorBoundary>
    </I18nextProvider>
  );
}
```

### Custom Hook Usage in Component

```typescript
// Using useAnimatedNumber for LP display
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber.js';

export function LPPanel({ playerLp, oppLp }: Props) {
  const playerLpDisplay = useAnimatedNumber(playerLp);
  const oppLpDisplay = useAnimatedNumber(oppLp);

  return (
    <div id="lp-panel">
      <span className="lp-value">{playerLpDisplay}</span>
      <span className="lp-value">{oppLpDisplay}</span>
    </div>
  );
}

// Using useLongPress for fusion selection
import { useLongPress } from '../../hooks/useLongPress.js';

export function HandCard({ card, onClick, onLongPress }: Props) {
  const longPressHandlers = useLongPress({
    onLongPress: () => onLongPress?.(),
    onClick,
    threshold: 400,
  });

  return (
    <div className="hand-card" {...longPressHandlers}>
      <Card card={card} small />
    </div>
  );
}
```

---

## Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^19.2.4 | UI framework |
| react-dom | ^19.2.4 | DOM renderer |
| react-i18next | ^16.6.6 | i18n integration |
| i18next | ^25.10.10 | Internationalization core |
| gsap | ^3.14.2 | Animation library |
| react-icons | ^5.6.0 | Icon components |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| typescript | ^6.0.2 | Type checking |
| vite | ^8.0.8 | Build tool |
| @vitejs/plugin-react | ^6.0.1 | React HMR |
| tailwindcss | ^4.2.2 | CSS framework |
| vitest | ^4.1.4 | Testing |
| @testing-library/react | ^16.3.2 | React testing utilities |

---

## Notes / Gotchas

### Context Provider Order Matters

Providers must be nested in dependency order:
1. `ScreenProvider` (no dependencies)
2. `ProgressionProvider` (no dependencies)
3. `CampaignProvider` (uses Progression)
4. `ModalProvider` (no dependencies)
5. `SelectionProvider` (no dependencies)
6. `GameProvider` (uses Modal, Selection, Progression, Screen, Campaign)
7. `GamepadProvider` (uses GameContext for callbacks)

### Engine Callbacks Must Be Async

All `UICallbacks` methods that trigger animations must return Promises:

```typescript
// Correct - returns Promise
playAttackAnimation: (ao, az, dO, dZ) => {
  return import('../hooks/useAttackAnimation.js')
    .then(m => m.playAttackAnim(ao, az, dO, dZ));
},

// Engine awaits this before continuing game logic
```

### Keyboard + Controller Support Simultaneous

Both input methods work together. The GamepadContext provides controller state while useKeyboardShortcuts handles keyboard input:

```typescript
// Keyboard shortcuts
const { showHelp } = useKeyboardShortcuts({ gameState, gameRef, resetSel });

// Controller support
const { connected, registerCallbacks } = useGamepadContext();
```

### HoverPreview Desktop Only

The hover preview only activates on devices with fine pointer support:

```typescript
const IS_TOUCH = window.matchMedia('(pointer: coarse)').matches;
// Hover preview skipped on touch devices
```

### VFX Overlay z-index

The VFXOverlay renders at `z-index: 500` to appear above cards but below modals:

```typescript
<div id="vfx-overlay" style={{ zIndex: 500, pointerEvents: 'none' }} />
```

### Animation Cleanup

Attack animations must be cleaned up when GameScreen unmounts:

```typescript
useEffect(() => () => cleanupAttackAnimations(), []);
```

### Save Checkpoint on BeforeUnload

GameContext saves duel state to localStorage on page refresh:

```typescript
window.addEventListener('beforeunload', () => {
  localStorage.setItem('tcg_duel_checkpoint', JSON.stringify(checkpoint));
});
```

### Lazy Loading for Screens

Non-critical screens are lazy-loaded to reduce initial bundle size:

```typescript
const CampaignScreen = lazy(() => import('./screens/CampaignScreen.js'));
const GameScreen = lazy(() => import('./screens/GameScreen.js'));
```

---

## See Also

- [Engine-Core](./engine-core.md) — Game engine implementation
- [Architecture](../.claude/architecture.md) — System architecture overview
- [Controller Support](./CONTROLLER_SUPPORT.md) — Gamepad API details
