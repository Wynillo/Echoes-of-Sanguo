# UX Audit: Echoes of Sanguo

**Date:** 2026-03-30
**Scope:** Full application — accessibility, i18n, game flow, responsive design, visual consistency, error handling, progressive enhancement
**Overall Accessibility Grade: D+**

The game has strong responsive CSS and a solid `prefers-reduced-motion` implementation, but accessibility is otherwise absent. Zero ARIA labels exist across the entire React codebase.

---

## P0 — Critical (Game-breaking / Severely Degrading)

### A1. Zero ARIA Labels Across Entire Codebase
- **Files:** All files in `js/react/screens/`, `js/react/components/`, `js/react/modals/`
- **Impact:** Screen reader users cannot use the interface at all. Interactive elements (buttons, cards, modals, phase controls) have no accessible names.
- **Fix:** Add `aria-label` to all icon-only buttons (options gear, close X, view icons, carousel arrows). Add `role="dialog"` + `aria-modal="true"` to modals. Add `aria-live="polite"` regions for turn changes, phase transitions, battle results.

### A2. HTML `lang` Hardcoded to `"de"`
- **File:** `index.html`
- **Impact:** Screen readers always announce content in German regardless of user's language setting. Breaks spell-checking, font fallbacks, and assistive technology language detection.
- **Fix:** Dynamically set `document.documentElement.lang` when language changes via `i18n.changeLanguage()`.

### A3. Color Contrast Failure — `--text-dim`
- **File:** `css/style.css`
- **Impact:** `#5a7a60` on `#060e0a` = **2.8:1 ratio** (WCAG AA requires 4.5:1). Used for phase labels, deck counts, dimmed card text. Low-vision users cannot read this text.
- **Fix:** Change `--text-dim` to `#7a9a80` or lighter (~4.5:1 ratio).

### A4. Silent Save Data Wipe on Version Migration
- **File:** `js/progression.ts` (lines 96-113)
- **Impact:** When migrating v1 to v2 saves, collection is set to `[]` and deck is removed silently. Player loses all progress with zero warning. Backup is created but player doesn't know it exists.
- **Fix:** Show migration warning modal before wiping. Expose restore-from-backup option in UI.

### A5. No Focus Trap in Non-Dismissible Modals
- **Files:** `js/react/modals/CoinTossModal.tsx`, `TrapPromptModal.tsx`, `GauntletTransitionModal.tsx`
- **Impact:** Keyboard users can Tab outside modal into background content. Non-dismissible modals (coin toss, trap prompt) don't prevent this.
- **Fix:** Implement focus trap (loop Tab within modal). Return focus to trigger element on close.

### A6. No Tutorial or Onboarding
- **Files:** All game screens
- **Impact:** New players face unexplained phases, fusion mechanics, trap windows, equipment requirements, and zone labels with zero guidance. Steep learning curve causes immediate drop-off.
- **Fix:** Add guided first duel with contextual tooltips. Add "How to Play" accessible from main menu.

---

## P1 — High (Significant Pain Points)

### B1. Card Descriptions Not Localized (200+ cards, 39 opponents)
- **Files:** `public/base.tcg-src/locales/cards_description.json`, `opponents_description.json`
- **Impact:** German-language players see English card descriptions and opponent flavor text. Breaks immersion for ~50% of target audience.
- **Fix:** Create German translations for all card and opponent descriptions.

### B2. No Confirmation for Destructive In-Game Actions
- **Files:** `js/engine.ts` (attack method ~line 814), `js/react/screens/DeckbuilderScreen.tsx`
- **Impact:** Attacks into face-down cards (risky), fusion (permanent card consumption), deck save (overwrites previous), and card removal (instant double-click) all execute without confirmation or undo.
- **Fix:** Add confirmation dialog for fusion and face-down attacks. Add undo for deck edits. Add overwrite warning for deck save.

