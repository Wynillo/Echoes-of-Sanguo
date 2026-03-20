import { useState, useCallback, useEffect } from 'react';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useModal }        from '../contexts/ModalContext.js';
import { CARD_DB, RARITY_COLOR, RARITY_NAME, RACE_NAME } from '../../cards.js';
import { Progression }     from '../../progression.js';
import { Card }            from '../components/Card.js';
import { attachHover }     from '../components/hoverApi.js';
import type { CardData }   from '../../types.js';

const MAX_DECK = 40;
const MAX_COPIES = 3;

type ViewMode = 'large' | 'small' | 'table';

const TYPE_FILTERS = [
  { key: 'all',    label: 'Alle' },
  { key: 'normal', label: 'Normal' },
  { key: 'effect', label: 'Effekt' },
  { key: 'spell',  label: 'Zauber' },
  { key: 'trap',   label: 'Falle' },
];

const RACE_FILTERS = [
  { key: 'all',     label: 'Alle' },
  { key: 'feuer',   label: '🔥' },
  { key: 'drache',  label: '🐲' },
  { key: 'flug',    label: '🦅' },
  { key: 'stein',   label: '🪨' },
  { key: 'pflanze', label: '🌿' },
  { key: 'krieger', label: '⚔️' },
  { key: 'magier',  label: '🔮' },
  { key: 'elfe',    label: '✨' },
  { key: 'daemon',  label: '💀' },
  { key: 'wasser',  label: '🌊' },
];

const TYPE_LABEL: Record<string, string> = {
  normal: 'Normal', effect: 'Effekt', fusion: 'Fusion', spell: 'Zauber', trap: 'Falle',
};

