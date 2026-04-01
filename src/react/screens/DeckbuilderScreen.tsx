import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useModal }        from '../contexts/ModalContext.js';
import { CARD_DB } from '../../cards.js';
import { Progression }     from '../../progression.js';
import { Card, cardTypeCss, ATTR_CSS } from '../components/Card.js';
import { attachHover }     from '../components/hoverApi.js';
import { CardType, Race, Rarity } from '../../types.js';
import { getAllRarities, getRarityById, getCardTypeById, getRaceById } from '../../type-metadata.js';
import RaceFilterBar from '../components/RaceFilterBar.js';
import type { CardData }   from '../../types.js';
import styles from './DeckbuilderScreen.module.css';
import { GAME_RULES } from '../../rules.js';

const MAX_DECK = GAME_RULES.maxDeckSize;
const MAX_COPIES = GAME_RULES.maxCardCopies;

type ViewMode = 'large' | 'small' | 'table';
type ActiveTab = 'collection' | 'deck';
type SortColumn = 'id' | 'rarity' | 'name' | 'atk' | 'def' | 'type' | 'race' | 'collection' | 'inDeck' | 'newest';
type SortDir = 'asc' | 'desc';

export default function DeckbuilderScreen() {
  const { navigateTo }                        = useScreen();
  const { collection, currentDeck, setCurrentDeck } = useProgression();
  const { openModal } = useModal();
  const { t } = useTranslation();
  const [typeFilter, setTypeFilter]           = useState<'all' | 'monster' | 'effect' | 'spell' | 'trap' | 'equipment'>('all');
  const [raceFilter, setRaceFilter]           = useState<'all' | Race>('all');
  const [rarityFilter, setRarityFilter]       = useState<'all' | Rarity>('all');
  const [nameSearch, setNameSearch]           = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [visibleCount, setVisibleCount]       = useState(100);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewMode, setViewMode]               = useState<ViewMode>('small');
  const [activeTab, setActiveTab]             = useState<ActiveTab>('collection');
  const [sortColumn, setSortColumn]           = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection]     = useState<SortDir>('asc');
  const [toast, setToast]                     = useState(false);
  const [seenCards, setSeenCards]             = useState<Set<string>>(() => Progression.getSeenCards());

  useEffect(() => {
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(nameSearch), 200);
    return () => { if (debounceRef.current !== null) clearTimeout(debounceRef.current); };
  }, [nameSearch]);

  const TYPE_FILTERS: { key: typeof typeFilter; label: string }[] = [
    { key: 'all',     label: t('deckbuilder.type_all') },
    { key: 'monster', label: t('deckbuilder.type_normal') },
    { key: 'effect',  label: t('deckbuilder.type_effect') },
    { key: 'spell',   label: t('deckbuilder.type_spell') },
    { key: 'trap',      label: t('deckbuilder.type_trap') },
    { key: 'equipment', label: t('deckbuilder.type_equipment', 'Equipment') },
  ];

  const TYPE_LABEL: Record<number, string> = {
    [CardType.Monster]:   t('deckbuilder.type_label_normal'),
    [CardType.Fusion]:    t('deckbuilder.type_label_fusion'),
    [CardType.Spell]:     t('deckbuilder.type_label_spell'),
    [CardType.Trap]:      t('deckbuilder.type_label_trap'),
    [CardType.Equipment]: t('deckbuilder.type_label_equipment', 'Equipment'),
  };

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

  // Filter helper shared between collection and deck tabs
  function matchesFilters(c: CardData): boolean {
    return (
      (typeFilter === 'all'
        || (typeFilter === 'monster' && c.type === CardType.Monster && !c.effect)
        || (typeFilter === 'effect'  && c.type === CardType.Monster && !!c.effect)
        || (typeFilter === 'spell'   && c.type === CardType.Spell)
        || (typeFilter === 'trap'    && c.type === CardType.Trap)
        || (typeFilter === 'equipment' && c.type === CardType.Equipment)) &&
      (raceFilter === 'all' || c.race === raceFilter) &&
      (rarityFilter === 'all' || c.rarity === rarityFilter) &&
      (!debouncedSearch || c.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    );
  }

  // Collection tab: all owned non-fusion cards, filtered
  const collectionCards = useMemo(() => (Object.values(CARD_DB) as CardData[]).filter(c =>
    c.type !== CardType.Fusion &&
    (!ownedIds || ownedIds.has(c.id)) &&
    matchesFilters(c)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [ownedIds, typeFilter, raceFilter, rarityFilter, debouncedSearch]);

  // Deck tab: unique cards in current deck, filtered
  const deckCards = useMemo(() => {
    const seen = new Set<string>();
    const cards: CardData[] = [];
    currentDeck.forEach(id => {
      if (seen.has(id)) return;
      seen.add(id);
      const card = CARD_DB[id] as CardData | undefined;
      if (card && matchesFilters(card)) cards.push(card);
    });
    return cards;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDeck, typeFilter, raceFilter, rarityFilter, debouncedSearch]);

  const displayedCards = activeTab === 'collection' ? collectionCards : deckCards;

  // Reset pagination when filters change
  useEffect(() => setVisibleCount(100), [typeFilter, raceFilter, rarityFilter, debouncedSearch, activeTab]);

  // Sorting
  const sortedCards = useMemo(() => {
    if (!sortColumn) return displayedCards;
    const sorted = [...displayedCards].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'id':         cmp = Number(a.id) - Number(b.id); break;
        case 'name':       cmp = a.name.localeCompare(b.name); break;
        case 'atk':        cmp = (a.atk ?? -1) - (b.atk ?? -1); break;
        case 'def':        cmp = (a.def ?? -1) - (b.def ?? -1); break;
        case 'rarity':     cmp = (a.rarity ?? 0) - (b.rarity ?? 0); break;
        case 'type':       cmp = a.type - b.type; break;
        case 'race':       cmp = (a.race ?? 0) - (b.race ?? 0); break;
        case 'collection': cmp = (collectionCount[a.id] || 0) - (collectionCount[b.id] || 0); break;
        case 'inDeck':     cmp = (copyMap[a.id] || 0) - (copyMap[b.id] || 0); break;
        case 'newest':     cmp = (isNew(a.id) ? 1 : 0) - (isNew(b.id) ? 1 : 0); break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedCards, sortColumn, sortDirection, collectionCount, copyMap, seenCards]);

  const visibleCards = sortedCards.slice(0, visibleCount);

  // Refresh seen cards when collection changes (e.g. after returning from a duel)
  useEffect(() => {
    setSeenCards(Progression.getSeenCards());
  }, [collection]);

  function isNew(id: string) { return !seenCards.has(id); }

  function addCard(id: string) {
    if (currentDeck.length >= MAX_DECK) return;
    const copiesInDeck = copyMap[id] || 0;
    if (copiesInDeck >= MAX_COPIES) return;
    const owned = collectionCount[id] || 0;
    if (copiesInDeck >= owned) return;
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
    const existing = Progression.getDeck();
    if (existing && existing.length > 0) {
      const ok = window.confirm(t('deckbuilder.confirm_overwrite', 'Overwrite current deck?'));
      if (!ok) return;
    }
    Progression.saveDeck(currentDeck);
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  }

  function toggleSort(col: SortColumn) {
    if (sortColumn === col) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  }

  function sortIndicator(col: SortColumn) {
    if (sortColumn !== col) return '';
    return sortDirection === 'asc' ? ' \u25B2' : ' \u25BC';
  }

  // Card limit helper
  function maxCopiesFor(cardId: string) {
    return Math.min(MAX_COPIES, collectionCount[cardId] || 0);
  }

  function isAtMax(cardId: string) {
    const copies = copyMap[cardId] || 0;
    return copies >= MAX_COPIES || copies >= (collectionCount[cardId] || 0);
  }

  // Click handlers
  function handleCardClick(card: CardData) {
    if (activeTab === 'collection') {
      openModal({
        type: 'card-detail',
        card,
        source: 'deckbuilder-collection',
        onDeckAction: (action) => { if (action === 'add') addCard(card.id); },
      });
    } else {
      openModal({
        type: 'card-detail',
        card,
        source: 'deckbuilder-deck',
        onDeckAction: (action) => { if (action === 'remove') removeCard(card.id); },
      });
    }
  }

  function handleCardDoubleClick(card: CardData) {
    if (activeTab === 'collection') {
      addCard(card.id);
    } else {
      removeCard(card.id);
    }
  }

  const deckFull = currentDeck.length === MAX_DECK;

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button id="btn-db-back" className={`btn-secondary ${styles.backBtn}`} onClick={() => navigateTo('save-point')}>{t('deckbuilder.back')}</button>
        <div className={styles.title}>{t('deckbuilder.title')}</div>
        <div className={styles.count}>{t('deckbuilder.cards_count', { current: currentDeck.length, max: MAX_DECK })}</div>
        <button
          id="btn-db-save"
          className="btn-primary"
          disabled={!deckFull}
          style={{ opacity: deckFull ? 1 : 0.4, cursor: deckFull ? 'pointer' : 'not-allowed' }}
          onClick={saveDeck}
        >{t('deckbuilder.save_btn')}</button>
        <div className={`${styles.tabs} ml-auto`}>
          <button
            className={`${styles.tabBtn}${activeTab === 'collection' ? ` ${styles.activeTab}` : ''}`}
            onClick={() => setActiveTab('collection')}
          >{t('deckbuilder.tab_collection')}</button>
          <button
            className={`${styles.tabBtn}${activeTab === 'deck' ? ` ${styles.activeTab}` : ''}`}
            onClick={() => setActiveTab('deck')}
          >{t('deckbuilder.tab_deck')}</button>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.mainPanel}>
          {/* Filter bar */}
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
              <RaceFilterBar value={raceFilter} onChange={setRaceFilter} />
            </div>
            <div className={styles.filterGroup}>
              <select
                className={styles.raritySelect}
                value={rarityFilter}
                onChange={e => setRarityFilter(e.target.value === 'all' ? 'all' : Number(e.target.value) as Rarity)}
              >
                <option value="all">{t('deckbuilder.rarity_all')}</option>
                {getAllRarities().map(rm => (
                  <option key={rm.id} value={rm.id}>{rm.value}</option>
                ))}
              </select>
              <input
                className={styles.nameSearch}
                type="text"
                placeholder={t('deckbuilder.name_search')}
                value={nameSearch}
                onChange={e => setNameSearch(e.target.value)}
              />
            </div>
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewBtn}${viewMode === 'large' ? ` ${styles.active}` : ''}`}
                title={t('deckbuilder.view_large')}
                onClick={() => setViewMode('large')}
              >⊞</button>
              <button
                className={`${styles.viewBtn}${viewMode === 'small' ? ` ${styles.active}` : ''}`}
                title={t('deckbuilder.view_small')}
                onClick={() => setViewMode('small')}
              >⊟</button>
              <button
                className={`${styles.viewBtn}${viewMode === 'table' ? ` ${styles.active}` : ''}`}
                title={t('deckbuilder.view_table')}
                onClick={() => setViewMode('table')}
              >☰</button>
            </div>
          </div>

          {/* Card grid — Large or Small */}
          {viewMode !== 'table' && (
            <div className={`${styles.collectionGrid}${viewMode === 'large' ? ` ${styles.gridLarge}` : ` ${styles.gridSmall}`}`}>
              {visibleCards.map(card => {
                const copies = copyMap[card.id] || 0;
                const atMax  = isAtMax(card.id);
                const full   = currentDeck.length >= MAX_DECK;
                const dimmed = activeTab === 'collection' && (atMax || full);
                return (
                  <div
                    key={card.id}
                    className={`${styles.cardWrap}${dimmed ? ` ${styles.cardDimmed}` : ''}`}
                    onClick={() => handleCardClick(card)}
                    onDoubleClick={() => handleCardDoubleClick(card)}
                  >
                    <div
                      className={`card ${cardTypeCss(card)}-card attr-${card.attribute ? ATTR_CSS[card.attribute] || 'spell' : 'spell'}`}
                      ref={el => { if (el) attachHover(el, card, null); }}
                    >
                      <Card card={card} />
                    </div>
                    {copies > 0 && <div className={styles.copyBadge}>{copies}/{maxCopiesFor(card.id)}</div>}
                    {isNew(card.id) && <div className={styles.newBadgeGrid}>NEW</div>}
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
                    <th className={styles.sortable} onClick={() => toggleSort('id')}>
                      {t('deckbuilder.table_nr')}{sortIndicator('id')}
                    </th>
                    <th className={styles.sortable} onClick={() => toggleSort('rarity')}>
                      {t('deckbuilder.table_rarity')}{sortIndicator('rarity')}
                    </th>
                    <th className={styles.sortable} onClick={() => toggleSort('name')}>
                      {t('deckbuilder.table_name')}{sortIndicator('name')}
                    </th>
                    <th className={styles.sortable} onClick={() => toggleSort('atk')}>
                      {t('deckbuilder.table_atk')}{sortIndicator('atk')}
                    </th>
                    <th className={styles.sortable} onClick={() => toggleSort('def')}>
                      {t('deckbuilder.table_def')}{sortIndicator('def')}
                    </th>
                    <th className={styles.sortable} onClick={() => toggleSort('type')}>
                      {t('deckbuilder.table_type')}{sortIndicator('type')}
                    </th>
                    <th className={styles.sortable} onClick={() => toggleSort('race')}>
                      {t('deckbuilder.table_race')}{sortIndicator('race')}
                    </th>
                    <th className={styles.sortable} onClick={() => toggleSort('inDeck')}>
                      {t('deckbuilder.table_in_deck')}{sortIndicator('inDeck')}
                    </th>
                    <th className={styles.sortable} onClick={() => toggleSort('newest')}>
                      {t('deckbuilder.table_new')}{sortIndicator('newest')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCards.map(card => {
                    const copies     = copyMap[card.id] || 0;
                    const atMax      = isAtMax(card.id);
                    const full       = currentDeck.length >= MAX_DECK;
                    const dimmed     = activeTab === 'collection' && (atMax || full);
                    const ownedCount = collectionCount[card.id] || 0;
                    const rarMeta    = getRarityById(card.rarity as number);
                    const rarColor   = rarMeta?.color ?? '#aaa';
                    const typeLbl    = card.type === CardType.Monster && card.effect
                      ? t('deckbuilder.type_label_effect')
                      : (TYPE_LABEL[card.type] || '');
                    const typeMeta   = getCardTypeById(card.type as number);
                    const typeColor  = card.type === CardType.Monster
                      ? (card.effect ? '#c8a850' : '#e8e8e8')
                      : (typeMeta?.color ?? '#aaa');
                    const raceLbl    = card.race ? (getRaceById(card.race)?.value ?? '') : '';
                    return (
                      <tr
                        key={card.id}
                        className={dimmed ? styles.tableRowDimmed : ''}
                        onClick={() => handleCardClick(card)}
                        onDoubleClick={() => handleCardDoubleClick(card)}
                        ref={el => { if (el) attachHover(el, card, null); }}
                      >
                        <td>{card.id}</td>
                        <td>
                          <span style={{ color: rarColor }}>
                            {rarMeta?.value ?? '\u2014'}
                          </span>
                        </td>
                        <td style={{ color: typeColor }}>{card.name}</td>
                        <td>{card.atk !== undefined ? card.atk : '\u2014'}</td>
                        <td>{card.def !== undefined ? card.def : '\u2014'}</td>
                        <td style={{ color: typeColor }}>{typeLbl}</td>
                        <td>{raceLbl}</td>
                        <td>{copies} / {maxCopiesFor(card.id)}</td>
                        <td>{isNew(card.id) && <span className={styles.newBadge}>NEW</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {visibleCount < sortedCards.length && (
        <div style={{ textAlign: 'center', padding: '0.5rem' }}>
          <button className="btn-secondary" onClick={() => setVisibleCount(v => v + 100)}>
            {t('common.load_more', { count: Math.min(100, sortedCards.length - visibleCount) })}
          </button>
        </div>
      )}
      {toast && <div className={styles.saveToast}>{t('deckbuilder.saved_toast')}</div>}
    </div>
  );
}