### B3. No AI Turn Feedback
- **Files:** `js/ai-orchestrator.ts`, `js/react/screens/game/`
- **Impact:** AI turns take 3-5 seconds of animation delays with no "thinking" indicator. Players can't tell if game is frozen or processing. No explanation of AI decisions (fusion chains happen silently).
- **Fix:** Add "Opponent is thinking..." indicator. Show "FUSION!" announcement when AI fuses. Add turn phase progress (Draw → Main → Battle → End).

### B4. Gauntlet Mode Has No Pre-Warning
- **Files:** `js/campaign.ts`, `js/react/screens/CampaignScreen.tsx`
- **Impact:** Gauntlet nodes commit player to 3 consecutive fights without saving. Player discovers this mid-gauntlet with no way out.
- **Fix:** Show pre-duel warning modal ("Gauntlet: 3 consecutive duels. You can't save between fights."). Show progress indicator during gauntlet ("Opponent 2/3").

### B5. Locked Campaign Nodes Don't Explain Unlock Conditions
- **Files:** `js/campaign-store.ts` (lines 21-46), `js/react/screens/CampaignScreen.tsx`
- **Impact:** Locked nodes show "LOCKED" badge but no information about what's needed. Complex unlock conditions (win count, chapter completion) are opaque.
- **Fix:** Add tooltip on locked nodes: "Win 5 more duels to unlock" / "Complete Chapter 1 first".

### B6. localStorage Save Failures Silently Swallowed
- **File:** `js/progression.ts` (lines 50-59)
- **Impact:** If localStorage quota is exceeded or private browsing blocks storage, saves fail silently. Player can lose hours of progress.
- **Fix:** Show warning toast on save failure. Monitor storage quota. Suggest recovery actions.

### B7. Battle Log Hidden by Default
- **File:** `js/engine.ts` (lines 215-222), `css/style.css`
- **Impact:** Battle log exists but is `display: none`. Players can't review action history to understand AI decisions or debug their plays.
- **Fix:** Add toggle button to show/hide battle log. Make it accessible on all devices.

### B8. TCG Load Failure Shows Generic Error
- **File:** `js/main.ts` (lines 6-23)
- **Impact:** "Failed to load card data" with no recovery steps. Font loading can also cause blank white screen if CDN is slow (no timeout fallback).
- **Fix:** Add retry button, "Check your internet connection" message, and 3-second font loading timeout with system font fallback.

---

## P2 — Medium (Noticeable Friction)

### C1. Font Sizes Too Small for Accessibility
- **File:** `css/style.css`
- **Impact:** Battle log at 0.6875rem (11px), card descriptions at 0.75rem (12px). Hard to read on mobile and for vision-impaired users.
- **Fix:** Increase minimum font size to 0.8125rem (13px). Add font size control in options.

### C2. Grave Icons Below Touch Target Minimum
- **File:** `css/style.css`
- **Impact:** Grave icons are 26x26px on portrait mode. Below the 44px minimum recommended touch target size.
- **Fix:** Increase to 36x36px minimum, or expand hit area with padding.

### C3. DeckbuilderScreen Table Overflows on Mobile
- **File:** `js/react/screens/DeckbuilderScreen.tsx`
- **Impact:** 9-column table view, double-click to add/remove cards (not touch-friendly), filters consume 25% of mobile screen height.
- **Fix:** Hide non-essential columns on mobile. Replace double-click with tap + action button. Collapse filters behind toggle.

### C4. Inconsistent Button Styles (5+ Classes)
- **Files:** `css/style.css`, all screen components
- **Impact:** `.btn-primary`, `.btn-secondary`, `.btn-menu`, `.btn-cancel`, `.menu-action-btn` all have slightly different styling. No consistent visual language for disabled states (some use `opacity: 0.4`, some use browser defaults).
- **Fix:** Consolidate to 3 button variants (primary, secondary, danger) with consistent disabled treatment.

### C5. No Screen Transition Animations
- **Files:** `js/react/App.tsx`, `css/style.css`
- **Impact:** `#screen-transition-overlay` exists but is never animated. Screens pop in/out instantly, creating jarring experience.
- **Fix:** Add 200ms fade transition between major screens.

