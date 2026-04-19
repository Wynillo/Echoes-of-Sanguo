import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import RaceIcon from '../components/RaceIcon.js';
import styles from './DeckbuilderScreen.module.css';
import { GAME_RULES } from '../../rules.js';
import { ANIMATION_TIMING } from '../../constants.js';
import { GiCrossedSwords, GiShield } from 'react-icons/gi';

const MAX_DECK = GAME_RULES.maxDeckSize;
const MAX_COPIES = GAME_RULES.maxCardCopies;

type ViewMode = 'cards' | 'table';
type ActiveTab = 'collection' | 'deck';
type SortGroup = 'id' | 'rarity' | 'name' | 'atkdef' | 'inDeck';

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
  const [viewMode, setViewMode]               = useState<ViewMode>('cards');
  const [activeTab, setActiveTab]             = useState<ActiveTab>('collection');
  const [activeSort, setActiveSort]           = useState<{ group: SortGroup; step: number } | null>(null);
  const [toast, setToast]                     = useState(false);
  const [flashRow, setFlashRow]               = useState<string | null>(null);
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
  const matchesFilters = useCallback((c: CardData): boolean => {
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
  }, [typeFilter, raceFilter, rarityFilter, debouncedSearch]);

  // Collection tab: all owned non-fusion cards, filtered
  const collectionCards = useMemo(() => (Object.values(CARD_DB) as CardData[]).filter(c =>
    c.type !== CardType.Fusion &&
    (!ownedIds || ownedIds.has(c.id)) &&
    matchesFilters(c)
  ), [ownedIds, matchesFilters]);

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
  }, [currentDeck, matchesFilters]);

  const displayedCards = activeTab === 'collection' ? collectionCards : deckCards;

  // Reset pagination when filters change
  useEffect(() => setVisibleCount(100), [typeFilter, raceFilter, rarityFilter, debouncedSearch, activeTab]);

  // Refresh seen cards when collection changes (e.g. after returning from a duel)
  useEffect(() => {
    setSeenCards(Progression.getSeenCards());
  }, [collection]);

  function isNew(id: string) { return !seenCards.has(id); }

  // Cycle-sort definitions per column group
  const sortCycles = useMemo<Record<SortGroup, Array<{ indicator: string; compare: (a: CardData, b: CardData) => number }>>>(() => ({
    id: [
      { indicator: ' \u25B2', compare: (a, b) => Number(a.id) - Number(b.id) },
      { indicator: ' \u25BC', compare: (a, b) => Number(b.id) - Number(a.id) },
      { indicator: ' \u25B2', compare: (a, b) => (isNew(b.id) ? 1 : 0) - (isNew(a.id) ? 1 : 0) || Number(a.id) - Number(b.id) },
    ],
    rarity: [
      { indicator: ' \u25B2', compare: (a, b) => (a.rarity ?? 0) - (b.rarity ?? 0) },
      { indicator: ' \u25BC', compare: (a, b) => (b.rarity ?? 0) - (a.rarity ?? 0) },
    ],
    name: [
      { indicator: ' \u25B2', compare: (a, b) => a.name.localeCompare(b.name) },
      { indicator: ' \u25BC', compare: (a, b) => b.name.localeCompare(a.name) },
      { indicator: ' \u25B2', compare: (a, b) => a.type - b.type || a.name.localeCompare(b.name) },
      { indicator: ' \u25BC', compare: (a, b) => b.type - a.type || b.name.localeCompare(a.name) },
      { indicator: ' \u25B2', compare: (a, b) => (a.race ?? 0) - (b.race ?? 0) || a.name.localeCompare(b.name) },
      { indicator: ' \u25BC', compare: (a, b) => (b.race ?? 0) - (a.race ?? 0) || b.name.localeCompare(a.name) },
    ],
    atkdef: [
      { indicator: ' \u25B2', compare: (a, b) => (a.atk ?? -1) - (b.atk ?? -1) },
      { indicator: ' \u25BC', compare: (a, b) => (b.atk ?? -1) - (a.atk ?? -1) },
      { indicator: ' \u25B2', compare: (a, b) => (a.def ?? -1) - (b.def ?? -1) },
      { indicator: ' \u25BC', compare: (a, b) => (b.def ?? -1) - (a.def ?? -1) },
    ],
    inDeck: [
      { indicator: ' \u25B2', compare: (a, b) => (copyMap[a.id] || 0) - (copyMap[b.id] || 0) },
      { indicator: ' \u25BC', compare: (a, b) => (copyMap[b.id] || 0) - (copyMap[a.id] || 0) },
    ],
  }), [seenCards, copyMap]);

  const sortedCards = useMemo(() => {
    if (!activeSort) return displayedCards;
    const { group, step } = activeSort;
    const mode = sortCycles[group][step];
    if (!mode) return displayedCards;
    return [...displayedCards].sort(mode.compare);
  }, [displayedCards, activeSort, sortCycles]);

  const visibleCards = sortedCards.slice(0, visibleCount);

  function cycleSort(group: SortGroup) {
    setActiveSort(prev => {
      if (!prev || prev.group !== group) return { group, step: 0 };
      const nextStep = prev.step + 1;
      if (nextStep >= sortCycles[group].length) return null;
      return { group, step: nextStep };
    });
  }

  function sortIndicator(group: SortGroup) {
    if (!activeSort || activeSort.group !== group) return '';
    return sortCycles[group][activeSort.step]?.indicator ?? '';
  }

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

  function cycleDeckCount(id: string) {
    const copies = copyMap[id] || 0;
    const max = maxCopiesFor(id);
    if (copies >= max) {
      setCurrentDeck(currentDeck.filter(cid => cid !== id));
    } else if (currentDeck.length < MAX_DECK) {
      setCurrentDeck([...currentDeck, id]);
    }
    setFlashRow(id);
    setTimeout(() => setFlashRow(null), 300);
  }

  function saveDeck() {
    if (currentDeck.length !== MAX_DECK) return;
    const existing = Progression.getDeck();
    if (existing && existing.length > 0) {
      openModal({
        type: 'confirm',
        message: t('deckbuilder.confirm_overwrite', 'Overwrite current deck?'),
        onConfirm: () => {
      Progression.saveDeck(currentDeck);
      setToast(true);
      setTimeout(() => setToast(false), ANIMATION_TIMING.TOAST_DISMISS_MS);
    },
      });
      return;
    }
    Progression.saveDeck(currentDeck);
    setToast(true);
    setTimeout(() => setToast(false), ANIMATION_TIMING.TOAST_DISMISS_MS);
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
        <div className={styles.titleRow}>
          <button id="btn-db-back" className={`btn-secondary ${styles.backBtn}`} onClick={() => navigateTo('save-point')}>{t('deckbuilder.back')}</button>
          <div className={styles.title}>{t('deckbuilder.title')}</div>
          <button
            id="btn-db-save"
            className={`btn-primary ${styles.saveBtn}`}
            disabled={!deckFull}
            style={{ opacity: deckFull ? 1 : 0.4, cursor: deckFull ? 'pointer' : 'not-allowed' }}
            onClick={saveDeck}
          >{t('deckbuilder.save_btn')}</button>
        </div>
        <div className={styles.tabRow}>
          <button
            className={`${styles.tabBtn}${activeTab === 'collection' ? ` ${styles.activeTab}` : ''}`}
            onClick={() => setActiveTab('collection')}
          >{t('deckbuilder.tab_collection')}</button>
          <button
            className={`${styles.tabBtn}${activeTab === 'deck' ? ` ${styles.activeTab}` : ''}`}
            onClick={() => setActiveTab('deck')}
          >{t('deckbuilder.tab_deck')} {currentDeck.length}/{MAX_DECK}</button>
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
                className={`${styles.viewBtn}${viewMode === 'cards' ? ` ${styles.active}` : ''}`}
                title={t('deckbuilder.view_large')}
                onClick={() => setViewMode('cards')}
              ><RaceIcon icon="GiStack" /></button>
              <button
                className={`${styles.viewBtn}${viewMode === 'table' ? ` ${styles.active}` : ''}`}
                title={t('deckbuilder.view_table')}
                onClick={() => setViewMode('table')}
              ><RaceIcon icon="GiHamburgerMenu" /></button>
            </div>
          </div>

          {/* Card grid */}
          {viewMode === 'cards' && (
            <div className={styles.collectionGrid}>
              {visibleCards.map(card => {
                const copies = copyMap[card.id] || 0;
                const atMax  = isAtMax(card.id);
                const dimmed = activeTab === 'collection' && atMax;
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
                    <th className={styles.sortable} onClick={() => cycleSort('id')}>
                      {t('deckbuilder.table_nr')}{sortIndicator('id')}
                    </th>
                    <th className={styles.sortable} onClick={() => cycleSort('rarity')}>
                      {t('deckbuilder.table_rarity')}{sortIndicator('rarity')}
                    </th>
                    <th className={styles.sortable} onClick={() => cycleSort('name')}>
                      {t('deckbuilder.table_name')}{sortIndicator('name')}
                    </th>
                    <th className={styles.sortable} onClick={() => cycleSort('atkdef')}>
                      {t('deckbuilder.table_atkdef')}{sortIndicator('atkdef')}
                    </th>
                    <th className={styles.sortable} onClick={() => cycleSort('inDeck')}>
                      {t('deckbuilder.table_in_deck')}{sortIndicator('inDeck')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCards.map(card => {
                    const copies     = copyMap[card.id] || 0;
                    const atMax      = isAtMax(card.id);
                    const dimmed     = activeTab === 'collection' && atMax;
                    const rarMeta    = getRarityById(card.rarity as number);
                    const rarColor   = rarMeta?.color ?? '#aaa';
                    const typeLbl    = card.type === CardType.Monster && card.effect
                      ? t('deckbuilder.type_label_effect')
                      : (TYPE_LABEL[card.type] || '');
                    const typeMeta   = getCardTypeById(card.type as number);
                    const typeColor  = card.type === CardType.Monster
                      ? (card.effect ? '#c8a850' : '#e8e8e8')
                      : (typeMeta?.color ?? '#aaa');
                    const raceMeta   = card.race ? getRaceById(card.race) : undefined;
                    const raceLbl    = raceMeta?.value ?? '';
                    const raceColor  = raceMeta?.color;
                    const maxCp = maxCopiesFor(card.id);
                    const isFlashing = flashRow === card.id;
                    return (
                      <tr
                        key={card.id}
                        className={`${dimmed ? styles.tableRowDimmed : ''}${isFlashing ? ` ${styles.tableRowFlash}` : ''}`}
                        onClick={() => handleCardClick(card)}
                        onDoubleClick={() => handleCardDoubleClick(card)}
                        ref={el => { if (el) attachHover(el, card, null); }}
                      >
                        <td>
                          <div>{card.id}</div>
                          {isNew(card.id) && <span className={styles.newBadge}>NEW</span>}
                        </td>
                        <td>
                          <span style={{ color: rarColor }}>
                            {rarMeta?.value ?? '\u2014'}
                          </span>
                        </td>
                        <td>
                          <div style={{ color: typeColor }}>{card.name}</div>
                          <div className={styles.tableSubtext}>{typeLbl} {raceColor ? <span style={{ color: raceColor }}>{raceLbl}</span> : raceLbl}</div>
                        </td>
                        <td className={styles.tableAtkDef}>
                          <div><GiCrossedSwords className={styles.statIcon} /> {card.atk ?? '\u2014'}</div>
                          <div><GiShield className={styles.statIcon} /> {card.def ?? '\u2014'}</div>
                        </td>
                        <td
                          className={`${styles.deckCountCell}${copies >= maxCp && copies > 0 ? ` ${styles.deckCountMax}` : copies > 0 ? ` ${styles.deckCountActive}` : ''}`}
                          onClick={e => { e.stopPropagation(); cycleDeckCount(card.id); }}
                        >
                          <strong>{copies}</strong>/{maxCp}
                        </td>
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
