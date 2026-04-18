// ============================================================
// Card — visual component that mirrors cardInnerHTML()
// ============================================================
import i18next from 'i18next';
import { CardType } from '../../types.js';
import type { CardData, FieldCard } from '../../types.js';
import {
  getRaceById, getAttrById, getRarityById, getCardTypeById,
} from '../../type-metadata.js';
import { highlightCardText, highlightCardTextHTML } from '../utils/highlightCardText.js';
import styles from './Card.module.css';

/** Map a card to its type-based placeholder art URL, or null if none available. */
function getPlaceholderUrl(card: CardData): string | null {
  switch (card.type) {
    case CardType.Monster:    return './img/placeholders/monster.svg';
    case CardType.Fusion:     return './img/placeholders/fusion.svg';
    case CardType.Trap:       return './img/placeholders/trap.svg';
    case CardType.Equipment:  return './img/placeholders/equipment.svg';
    case CardType.Spell:
      return card.spellType === 'field'
        ? './img/placeholders/field-spell.svg'
        : './img/placeholders/spell.svg';
    default:                  return null;
  }
}

function getTypeLabel(card: CardData): string {
  if (card.type === CardType.Monster && card.effect) return i18next.t('card_detail.type_effect');
  return getCardTypeById(card.type)?.value ?? '';
}

/** Map CardType enum to CSS class prefix — distinguishes normal vs effect monsters */
function typeCss(card: CardData): string {
  if (card.type === CardType.Monster) return card.effect ? 'effect' : 'normal';
  return getCardTypeById(card.type)?.key.toLowerCase() ?? 'monster';
}

/** Map Attribute enum to CSS class suffix */
function attrCssKey(attr: number | undefined): string {
  if (!attr) return 'spell';
  return getAttrById(attr)?.key ?? 'spell';
}

interface Props {
  card: CardData;
  fc?: FieldCard | null;
  dimmed?: boolean;
  rotated?: boolean;
  big?: boolean;
  small?: boolean;
  extraClass?: string;
}