### C6. Modal Enter/Exit Has No Animation
- **Files:** All modals in `js/react/modals/`
- **Impact:** Modals appear/disappear instantly. CardDetailModal pops in with no easing. Feels unpolished.
- **Fix:** Add 150ms fade-in/scale-up animation for modal entrance, fade-out on exit.

### C7. Phase Controls Change Label at Same Position
- **File:** `js/react/screens/game/PhaseControls.tsx`
- **Impact:** Button cycles BATTLE → NEXT → END at the same position. Player can accidentally advance phases by rapid-clicking.
- **Fix:** Add brief cooldown after phase change, or separate buttons for each action.

### C8. Pack Contents / Drop Rates Not Shown in Shop
- **Files:** `js/shop-data.ts`, `js/react/screens/ShopScreen.tsx`
- **Impact:** Players can't see which cards are in a pack, rarity distribution, or drop rates before purchasing. "Guaranteed rare" is vague.
- **Fix:** Add pack preview showing all possible cards with rarity breakdown. Show drop rate percentages.

### C9. No `prefers-color-scheme` Support
- **File:** `css/style.css`
- **Impact:** Only dark theme exists. Users who prefer light backgrounds see dark theme with no alternative.
- **Fix:** Consider optional light theme, or at minimum acknowledge the limitation.

### C10. Campaign Has No Chapter Progress Indicator
- **File:** `js/react/screens/CampaignScreen.tsx`
- **Impact:** No "5/7 duels complete" indicator. No hint that more chapters exist. Story node completion has no visual feedback.
- **Fix:** Add chapter progress bar. Show "Chapter 2 unlocks after completing all duels" hint. Add completion animation for story nodes.

### C11. ShopScreen Carousel Has No Swipe Hint
- **File:** `js/react/screens/ShopScreen.tsx`
- **Impact:** Swipe detection requires >50px drag but no visual indicator that carousel is swipeable. No feedback during drag.
- **Fix:** Add subtle swipe indicator (dots, arrows, or peek of next item).

### C12. Passive Monster Abilities Not Visually Indicated
- **Files:** `js/field.ts` (lines 22-30), `js/react/components/FieldCardComponent.tsx`
- **Impact:** `indestructible`, `cantBeAttacked` flags exist but no visual indicator on field. Player attacks protected monster and nothing happens — seems like a bug.
- **Fix:** Add shield/lock icon overlay on protected monsters. Add tooltip explaining passive ability.

### C13. No Semantic HTML for Interactive Elements
- **Files:** `js/react/screens/CampaignScreen.tsx` (nodes are `<div>` with onClick), various components
- **Impact:** Interactive `<div>` elements lack button semantics. Screen readers don't announce them as interactive.
- **Fix:** Use `<button>` for all clickable elements. Add `role="button"` where `<button>` isn't possible.

---

## P3 — Low (Polish Items)

### D1. No Skip Links
- **File:** `index.html`
- **Fix:** Add hidden "Skip to game field" link that appears on focus.

### D2. Keyword Highlighting Uses `<span>` Not `<strong>`
- **File:** `js/react/utils/highlightCardText.tsx`
- **Fix:** Use `<strong class="kw-effect">` for screen reader emphasis.

### D3. No Mute Button (Only Volume Sliders)
- **File:** `js/react/modals/OptionsModal.tsx`
- **Fix:** Add master mute toggle that remembers previous volume levels.

### D4. Volume Changes Not Previewed
- **File:** `js/react/modals/OptionsModal.tsx`
- **Fix:** Play preview sound when slider moves.

### D5. No Pluralization in i18n
- **File:** `js/i18n.ts`
- **Fix:** Enable i18next plural resources for "1 card" vs "3 cards".

### D6. ATK/DEF Bonuses Not Broken Down
- **Files:** `js/field.ts`, `js/react/components/FieldCardComponent.tsx`
- **Fix:** Add tooltip: "Base 2000 + Equipment +100 + Field Spell +200 = 2300".

### D7. Zone Labels Cryptic ("M", "Z/F")
- **File:** Game screen components
- **Fix:** Use full labels or add tooltip: "Monster Zone", "Spell/Trap Zone".

