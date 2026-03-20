import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useModal }        from '../contexts/ModalContext.js';
import { CARD_DB, RARITY_COLOR } from '../../cards.js';
import { Progression }     from '../../progression.js';
import { Card }            from '../components/Card.js';
import { attachHover }     from '../components/hoverApi.js';
import type { CardData }   from '../../types.js';
import styles from './DeckbuilderScreen.module.css';

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
        <div className={styles.title}>{t('deckbuilder.title')}</div>
        <div className={styles.count}>{t('deckbuilder.cards_count', { current: currentDeck.length, max: MAX_DECK })}</div>
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

      <div className={`${styles.body}${panelExpanded ? ` ${styles.panelExpanded}` : ''}`}>
        <div className={`${styles.deckPanel}${panelExpanded ? ` ${styles.expanded}` : ''}`}>
          <div
            className={styles.panelTitle}
            id="db-panel-title-btn"
            onClick={() => setPanelExpanded(e => !e)}
          >
            {t('deckbuilder.current_deck')} <span className={styles.panelArrow}>{panelExpanded ? '❮' : '❯'}</span>
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
                    <span className={styles.deckRowRm} title={t('deckbuilder.remove_hint')}>✕</span>
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
                <option value="all">{t('deckbuilder.rarity_all')}</option>
                <option value="common">Common</option>
                <option value="uncommon">Uncommon</option>
                <option value="rare">Rare</option>
                <option value="super_rare">Super Rare</option>
                <option value="ultra_rare">Ultra Rare</option>
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

      {toast && <div className={styles.saveToast}>{t('deckbuilder.saved_toast')}</div>}
    </div>
  );
}
