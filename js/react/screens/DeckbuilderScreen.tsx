import { useState, useCallback } from 'react';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useModal }        from '../contexts/ModalContext.js';
import { CARD_DB }         from '../../cards.js';
import { Progression }     from '../../progression.js';
import { Card }            from '../components/Card.js';
import { attachHover }     from '../components/HoverPreview.js';
import type { CardData }   from '../../types.js';

const MAX_DECK = 40;
const MAX_COPIES = 3;

const FILTERS = [
  { key: 'all', label: 'Alle' },
  { key: 'normal', label: 'Normal' },
  { key: 'effect', label: 'Effekt' },
  { key: 'spell', label: 'Zauber' },
  { key: 'trap', label: 'Falle' },
];

export default function DeckbuilderScreen() {
  const { navigateTo }                        = useScreen();
  const { collection, currentDeck, setCurrentDeck, loadDeck } = useProgression();
  const { openModal }                         = useModal();
  const [filter, setFilter]                   = useState('all');
  const [panelExpanded, setPanelExpanded]     = useState(false);
  const [toast, setToast]                     = useState(false);

  const ownedIds = collection.length > 0
    ? new Set(collection.map(e => e.id))
    : null;

  const copyMap: Record<string, number> = {};
  currentDeck.forEach(id => { copyMap[id] = (copyMap[id] || 0) + 1; });

  const allCards = (Object.values(CARD_DB) as CardData[]).filter(c =>
    c.type !== 'fusion' && (!ownedIds || ownedIds.has(c.id)) &&
    (filter === 'all' || c.type === filter)
  );

  function addCard(id: string) {
    if (currentDeck.length >= MAX_DECK) return;
    if ((copyMap[id] || 0) >= MAX_COPIES) return;
    setCurrentDeck([...currentDeck, id]);
  }

  function removeCard(id: string) {
    const idx = [...currentDeck].lastIndexOf(id);
    if (idx === -1) return;
    const next = [...currentDeck];
    next.splice(idx, 1);
    setCurrentDeck(next);
  }

  function saveDeck() {
    if (currentDeck.length !== MAX_DECK) return;
    Progression.saveDeck(currentDeck);
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  }

  const deckFull = currentDeck.length === MAX_DECK;

  // Unique sorted card ids for deck panel
  const seen = new Set<string>();
  const orderedIds: string[] = [];
  currentDeck.forEach(id => { if (!seen.has(id)) { seen.add(id); orderedIds.push(id); } });

  return (
    <div id="deckbuilder-screen">
      <div id="db-header">
        <div className="db-title">🃏 Deckbuilder</div>
        <div id="db-count">{currentDeck.length}/{MAX_DECK} Karten</div>
        <div className="ml-auto flex gap-2">
          <button
            id="btn-db-save"
            className="btn-primary"
            disabled={!deckFull}
            style={{ opacity: deckFull ? 1 : 0.4, cursor: deckFull ? 'pointer' : 'not-allowed' }}
            onClick={saveDeck}
          >💾 Deck Speichern</button>
          <button id="btn-db-back" className="btn-secondary" onClick={() => navigateTo('title')}>← Zurück</button>
        </div>
      </div>

      <div id="db-body" className={panelExpanded ? 'db-panel-expanded' : ''}>
        <div id="db-deck-panel" className={panelExpanded ? 'db-expanded' : ''}>
          <div
            className="db-panel-title"
            id="db-panel-title-btn"
            onClick={() => setPanelExpanded(e => !e)}
          >
            Aktuelles Deck <span id="db-panel-arrow">{panelExpanded ? '❮' : '❯'}</span>
          </div>
          <div id="db-deck-list">
            {panelExpanded ? (
              orderedIds.map(id => {
                const card  = (CARD_DB as any)[id] as CardData;
                const count = copyMap[id] || 0;
                return (
                  <div key={id} className="db-deck-card-wrap" onClick={() => removeCard(id)}>
                    <div
                      className={`card ${card.type}-card attr-${(card as any).attribute || 'spell'}`}
                      ref={el => { if (el) attachHover(el, card, null); }}
                    >
                      <Card card={card} />
                    </div>
                    <div className="db-copy-badge">×{count}</div>
                    <div className="db-deck-rm-overlay">✕</div>
                  </div>
                );
              })
            ) : (
              orderedIds.map(id => {
                const card  = (CARD_DB as any)[id] as CardData;
                const count = copyMap[id] || 0;
                return (
                  <div key={id} className="db-deck-row" onClick={() => removeCard(id)}>
                    <div
                      className={`card db-deck-row-mini ${card.type}-card attr-${(card as any).attribute || 'spell'}`}
                      ref={el => { if (el) attachHover(el, card, null); }}
                    >
                      <Card card={card} />
                    </div>
                    <span className="db-deck-row-name">{card.name}</span>
                    <span className="db-deck-row-count">×{count}</span>
                    <span className="db-deck-row-rm" title="Entfernen">✕</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div id="db-collection-panel">
          <div id="db-filter-bar">
            {FILTERS.map(f => (
              <button
                key={f.key}
                className={`db-filter-btn${filter === f.key ? ' active' : ''}`}
                onClick={() => setFilter(f.key)}
              >{f.label}</button>
            ))}
          </div>
          <div id="db-collection-grid">
            {allCards.map(card => {
              const copies = copyMap[card.id] || 0;
              const atMax  = copies >= MAX_COPIES;
              const full   = currentDeck.length >= MAX_DECK;
              return (
                <div
                  key={card.id}
                  className={`db-card-wrap${atMax || full ? ' db-card-dimmed' : ''}`}
                  onClick={!atMax && !full ? () => addCard(card.id) : undefined}
                >
                  <div
                    className={`card ${card.type}-card attr-${(card as any).attribute || 'spell'}`}
                    ref={el => { if (el) attachHover(el, card, null); }}
                  >
                    <Card card={card} />
                  </div>
                  {copies > 0 && <div className="db-copy-badge">{copies}/3</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div id="db-save-toast" className={toast ? '' : 'hidden'}>✓ Deck gespeichert!</div>
    </div>
  );
}