export default function DeckbuilderScreen() {
  const { navigateTo }                        = useScreen();
  const { collection, currentDeck, setCurrentDeck, loadDeck } = useProgression();
  const { openModal }                         = useModal();
  const [typeFilter, setTypeFilter]           = useState('all');
  const [raceFilter, setRaceFilter]           = useState('all');
  const [rarityFilter, setRarityFilter]       = useState('all');
  const [nameSearch, setNameSearch]           = useState('');
  const [viewMode, setViewMode]               = useState<ViewMode>('small');
  const [panelExpanded, setPanelExpanded]     = useState(false);
  const [toast, setToast]                     = useState(false);
  const [seenCards, setSeenCards]             = useState<Set<string>>(() => Progression.getSeenCards());

  const ownedIds = collection.length > 0
    ? new Set(collection.map(e => e.id))
    : null;

  const collectionCount: Record<string, number> = {};
  collection.forEach(e => { collectionCount[e.id] = e.count; });

  const copyMap: Record<string, number> = {};
  currentDeck.forEach(id => { copyMap[id] = (copyMap[id] || 0) + 1; });

  const allCards = (Object.values(CARD_DB) as CardData[]).filter(c =>
    c.type !== 'fusion' &&
    (!ownedIds || ownedIds.has(c.id)) &&
    (typeFilter === 'all' || c.type === typeFilter) &&
    (raceFilter === 'all' || (c as any).race === raceFilter) &&
    (rarityFilter === 'all' || (c as any).rarity === rarityFilter) &&
    (!nameSearch || c.name.toLowerCase().includes(nameSearch.toLowerCase()))
  );

  // Mark all visible cards as seen after mount
  useEffect(() => {
    const ids = allCards.map(c => c.id);
    Progression.markCardsAsSeen(ids);
    setSeenCards(Progression.getSeenCards());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function isNew(id: string) { return !seenCards.has(id); }

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
          {/* Filter row 1: type + zoom */}
          <div id="db-filter-bar">
            <div className="db-filter-group">
              {TYPE_FILTERS.map(f => (
                <button
                  key={f.key}
                  className={`db-filter-btn${typeFilter === f.key ? ' active' : ''}`}
                  onClick={() => setTypeFilter(f.key)}
                >{f.label}</button>
              ))}
            </div>
            <div className="db-filter-group db-race-filter">
              {RACE_FILTERS.map(f => (
                <button
                  key={f.key}
                  className={`db-filter-btn db-race-btn${raceFilter === f.key ? ' active' : ''}`}
                  onClick={() => setRaceFilter(f.key)}
                >{f.label}</button>
              ))}
            </div>
            <div className="db-filter-group">
              <select
                className="db-rarity-select"
                value={rarityFilter}
                onChange={e => setRarityFilter(e.target.value)}
              >
                <option value="all">Alle Seltenheiten</option>
                <option value="common">Common</option>
                <option value="uncommon">Uncommon</option>
                <option value="rare">Rare</option>
                <option value="super_rare">Super Rare</option>
                <option value="ultra_rare">Ultra Rare</option>
              </select>
              <input
                className="db-name-search"
                type="text"
                placeholder="Name suchen…"
                value={nameSearch}
                onChange={e => setNameSearch(e.target.value)}
              />
            </div>
            <div className="db-view-toggle">
              <button
                className={`db-view-btn${viewMode === 'large' ? ' active' : ''}`}
                title="Groß"
                onClick={() => setViewMode('large')}
              >⊞</button>
              <button
                className={`db-view-btn${viewMode === 'small' ? ' active' : ''}`}
                title="Klein"
                onClick={() => setViewMode('small')}
              >⊟</button>
              <button
                className={`db-view-btn${viewMode === 'table' ? ' active' : ''}`}
                title="Tabelle"
                onClick={() => setViewMode('table')}
              >☰</button>
            </div>
          </div>

          {/* Card grid — Large or Small */}
          {viewMode !== 'table' && (
            <div id="db-collection-grid" className={viewMode === 'large' ? 'db-grid-large' : 'db-grid-small'}>
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
                      <Card card={card} small={viewMode === 'small'} />
                    </div>
                    {copies > 0 && <div className="db-copy-badge">{copies}/3</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Table view */}
          {viewMode === 'table' && (
            <div id="db-collection-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Nr.</th>
                    <th>Rarity</th>
                    <th>Name</th>
                    <th>ATK / DEF</th>
                    <th>Typ / Rasse</th>
                    <th>Sammlung</th>
                    <th>Im Deck</th>
                  </tr>
                </thead>
                <tbody>
                  {allCards.map(card => {
                    const copies     = copyMap[card.id] || 0;
                    const atMax      = copies >= MAX_COPIES;
                    const full       = currentDeck.length >= MAX_DECK;
                    const ownedCount = collectionCount[card.id] || 0;
                    const rarColor   = (RARITY_COLOR as any)[(card as any).rarity] || '#aaa';
                    const typeLbl    = TYPE_LABEL[card.type] || card.type;
                    const raceLbl    = (RACE_NAME as any)[(card as any).race] || '';
                    const typeRace   = raceLbl ? `${typeLbl} / ${raceLbl}` : typeLbl;
                    return (
                      <tr
                        key={card.id}
                        className={atMax || full ? 'db-table-row-dimmed' : ''}
                        onClick={!atMax && !full ? () => addCard(card.id) : undefined}
                        ref={el => { if (el) attachHover(el as any, card, null); }}
                      >
                        <td>
                          {card.id}
                          {isNew(card.id) && <span className="db-new-badge">NEW</span>}
                        </td>
                        <td>
                          <span style={{ color: rarColor }}>
                            {(RARITY_NAME as any)[(card as any).rarity] || '—'}
                          </span>
                        </td>
                        <td>{card.name}</td>
                        <td>{card.atk !== undefined ? `${card.atk} / ${card.def}` : '—'}</td>
                        <td>{typeRace}</td>
                        <td>{ownedCount}</td>
                        <td>{copies} / {MAX_COPIES}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div id="db-save-toast" className={toast ? '' : 'hidden'}>✓ Deck gespeichert!</div>
    </div>
  );
}
