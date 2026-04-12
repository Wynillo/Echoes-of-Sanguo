// src/react/CraftingScreen.tsx
import { useState, useMemo } from 'react';
import { CARD_DB } from '../cards.js';
import { GAME_RULES } from '../rules.js';
import { Progression } from '../progression.js';
import { EFFECT_SOURCES } from '../effect-items.js';
import { craftEffectMonster } from '../crafting.js';
import { getCurrency } from '../currencies.js';
import type { CardData } from '../types.js';
import './CraftingScreen.css';

export function CraftingScreen() {
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const config = useMemo(() => ({
    enabled: GAME_RULES.craftingEnabled,
    currency: GAME_RULES.craftingCurrency,
    cost: GAME_RULES.craftingCost,
  }), []);

  const normalMonsters = useMemo(() => {
    const collection = Progression.getCollection();
    return collection
      .filter(e => e.count > 0)
      .map(e => CARD_DB[e.id])
      .filter((c): c is CardData => !!c && c.type === 1 && !c.effect && !c.effects);
  }, [success]);

  const effectItems = useMemo(() => {
    const items = Progression.getEffectItems();
    return items.filter(e => e.count > 0).map(e => ({
      ...EFFECT_SOURCES[e.id],
      count: e.count,
    })).filter(e => e.id);
  }, [success]);

  const canCraft = selectedBase && selectedEffect && config.enabled;

  const handleCraft = () => {
    if (!selectedBase || !selectedEffect) return;
    
    setError(null);
    const result = craftEffectMonster(selectedBase, selectedEffect);
    
    if (result.success) {
      setSuccess(s => !s);
      setSelectedBase(null);
      setSelectedEffect(null);
    } else {
      setError(result.error || 'Unknown error');
    }
  };

  if (!config.enabled) {
    return (
      <div className="crafting-disabled">
        <p>Crafting is not available.</p>
      </div>
    );
  }

  return (
    <div className="crafting-screen">
      <div className="crafting-panels">
        <div className="crafting-panel">
          <h3>Base Monsters</h3>
          <div className="crafting-list">
            {normalMonsters.map(card => (
              <div
                key={card.id}
                className={`crafting-item ${selectedBase === card.id ? 'selected' : ''}`}
                onClick={() => setSelectedBase(card.id)}
              >
                <span className="crafting-item-name">{card.name}</span>
                <span className="crafting-item-count">x{Progression.cardCount(card.id)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="crafting-panel">
          <h3>Effect Items</h3>
          <div className="crafting-list">
            {effectItems.map(item => (
              <div
                key={item.id}
                className={`crafting-item ${selectedEffect === item.id ? 'selected' : ''}`}
                onClick={() => setSelectedEffect(item.id)}
              >
                <span className="crafting-item-name">{item.name}</span>
                <span className="crafting-item-count">x{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="crafting-preview">
        <h3>Preview</h3>
        {selectedBase && selectedEffect && (
          <div className="preview-card">
            <p><strong>{CARD_DB[selectedBase]?.name}</strong> with effect</p>
          </div>
        )}
        
        {config.cost > 0 && config.currency && (
          <p className="crafting-cost">
            Cost: {config.cost} {config.currency}
          </p>
        )}

        {error && <p className="crafting-error">{error}</p>}

        <button
          className="crafting-button"
          disabled={!canCraft}
          onClick={handleCraft}
        >
          Craft
        </button>
      </div>
    </div>
  );
}
