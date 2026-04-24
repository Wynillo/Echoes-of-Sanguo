// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import JSZip from 'jszip';
import { 
  loadAndApplyTcg, 
  unloadModCompletely, 
  getLoadedMods,
  verifyModIntegrity,
} from '../src/tcg-bridge.js';
import { 
  CARD_DB, 
  FUSION_RECIPES, 
  FUSION_FORMULAS, 
  OPPONENT_CONFIGS, 
  STARTER_DECKS,
  PLAYER_DECK_IDS,
  OPPONENT_DECK_IDS,
} from '../src/cards.js';
import { SHOP_DATA } from '../src/shop-data.js';
import { CAMPAIGN_DATA } from '../src/campaign-store.js';
import { GAME_RULES } from '../src/rules.js';
import { TYPE_META } from '../src/type-metadata.js';

// ── Helpers ─────────────────────────────────────────────────

function captureStateSnapshot() {
  return {
    cardCount: Object.keys(CARD_DB).length,
    recipeCount: FUSION_RECIPES.length,
    formulaCount: FUSION_FORMULAS.length,
    opponentCount: OPPONENT_CONFIGS.length,
    starterDeckKeys: Object.keys(STARTER_DECKS).sort(),
    playerDeckIds: [...PLAYER_DECK_IDS],
    opponentDeckIds: [...OPPONENT_DECK_IDS],
    shopPacks: SHOP_DATA.packs.length,
    shopCurrencies: SHOP_DATA.currencies.length,
    campaignChapters: CAMPAIGN_DATA.chapters.length,
    rulesStartingLp: GAME_RULES.STARTING_LP,
    typeMetaRaces: TYPE_META.races.length,
    typeMetaAttributes: TYPE_META.attributes.length,
  };
}

async function buildTestMod(overrides = {}) {
  const zip = new JSZip();
  
  // Cards
  if (overrides.cards !== null) {
    zip.file('cards.json', JSON.stringify(overrides.cards ?? [
      { id: 9001, type: 1, level: 3, rarity: 1, atk: 1500, def: 1000, attribute: 1, race: 1, name: 'Test Card 1' },
    ]));
  }
  
  // Images folder (required)
  zip.folder('img');
  
  // Fusion recipes
  if (overrides.fusionRecipes) {
    zip.file('fusion_recipes.json', JSON.stringify(overrides.fusionRecipes));
  }
  
  // Fusion formulas
  if (overrides.fusionFormulas) {
    zip.file('fusion_formulas.json', JSON.stringify({ formulas: overrides.fusionFormulas }));
  }
  
  // Opponents
  if (overrides.opponents) {
    zip.file('opponents.json', JSON.stringify(overrides.opponents));
  }
  
  // Starter decks
  if (overrides.starterDecks) {
    zip.file('starterDecks.json', JSON.stringify(overrides.starterDecks));
  }
  
  // Shop data
  if (overrides.shopData) {
    zip.file('shop.json', JSON.stringify(overrides.shopData));
  }
  
  // Campaign data
  if (overrides.campaignData) {
    zip.file('campaign.json', JSON.stringify(overrides.campaignData));
  }
  
  // Rules
  if (overrides.rules) {
    zip.file('rules.json', JSON.stringify(overrides.rules));
  }
  
  // Type metadata
  if (overrides.typeMeta) {
    zip.file('type_meta.json', JSON.stringify(overrides.typeMeta));
  }
  
  return zip.generateAsync({ type: 'arraybuffer' });
}

function clearState() {
  // Clear CARD_DB
  for (const key of Object.keys(CARD_DB)) delete CARD_DB[key];
  
  // Clear arrays
  FUSION_RECIPES.length = 0;
  FUSION_FORMULAS.length = 0;
  OPPONENT_CONFIGS.length = 0;
  PLAYER_DECK_IDS.length = 0;
  OPPONENT_DECK_IDS.length = 0;
  
  // Clear starter decks
  for (const key of Object.keys(STARTER_DECKS)) delete STARTER_DECKS[key];
  
  // Reset shop data
  SHOP_DATA.packs = [];
  SHOP_DATA.currencies = [];
  SHOP_DATA.backgrounds = {};
  
  // Reset campaign data
  CAMPAIGN_DATA.chapters = [];
}

// ── Tests ─────────────────────────────────────────────────