### D8. Equipment Requirements Not Shown in Hand
- **File:** `js/react/screens/game/HandArea.tsx`
- **Fix:** Show dim indicator when card can't equip to any field monster.

### D9. Keyboard Shortcuts Undiscoverable
- **File:** `js/react/hooks/useKeyboardShortcuts.ts`
- **Fix:** Add keyboard shortcut help panel (accessible via "?" key).

### D10. No Node Reward Preview in Campaign
- **File:** `js/react/screens/CampaignScreen.tsx`
- **Fix:** Show reward preview on hover/tap before entering node.

### D11. Missing PWA Meta Tags
- **File:** `index.html`
- **Fix:** Add `theme-color`, `description`, `og:title`, `og:image`, `apple-touch-icon`, and proper PWA manifest.

### D12. `ErrorBoundary` Shows No Error Message
- **File:** `js/react/components/ErrorBoundary.tsx`
- **Fix:** Show user-friendly error message with "Return to Title" button instead of blank screen.

### D13. No Long-Press Visual Feedback
- **File:** `js/react/hooks/useLongPress.ts`
- **Fix:** Add progressive fill/color change during 400ms hold to indicate gesture is registering.

### D14. Card Selection States Use Different Visual Languages
- **Files:** Various game components
- **Impact:** Fusion group (`.chain-selected`), attack (`.selected`), spell target (`.targetable`) all look different with no consistent visual pattern.
- **Fix:** Unify selection visual language with consistent glow color + icon overlay.

### D15. `SavePointScreen` Allows Duplicate Save Clicks
- **File:** `js/react/screens/SavePointScreen.tsx`
- **Fix:** Disable button + show spinner during save operation.

### D16. Language Switch May Not Update All Cached Strings
- **File:** `js/i18n.ts`, `js/react/modals/OptionsModal.tsx`
- **Fix:** Force full re-render on `i18n.changeLanguage()`.

### D17. Inconsistent Typography Scale
- **File:** `css/style.css`
- **Impact:** Font sizes range from 0.6875rem to 1rem with no clear scale system.
- **Fix:** Define a type scale (e.g., 0.75, 0.875, 1, 1.125, 1.25rem) and apply consistently.

---

## Bright Spots (What's Done Well)

- `prefers-reduced-motion` is **excellently implemented** — kills all animations globally
- Responsive CSS is sophisticated with `pointer: coarse`, `safe-area-inset`, and dynamic `calc()` sizing
- EN/DE translation files are structurally identical (458 lines each)
- CSS variable system is well-organized with 12+ theme tokens
- Touch-action manipulation is properly set on interactive elements
- `viewport-fit: cover` handles notches correctly

---

## Issue Summary

| Priority | Count | Worst Offenders |
|----------|-------|-----------------|
| **P0 Critical** | 6 | Zero ARIA labels, hardcoded `lang="de"`, contrast failure 2.8:1, silent save wipe, no focus traps, no onboarding |
| **P1 High** | 8 | Missing DE translations (200+ cards), no destructive action confirmations, no AI feedback, gauntlet has no warning, silent save failures |
| **P2 Medium** | 13 | Tiny fonts (11px), small touch targets (26px), table overflow on mobile, 5+ inconsistent button styles, no screen transitions, no pack drop rates |
| **P3 Low** | 17 | No skip links, no mute button, cryptic zone labels, undiscoverable keyboard shortcuts, no PWA support |

**Total: 44 issues identified**

---

## Verification

For each fix category:
- **Accessibility:** Run axe-core audit via browser devtools. Test with VoiceOver/NVDA. Check WCAG contrast ratios with WebAIM tool.
- **i18n:** Switch language to DE and verify all strings render in German including card descriptions.
- **Responsive:** Test on 360px, 540px, 768px, 1024px, 1440px viewports. Use Chrome device emulation.
- **Interactions:** Test all confirmation dialogs trigger before destructive actions. Verify focus trap in modals with Tab key.
- **Performance:** Run Lighthouse audit. Check for layout shifts during screen transitions.
- **E2E:** Run `npm run test:e2e` after changes to verify no regressions.