export function Card({ card, fc = null, dimmed = false, rotated = false, big = false, small = false, extraClass = '' }: Props) {
  const isMonLevelC = card.type === CardType.Monster || card.type === CardType.Fusion;
  const isEquipment = card.type === CardType.Equipment;
  const levelStars = isMonLevelC && card.level ? '\u2605'.repeat(Math.min(card.level, 12)) : '';
  const attrMeta   = card.attribute ? getAttrById(card.attribute) : undefined;
  const attrSym    = attrMeta?.symbol ?? '\u2726';
  const typeLabel  = getTypeLabel(card);
  const placeholderUrl = getPlaceholderUrl(card);
  const artStyle: React.CSSProperties | undefined = placeholderUrl
    ? { backgroundImage: `url(${placeholderUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined;
  const baseATK    = card.atk ?? 0;
  const baseDEF    = card.def ?? 0;
  const effATK     = fc ? fc.effectiveATK() : baseATK;
  const effDEF     = fc ? fc.effectiveDEF() : baseDEF;
  const atkStatCls = fc ? (effATK > baseATK ? styles.statBuffed : effATK < baseATK ? styles.statNerfed : '') : '';
  const defStatCls = fc ? (effDEF > baseDEF ? styles.statBuffed : effDEF < baseDEF ? styles.statNerfed : '') : '';

  const isMonster = card.atk !== undefined && !isEquipment;

  // Attribute orb (top-right)
  const orbColor = attrMeta?.color ?? '#444';
  const attrOrb = card.attribute
    ? <span className={styles.attrOrb} style={{ background: orbColor }}>{attrSym}</span>
    : null;

  // Race badge (inside art area, top-left)
  const raceMeta = card.race ? getRaceById(card.race) : undefined;
  const raceLabel = raceMeta?.value ?? '';
  const raceBadge = card.race
    ? <span className={styles.raceBadge} style={{ background: raceMeta?.color ?? '#444' }}>
        {raceLabel || card.race}
      </span>
    : null;

  // Rarity text (inside art area, bottom-right)
  const rarMeta = card.rarity ? getRarityById(card.rarity) : undefined;
  const rarityText = card.rarity
    ? <span className={styles.rarityText}
            style={{ color: rarMeta?.color ?? '#aaa' }}>
        {rarMeta?.value ?? ''}
      </span>
    : null;

  // Type / subtype line
  const typeSubtypeStr = isMonster && raceLabel
    ? `[${typeLabel} / ${raceLabel}]`
    : `[${typeLabel}]`;

  // Stats bar
  const equipAtkB = card.atkBonus ?? 0;
  const equipDefB = card.defBonus ?? 0;
  const eqReq = isEquipment ? card.equipRequirement : undefined;
  const eqReqLabel = eqReq
    ? [eqReq.race && getRaceById(eqReq.race)?.value, eqReq.attr && getAttrById(eqReq.attr)?.value].filter(Boolean).join(' / ')
    : '';
  const statsBar = isMonster
    ? <div className={styles.cardStats}>
        <span className={`${styles.atkVal}${atkStatCls ? ` ${atkStatCls}` : ''}`}>ATK: {effATK}</span>
        <span className={`${styles.defVal}${defStatCls ? ` ${defStatCls}` : ''}`}>DEF: {effDEF}</span>
      </div>
    : isEquipment
    ? <div className={styles.cardStats}>
        {equipAtkB !== 0 && <span className={styles.atkVal}>ATK {equipAtkB >= 0 ? '+' : ''}{equipAtkB}</span>}
        {equipDefB !== 0 && <span className={styles.defVal}>DEF {equipDefB >= 0 ? '+' : ''}{equipDefB}</span>}
      </div>
    : <div className={`${styles.cardStats} ${styles.noStats}`} />;

  const tCss = typeCss(card);
  const aCss = attrCssKey(card.attribute);

  const cls = [
    'card',
    `${tCss}-card`,
    `attr-${aCss}`,
    big ? 'big-card' : '',
    small ? 'small-card' : '',
    extraClass,
  ].filter(Boolean).join(' ');

  // Small layout: artwork + ATK/DEF + name
  if (small) {
    return (
      <div className={cls}>
        <div className={styles.cardArt} style={artStyle}>
          {raceBadge}
        </div>
        {isMonster
          ? <div className={styles.cardStats}>
              <span className={`${styles.atkVal}${atkStatCls ? ` ${atkStatCls}` : ''}`}>{effATK}</span>
              <span className={`${styles.defVal}${defStatCls ? ` ${defStatCls}` : ''}`}>{effDEF}</span>
            </div>
          : isEquipment
          ? <div className={styles.cardStats}>
              {equipAtkB !== 0 && <span className={styles.atkVal}>{equipAtkB >= 0 ? '+' : ''}{equipAtkB}</span>}
              {equipDefB !== 0 && <span className={styles.defVal}>{equipDefB >= 0 ? '+' : ''}{equipDefB}</span>}
            </div>
          : <div className={styles.cardStats}>
              <span className={styles.typeLabel}>{typeLabel}</span>
            </div>}
        <div className={styles.cardNameSmall}>{card.name}</div>
      </div>
    );
  }

  return (
    <div className={cls}>
      <div className={styles.cardHeader}>
        <span className={styles.nameShort}>{card.name}</span>
        {attrOrb}
      </div>
      <div className={styles.cardLevel}>{levelStars}</div>
      <div className={styles.cardArt} style={artStyle}>
        {raceBadge}
        {rarityText}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.typeSubtype}>{typeSubtypeStr}</div>
        <div className={styles.descText}>{big && card.description ? highlightCardText(card.description) : (card.description || '')}</div>
      </div>
      {statsBar}
      {eqReqLabel && <div className={styles.equipReq}>{eqReqLabel} only</div>}
    </div>
  );
}

// Re-export CSS helpers for use by other components
export function TYPE_CSS_FN(card: CardData): string { return typeCss(card); }
export function ATTR_CSS_FN(attr: number | undefined): string { return attrCssKey(attr); }

/** Card-aware CSS class: distinguishes normal vs effect monsters */
export function cardTypeCss(card: CardData): string { return typeCss(card); }

// Backward-compatible record-style exports — NOTE: cannot distinguish normal/effect.
// Prefer cardTypeCss(card) for monster cards.
export const TYPE_CSS: Record<number, string> = new Proxy({} as Record<number, string>, {
  get(_t, prop) { return getCardTypeById(Number(prop))?.key.toLowerCase() ?? 'monster'; },
});
export const ATTR_CSS: Record<number, string> = new Proxy({} as Record<number, string>, {
  get(_t, prop) { return getAttrById(Number(prop))?.key ?? 'spell'; },
});

/**
 * @deprecated Use <Card> React component instead.
 * WARNING: This function returns HTML string that requires careful handling.
 * The output is escaped for XSS prevention, but prefer React components
 * which automatically escape all content.
 * Only use this function for legacy purposes where DOM insertion is controlled.
 */
export function cardInnerHTML(card: CardData, _dimmed = false, _rotated = false, fc: FieldCard | null = null): string {
  const isMonsterLevelH = card.type === CardType.Monster || card.type === CardType.Fusion;
  const isEquipmentH = card.type === CardType.Equipment;
  const levelStars = isMonsterLevelH && card.level ? '\u2605'.repeat(Math.min(card.level, 12)) : '';
  const attrMeta   = card.attribute ? getAttrById(card.attribute) : undefined;
  const attrSym    = attrMeta?.symbol ?? '\u2726';
  const typeLabel  = getTypeLabel(card);
  const phUrl = getPlaceholderUrl(card);
  const artStyleStr = phUrl
    ? `background-image:url(${phUrl});background-size:cover;background-position:center`
    : '';
  const baseATK    = card.atk ?? 0;
  const baseDEF    = card.def ?? 0;
  const effATK     = fc ? fc.effectiveATK() : baseATK;
  const effDEF     = fc ? fc.effectiveDEF() : baseDEF;
  const atkClsH    = fc ? (effATK > baseATK ? ' stat-buffed' : effATK < baseATK ? ' stat-nerfed' : '') : '';
  const defClsH    = fc ? (effDEF > baseDEF ? ' stat-buffed' : effDEF < baseDEF ? ' stat-nerfed' : '') : '';

  const isMonster  = card.atk !== undefined && !isEquipmentH;
  const orbColor   = attrMeta?.color ?? '#444';
  const orbHTML    = card.attribute
    ? `<span class="card-attr-orb" style="background:${orbColor}">${attrSym}</span>`
    : '';

  const raceMeta   = card.race ? getRaceById(card.race) : undefined;
  const raceColor  = raceMeta?.color ?? '#444';
  const raceLabel  = raceMeta?.value ?? '';
  const raceBadge  = card.race
    ? `<span class="card-race-badge" style="background:${raceColor}">${raceLabel || card.race}</span>`
    : '';

  const rarMeta     = card.rarity ? getRarityById(card.rarity) : undefined;
  const rarityColor = rarMeta?.color ?? '#aaa';
  const rarityTextH = card.rarity
    ? `<span class="card-rarity-text" style="color:${rarityColor}">${rarMeta?.value ?? ''}</span>`
    : '';

  const typeSubtypeStr = isMonster && raceLabel
    ? `[${typeLabel} / ${raceLabel}]`
    : `[${typeLabel}]`;

  const eqAtkB = card.atkBonus ?? 0;
  const eqDefB = card.defBonus ?? 0;
  const statsHTML = isMonster
    ? `<div class="card-stats">
        <span class="card-atk-val${atkClsH}">ATK: ${effATK}</span>
        <span class="card-def-val${defClsH}">DEF: ${effDEF}</span>
       </div>`
    : isEquipmentH
    ? `<div class="card-stats">
        ${eqAtkB !== 0 ? `<span class="card-atk-val">ATK ${eqAtkB >= 0 ? '+' : ''}${eqAtkB}</span>` : ''}
        ${eqDefB !== 0 ? `<span class="card-def-val">DEF ${eqDefB >= 0 ? '+' : ''}${eqDefB}</span>` : ''}
       </div>`
    : `<div class="card-stats card-no-stats"></div>`;

  return `
    <div class="card-header">
      <span class="card-name-short">${card.name}</span>${orbHTML}
    </div>
    <div class="card-level">${levelStars}</div>
    <div class="card-art"${artStyleStr ? ` style="${artStyleStr}"` : ''}>
      ${raceBadge}${rarityTextH}
    </div>
    <div class="card-body">
      <div class="card-type-subtype">${typeSubtypeStr}</div>
      <div class="card-desc-text">${card.description ? highlightCardTextHTML(card.description) : ''}</div>
    </div>
    ${statsHTML}
  `;
}