describe('mod-unloading', () => {
  beforeEach(() => {
    clearState();
  });
  
  describe('unloadModCompletely()', () => {
    it('removes cards added by mod', async () => {
      const buf = await buildTestMod({ cards: [
        { id: 9001, type: 1, level: 3, rarity: 1, atk: 1500, def: 1000 },
        { id: 9002, type: 1, level: 4, rarity: 2, atk: 2000, def: 1500 },
      ]});
      
      await loadAndApplyTcg(buf);
      expect(Object.keys(CARD_DB).length).toBe(2);
      
      const success = unloadModCompletely('<ArrayBuffer>');
      expect(success).toBe(true);
      expect(Object.keys(CARD_DB).length).toBe(0);
    });
    
    it('removes opponents added by mod', async () => {
      const buf = await buildTestMod({
        opponents: [
          { id: 100, deckIds: [[9001]], coinsWin: 100 },
        ],
        cards: [{ id: 9001, type: 1, level: 3, rarity: 1, atk: 1500, def: 1000 }],
      });
      
      await loadAndApplyTcg(buf);
      expect(OPPONENT_CONFIGS.length).toBe(1);
      
      unloadModCompletely('<ArrayBuffer>');
      expect(OPPONENT_CONFIGS.length).toBe(0);
    });
    
    it('removes fusion recipes added by mod', async () => {
      const buf = await buildTestMod({
        fusionRecipes: [
          { materials: [1, 2], result: 3 },
        ],
        cards: [
          { id: 1, type: 1, level: 3, rarity: 1, atk: 1000, def: 800 },
          { id: 2, type: 1, level: 3, rarity: 1, atk: 1000, def: 800 },
          { id: 3, type: 2, level: 5, rarity: 4, atk: 2500, def: 2000 },
        ],
      });
      
      const beforeState = captureStateSnapshot();
      await loadAndApplyTcg(buf);
      expect(FUSION_RECIPES.length).toBeGreaterThan(beforeState.recipeCount);
      
      unloadModCompletely('<ArrayBuffer>');
      expect(FUSION_RECIPES.length).toBe(beforeState.recipeCount);
    });
    
    it('removes fusion formulas added by mod', async () => {
      const buf = await buildTestMod({
        fusionFormulas: [
          { id: 'test', comboType: 'race+race', operand1: 1, operand2: 2, priority: 10, resultPool: [3] },
        ],
        cards: [
          { id: 1, type: 1, level: 3, rarity: 1, atk: 1000, def: 800, race: 1 },
          { id: 2, type: 1, level: 3, rarity: 1, atk: 1000, def: 800, race: 2 },
          { id: 3, type: 2, level: 5, rarity: 4, atk: 2500, def: 2000 },
        ],
      });
      
      const beforeState = captureStateSnapshot();
      await loadAndApplyTcg(buf);
      expect(FUSION_FORMULAS.length).toBeGreaterThan(beforeState.formulaCount);
      
      unloadModCompletely('<ArrayBuffer>');
      expect(FUSION_FORMULAS.length).toBe(beforeState.formulaCount);
    });
    
    it('restores STARTER_DECKS to pre-mod state', async () => {
      // Set initial starter deck
      STARTER_DECKS[1] = ['1', '2', '3'];
      
      const buf = await buildTestMod({
        starterDecks: { '99': [9001, 9002] },
        fusionRecipes: [], // triggers starter deck loading
        cards: [
          { id: 9001, type: 1, level: 3, rarity: 1, atk: 1500, def: 1000 },
          { id: 9002, type: 1, level: 3, rarity: 1, atk: 1500, def: 1000 },
        ],
      });
      
      expect(STARTER_DECKS[99]).toBeUndefined();
      await loadAndApplyTcg(buf);
      expect(STARTER_DECKS[99]).toBeDefined();
      
      unloadModCompletely('<ArrayBuffer>');
      expect(STARTER_DECKS[99]).toBeUndefined();
      expect(STARTER_DECKS[1]).toEqual(['1', '2', '3']);
    });
    
    it('restores PLAYER_DECK_IDS and OPPONENT_DECK_IDS', async () => {
      PLAYER_DECK_IDS.push('1', '2', '3');
      OPPONENT_DECK_IDS.push('4', '5', '6');
      
      const buf = await buildTestMod({
        starterDecks: { '1': [9001] },
        fusionRecipes: [],
        cards: [{ id: 9001, type: 1, level: 3, rarity: 1, atk: 1500, def: 1000 }],
      });
      
      const beforePlayerDecks = [...PLAYER_DECK_IDS];
      const beforeOpponentDecks = [...OPPONENT_DECK_IDS];
      
      await loadAndApplyTcg(buf);
      
      unloadModCompletely('<ArrayBuffer>');
      expect(PLAYER_DECK_IDS).toEqual(beforePlayerDecks);
      expect(OPPONENT_DECK_IDS).toEqual(beforeOpponentDecks);
    });
    
    it('restores SHOP_DATA to pre-mod state', async () => {
      SHOP_DATA.packs = [{ id: 'base_pack', name: 'Base Pack', desc: 'Base', price: 100, icon: '📦', color: '#fff', slots: [] }];
      SHOP_DATA.currencies = [{ id: 'coins', nameKey: 'common.coins', icon: '♦' }];
      
      const buf = await buildTestMod({
        shopData: {
          packs: [{ id: 'mod_pack', name: 'Mod Pack', desc: 'Mod', price: 200, icon: '🎁', color: '#f0f', slots: [] }],
        },
        cards: [{ id: 9001, type: 1, level: 3, rarity: 1, atk: 1500, def: 1000 }],
      });
      
      const beforePackCount = SHOP_DATA.packs.length;
      await loadAndApplyTcg(buf);
      expect(SHOP_DATA.packs.length).toBeGreaterThan(beforePackCount);
      
      unloadModCompletely('<ArrayBuffer>');
      expect(SHOP_DATA.packs.length).toBe(beforePackCount);
      expect(SHOP_DATA.packs[0].id).toBe('base_pack');
    });
    
    it('restores CAMPAIGN_DATA to pre-mod state', async () => {
      CAMPAIGN_DATA.chapters = [{ id: 'chapter1', nodes: [] }];
      
      const buf = await buildTestMod({
        campaignData: {
          chapters: [{ id: 'mod_chapter', nodes: [{ id: 'node1', type: 'duel' }] }],
        },
        cards: [{ id: 9001, type: 1, level: 3, rarity: 1, atk: 1500, def: 1000 }],
      });
      
      const beforeChapterCount = CAMPAIGN_DATA.chapters.length;
      await loadAndApplyTcg(buf);
      expect(CAMPAIGN_DATA.chapters.length).toBeGreaterThan(beforeChapterCount);
      
      unloadModCompletely('<ArrayBuffer>');
      expect(CAMPAIGN_DATA.chapters.length).toBe(beforeChapterCount);
      expect(CAMPAIGN_DATA.chapters[0].id).toBe('chapter1');
    });
    
    it('restores GAME_RULES to pre-mod state', async () => {
      const beforeRules = GAME_RULES.STARTING_LP;
      
      const buf = await buildTestMod({
        rules: { STARTING_LP: 4000 },
        cards: [{ id: 9001, type: 1, level: 3, rarity: 1, atk: 1500, def: 1000 }],
      });
      
      expect(GAME_RULES.STARTING_LP).toBe(8000);
      await loadAndApplyTcg(buf);
      expect(GAME_RULES.STARTING_LP).toBe(4000);
      
      unloadModCompletely('<ArrayBuffer>');
      expect(GAME_RULES.STARTING_LP).toBe(beforeRules);
    });
    
    it('handles multiple mods loaded sequentially', async () => {
      // Load first mod
      const buf1 = await buildTestMod({
        cards: [{ id: 9001, type: 1, level: 3, rarity: 1, atk: 1500, def: 1000, name: 'Mod1 Card' }],
      });
      await loadAndApplyTcg(buf1);
      expect(Object.keys(CARD_DB)).toContain('9001');
      
      // Load second mod
      const buf2 = await buildTestMod({
        cards: [{ id: 9002, type: 1, level: 3, rarity: 1, atk: 1500, def: 1000, name: 'Mod2 Card' }],
      });
      await loadAndApplyTcg(buf2);
      expect(Object.keys(CARD_DB)).toContain('9001');
      expect(Object.keys(CARD_DB)).toContain('9002');
      
      // Unload first mod - second mod should remain
      unloadModCompletely('<ArrayBuffer>');
      expect(Object.keys(CARD_DB)).not.toContain('9001');
      expect(Object.keys(CARD_DB)).toContain('9002');
      
      // Unload second mod
      unloadModCompletely('<ArrayBuffer>');
      expect(Object.keys(CARD_DB).length).toBe(0);
    });
    
    it('returns false for unknown mod source', () => {
      const success = unloadModCompletely('nonexistent-source');
      expect(success).toBe(false);
    });
    
    it('clears mod from loadedMods list', async () => {
      const buf = await buildTestMod({
        cards: [{ id: 9001, type: 1, level: 3, rarity: 1, atk: 1500, def: 1000 }],
      });
      
      await loadAndApplyTcg(buf);
      expect(getLoadedMods().length).toBe(1);
      
      unloadModCompletely('<ArrayBuffer>');
      expect(getLoadedMods().length).toBe(0);
    });
  });
});
