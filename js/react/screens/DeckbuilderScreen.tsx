import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useModal }        from '../contexts/ModalContext.js';
import { CARD_DB, RARITY_COLOR } from '../../cards.js';
import { Progression }     from '../../progression.js';
import { Card }            from '../components/Card.js';
import { attachHover }     from '../components/HoverPreview.js';
import type { CardData }   from '../../types.js';

const MAX_DECK = 40;
const MAX_COPIES = 3;

type ViewMode = 'large' | 'small' | 'table';

const RACE_FILTERS = [
  { key: 'all',     label: '🌐' },
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

export default function DeckbuilderScreen() {
  const { navigateTo }                        = useScreen();
  const { collection, currentDeck, setCurrentDeck, loadDeck } = useProgression();
  const { openModal }                         = useModal();
  const { t } = useTranslation();
  const [typeFilter, setTypeFilter]           = useState('all');
  const [raceFilter, setRaceFilter]           = useState('all');
  const [rarityFilter, setRarityFilter]       = useState('all');
  const [nameSearch, setNameSearch]           = useState('');
  const [viewMode, setViewMode]               = useState<ViewMode>('small');
  const [panelExpanded, setPanelExpanded]     = useState(false);
  const [toast, setToast]                     = useState(false);
  const [seenCards, setSeenCards]             = useState<Set<string>>(() => Progression.getSeenCards());

  const TYPE_FILTERS = [
    { key: 'all',    label: t('deckbuilder.type_all') },
    { key: 'normal', label: t('deckbuilder.type_normal') },
    { key: 'effect', label: t('deckbuilder.type_effect') },
    { key: 'spell',  label: t('deckbuilder.type_spell') },
    { key: 'trap',   label: t('deckbuilder.type_trap') },
  ];

  const TYPE_LABEL: Record<string, string> = {
    normal: t('deckbuilder.type_label_normal'),
    effect: t('deckbuilder.type_label_effect'),
    fusion: t('deckbuilder.type_label_fusion'),
    spell:  t('deckbuilder.type_label_spell'),
    trap:   t('deckbuilder.type_label_trap'),
  };

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
        <div className="db-title">{t('deckbuilder.title')}</div>
        <div id="db-count">{t('deckbuilder.cards_count', { current: currentDeck.length, max: MAX_DECK })}</div>
        <div className="ml-auto flex gap-2">
          <button
            id="btn-db-save"
            className="btn-primary"
            disabled={!deckFull}
            style={{ opacity: deckFull ? 1 : 0.4, cursor: deckFull ? 'pointer' : 'not-allowed' }}
            onClick={saveDeck}
          >{t('deckbuilder.save_btn')}</button>
          <button id="btn-db-back" className="btn-secondary" onClick={() => navigateTo('title')}>{t('deckbuilder.back')}</button>
        </div>
      </div>

      <div id="db-body" className={panelExpanded ? 'db-panel-expanded' : ''}>
        <div id="db-deck-panel" className={panelExpanded ? 'db-expanded' : ''}>
          <div
            className="db-panel-title"
            id="db-panel-title-btn"
            onClick={() => setPanelExpanded(e => !e)}
          >
            {t('deckbuilder.current_deck')} <span id="db-panel-arrow">{panelExpanded ? '❮' : '❯'}</span>
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
                    <span className="db-deck-row-rm" title={t('deckbuilder.remove_hint')}>✕</span>
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
                <option value="all">{t('deckbuilder.rarity_all')}</option>
                <option value="common">Common</option>
                <option value="uncommon">Uncommon</option>
                <option value="rare">Rare</option>
                <option value="super_rare">Super Rare</option>
                <option value="ultra_rare">Ultra Rare</option>
              </select>
              <input
                className="db-name-search"
                type="text"
                placeholder={t('deckbuilder.name_search')}
                value={nameSearch}
                onChange={e => setNameSearch(e.target.value)}
              />
            </div>
            <div className="db-view-toggle">
              <button
                className={`db-view-btn${viewMode === 'large' ? ' active' : ''}`}
                title={t('deckbuilder.view_large')}
                onClick={() => setViewMode('large')}
              >⊞</button>
              <button
                className={`db-view-btn${viewMode === 'small' ? ' active' : ''}`}
                title={t('deckbuilder.view_small')}
                onClick={() => setViewMode('small')}
              >⊟</button>
              <button
                className={`db-view-btn${viewMode === 'table' ? ' active' : ''}`}
                title={t('deckbuilder.view_table')}
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
                    <th>{t('deckbuilder.table_nr')}</th>
                    <th>{t('deckbuilder.table_rarity')}</th>
                    <th>{t('deckbuilder.table_name')}</th>
                    <th>{t('deckbuilder.table_atkdef')}</th>
                    <th>{t('deckbuilder.table_type_race')}</th>
                    <th>{t('deckbuilder.table_collection')}</th>
                    <th>{t('deckbuilder.table_in_deck')}</th>
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
                    const raceLbl    = (card as any).race ? t(`cards.race_${(card as any).race}`) : '';
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
                            {(card as any).rarity ? (card as any).rarity.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : '—'}
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

      <div id="db-save-toast" className={toast ? '' : 'hidden'}>{t('deckbuilder.saved_toast')}</div>
    </div>
  );
}
