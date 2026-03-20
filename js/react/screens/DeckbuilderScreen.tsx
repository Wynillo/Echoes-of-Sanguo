import { useState, useCallback, useEffect, useMemo } from 'react';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useModal }        from '../contexts/ModalContext.js';
import { CARD_DB, RARITY_COLOR, RARITY_NAME, RACE_NAME } from '../../cards.js';
import { Progression }     from '../../progression.js';
import { Card }            from '../components/Card.js';
import { attachHover }     from '../components/HoverPreview.js';
import type { CardData }   from '../../types.js';
import styles from './DeckbuilderScreen.module.css';

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

  const { ownedIds, collectionCount } = useMemo(() => {
    const ownedIds = collection.length > 0 ? new Set(collection.map(e => e.id)) : null;
    const collectionCount: Record<string, number> = {};
    collection.forEach(e => { collectionCount[e.id] = e.count; });
    return { ownedIds, collectionCount };
  }, [collection]);

  const copyMap = useMemo(() => {
    const map: Record<string, number> = {};
    currentDeck.forEach(id => { map[id] = (map[id] || 0) + 1; });
    return map;
  }, [currentDeck]);

  const allCards = useMemo(() => (Object.values(CARD_DB) as CardData[]).filter(c =>
    c.type !== 'fusion' &&
    (!ownedIds || ownedIds.has(c.id)) &&
    (typeFilter === 'all' || c.type === typeFilter) &&
    (raceFilter === 'all' || (c as any).race === raceFilter) &&
    (rarityFilter === 'all' || (c as any).rarity === rarityFilter) &&
    (!nameSearch || c.name.toLowerCase().includes(nameSearch.toLowerCase()))
  ), [ownedIds, typeFilter, raceFilter, rarityFilter, nameSearch]);

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

  const orderedIds = useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    currentDeck.forEach(id => { if (!seen.has(id)) { seen.add(id); ids.push(id); } });
    return ids;
  }, [currentDeck]);

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.title}>🃏 Deckbuilder</div>
        <div className={styles.count}>{currentDeck.length}/{MAX_DECK} Karten</div>
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

      <div className={`${styles.body}${panelExpanded ? ` ${styles.panelExpanded}` : ''}`}>
        <div className={`${styles.deckPanel}${panelExpanded ? ` ${styles.expanded}` : ''}`}>
          <div
            className={styles.panelTitle}
            id="db-panel-title-btn"
            onClick={() => setPanelExpanded(e => !e)}
          >
            Aktuelles Deck <span className={styles.panelArrow}>{panelExpanded ? '❮' : '❯'}</span>
          </div>
          <div className={panelExpanded ? styles.deckListExpanded : styles.deckList}>
            {panelExpanded ? (
              orderedIds.map(id => {
                const card  = (CARD_DB as any)[id] as CardData;
                const count = copyMap[id] || 0;
                return (
                  <div key={id} className={styles.deckCardWrap} onClick={() => removeCard(id)}>
                    <div
                      className={`card ${card.type}-card attr-${(card as any).attribute || 'spell'}`}
                      ref={el => { if (el) attachHover(el, card, null); }}
                    >
                      <Card card={card} />
                    </div>
                    <div className={styles.copyBadge}>×{count}</div>
                    <div className={styles.deckRmOverlay}>✕</div>
                  </div>
                );
              })
            ) : (
              orderedIds.map(id => {
                const card  = (CARD_DB as any)[id] as CardData;
                const count = copyMap[id] || 0;
                return (
                  <div key={id} className={styles.deckRow} onClick={() => removeCard(id)}>
                    <div
                      className={`card ${styles.deckRowMini} ${card.type}-card attr-${(card as any).attribute || 'spell'}`}
                      ref={el => { if (el) attachHover(el, card, null); }}
                    >
                      <Card card={card} />
                    </div>
                    <span className={styles.deckRowName}>{card.name}</span>
                    <span className={styles.deckRowCount}>×{count}</span>
                    <span className={styles.deckRowRm} title="Entfernen">✕</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={styles.collectionPanel}>
          {/* Filter row 1: type + zoom */}
          <div className={styles.filterBar}>
            <div className={styles.filterGroup}>
              {TYPE_FILTERS.map(f => (
                <button
                  key={f.key}
                  className={`${styles.filterBtn}${typeFilter === f.key ? ` ${styles.active}` : ''}`}
                  onClick={() => setTypeFilter(f.key)}
                >{f.label}</button>
              ))}
            </div>
            <div className={styles.filterGroup}>
              {RACE_FILTERS.map(f => (
                <button
                  key={f.key}
                  className={`${styles.filterBtn} ${styles.raceBtn}${raceFilter === f.key ? ` ${styles.active}` : ''}`}
                  onClick={() => setRaceFilter(f.key)}
                >{f.label}</button>
              ))}
            </div>
            <div className={styles.filterGroup}>
              <select
                className={styles.raritySelect}
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
                className={styles.nameSearch}
                type="text"
                placeholder="Name suchen…"
                value={nameSearch}
                onChange={e => setNameSearch(e.target.value)}
              />
            </div>
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewBtn}${viewMode === 'large' ? ` ${styles.active}` : ''}`}
                title="Groß"
                onClick={() => setViewMode('large')}
              >⊞</button>
              <button
                className={`${styles.viewBtn}${viewMode === 'small' ? ` ${styles.active}` : ''}`}
                title="Klein"
                onClick={() => setViewMode('small')}
              >⊟</button>
              <button
                className={`${styles.viewBtn}${viewMode === 'table' ? ` ${styles.active}` : ''}`}
                title="Tabelle"
                onClick={() => setViewMode('table')}
              >☰</button>
            </div>
          </div>

          {/* Card grid — Large or Small */}
          {viewMode !== 'table' && (
            <div className={`${styles.collectionGrid}${viewMode === 'large' ? ` ${styles.gridLarge}` : ` ${styles.gridSmall}`}`}>
              {allCards.map(card => {
                const copies = copyMap[card.id] || 0;
                const atMax  = copies >= MAX_COPIES;
                const full   = currentDeck.length >= MAX_DECK;
                return (
                  <div
                    key={card.id}
                    className={`${styles.cardWrap}${atMax || full ? ` ${styles.cardDimmed}` : ''}`}
                    onClick={!atMax && !full ? () => addCard(card.id) : undefined}
                  >
                    <div
                      className={`card ${card.type}-card attr-${(card as any).attribute || 'spell'}`}
                      ref={el => { if (el) attachHover(el, card, null); }}
                    >
                      <Card card={card} small={viewMode === 'small'} />
                    </div>
                    {copies > 0 && <div className={styles.copyBadge}>{copies}/3</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Table view */}
          {viewMode === 'table' && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
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
                        className={atMax || full ? styles.tableRowDimmed : ''}
                        onClick={!atMax && !full ? () => addCard(card.id) : undefined}
                        ref={el => { if (el) attachHover(el as any, card, null); }}
                      >
                        <td>
                          {card.id}
                          {isNew(card.id) && <span className={styles.newBadge}>NEW</span>}
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

      {toast && <div className={styles.saveToast}>✓ Deck gespeichert!</div>}
    </div>
  );
}
