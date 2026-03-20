// ============================================================
// Card — visual component that mirrors cardInnerHTML()
// ============================================================
import { ATTR_SYMBOL, RARITY_COLOR, RARITY_NAME } from '../../cards.js';
import styles from './Card.module.css';

const TYPE_LABEL: Record<string, string> = {
  normal: 'Normal', effect: 'Effekt', fusion: 'Fusion', spell: 'Zauber', trap: 'Falle',
};
const RACE_ABBR: Record<string, string> = {
  feuer:'Feuer', drache:'Drache', flug:'Flug', stein:'Stein', pflanze:'Pflanze',
  krieger:'Krieger', magier:'Magier', elfe:'Elfe', daemon:'Dämon', wasser:'Wasser',
};
const RACE_COLORS: Record<string, string> = {
  feuer:'#e05030', drache:'#8040c0', flug:'#4090c0', stein:'#808060',
  pflanze:'#40a050', krieger:'#c09030', magier:'#6060c0', elfe:'#90c060',
  daemon:'#804090', wasser:'#3080b0',
};
const ATTR_ORB_COLORS: Record<string, string> = {
  fire: '#c0300a', water: '#1a6aaa', earth: '#6a7030',
  wind: '#4a6080', light: '#c09000', dark: '#7020a0',
};

interface Props {
  card: any;
  fc?: any | null;
  dimmed?: boolean;
  rotated?: boolean;
  big?: boolean;
  small?: boolean;
  extraClass?: string;
}

export function Card({ card, fc = null, dimmed = false, rotated = false, big = false, small = false, extraClass = '' }: Props) {
  const levelStars = card.level ? '★'.repeat(Math.min(card.level, 12)) : '';
  const attrSym    = ATTR_SYMBOL[card.attribute] || '✦';
  const typeLabel  = TYPE_LABEL[card.type] || '';
  const effATK     = fc ? fc.effectiveATK() : (card.atk ?? 0);
  const effDEF     = fc ? fc.effectiveDEF() : (card.def ?? 0);
  const boosted    = fc && (fc.permATKBonus || fc.tempATKBonus);

  const isMonster = card.atk !== undefined;

  // Attribute orb (top-right)
  const orbColor = ATTR_ORB_COLORS[card.attribute] || '#444';
  const attrOrb = card.attribute
    ? <span className={styles.attrOrb} style={{ background: orbColor }}>{attrSym}</span>
    : null;

  // Race badge (inside art area, top-left)
  const raceBadge = card.race
    ? <span className={styles.raceBadge} style={{ background: RACE_COLORS[card.race] || '#444' }}>
        {RACE_ABBR[card.race] || card.race}
      </span>
    : null;

  // Rarity text (inside art area, bottom-right)
  const rarityText = card.rarity
    ? <span className={styles.rarityText}
            style={{ color: RARITY_COLOR[card.rarity] || '#aaa' }}>
        {RARITY_NAME[card.rarity] || ''}
      </span>
    : null;

  // Type / subtype line
  const raceLabel = card.race ? (RACE_ABBR[card.race] || card.race) : '';
  const typeSubtypeStr = isMonster && raceLabel
    ? `[${typeLabel} / ${raceLabel}]`
    : `[${typeLabel}]`;

  // Stats bar
  const statsBar = isMonster
    ? <div className={`${styles.cardStats}${boosted ? ` ${styles.statBoosted}` : ''}`}>
        <span className={styles.atkVal}>ATK: {effATK}</span>
        <span className={styles.defVal}>DEF: {effDEF}</span>
      </div>
    : <div className={`${styles.cardStats} ${styles.noStats}`} />;

  const cls = [
    'card',
    `${card.type}-card`,
    `attr-${card.attribute || 'spell'}`,
    big ? 'big-card' : '',
    small ? 'small-card' : '',
    extraClass,
  ].filter(Boolean).join(' ');

  // Small layout: only artwork area + ATK/DEF
  if (small) {
    return (
      <div className={cls}>
        <div className={styles.cardArt} />
        {isMonster
          ? <div className={styles.cardStats}>
              <span className={styles.atkVal}>ATK: {effATK}</span>
              <span className={styles.defVal}>DEF: {effDEF}</span>
            </div>
          : null}
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
      <div className={styles.cardArt}>
        {raceBadge}
        {rarityText}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.typeSubtype}>{typeSubtypeStr}</div>
        <div className={styles.descText}>{card.description || ''}</div>
      </div>
      {statsBar}
    </div>
  );
}

/** Pure helper used by modules that need the inner HTML string for legacy canvas/clone operations */
export function cardInnerHTML(card: any, _dimmed = false, _rotated = false, fc: any = null): string {
  const levelStars = card.level ? '★'.repeat(Math.min(card.level, 12)) : '';
  const attrSym    = ATTR_SYMBOL[card.attribute] || '✦';
  const typeLabel  = TYPE_LABEL[card.type] || '';
  const effATK     = fc ? fc.effectiveATK() : (card.atk ?? 0);
  const effDEF     = fc ? fc.effectiveDEF() : (card.def ?? 0);
  const boosted    = fc && (fc.permATKBonus || fc.tempATKBonus);

  const isMonster  = card.atk !== undefined;
  const orbColor   = ATTR_ORB_COLORS[card.attribute] || '#444';
  const orbHTML    = card.attribute
    ? `<span class="card-attr-orb" style="background:${orbColor}">${attrSym}</span>`
    : '';

  const raceColor  = RACE_COLORS[card.race] || '#444';
  const raceLabel  = card.race ? (RACE_ABBR[card.race] || card.race) : '';
  const raceBadge  = card.race
    ? `<span class="card-race-badge" style="background:${raceColor}">${raceLabel}</span>`
    : '';

  const rarityColor = RARITY_COLOR[card.rarity] || '#aaa';
  const rarityText  = card.rarity
    ? `<span class="card-rarity-text" style="color:${rarityColor}">${RARITY_NAME[card.rarity] || ''}</span>`
    : '';

  const typeSubtypeStr = isMonster && raceLabel
    ? `[${typeLabel} / ${raceLabel}]`
    : `[${typeLabel}]`;

  const statsHTML = isMonster
    ? `<div class="card-stats${boosted ? ' stat-boosted' : ''}">
        <span class="card-atk-val">ATK: ${effATK}</span>
        <span class="card-def-val">DEF: ${effDEF}</span>
       </div>`
    : `<div class="card-stats card-no-stats"></div>`;

  return `
    <div class="card-header">
      <span class="card-name-short">${card.name}</span>${orbHTML}
    </div>
    <div class="card-level">${levelStars}</div>
    <div class="card-art">
      ${raceBadge}${rarityText}
    </div>
    <div class="card-body">
      <div class="card-type-subtype">${typeSubtypeStr}</div>
      <div class="card-desc-text">${card.description || ''}</div>
    </div>
    ${statsHTML}
  `;
}
