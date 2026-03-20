// ============================================================
// Card — visual component that mirrors cardInnerHTML()
// ============================================================
import { ATTR_SYMBOL, RARITY_COLOR, RARITY_NAME } from '../../cards.js';

const TYPE_LABEL: Record<string, string> = {
  normal: 'Normal', effect: 'Effekt', fusion: 'Fusion', spell: 'Zauber', trap: 'Falle',
};
const RACE_ABBR: Record<string, string> = {
  feuer:'Feue', drache:'Drag', flug:'Flug', stein:'Stei', pflanze:'Pflz',
  krieger:'Krie', magier:'Magi', elfe:'Elfe', daemon:'Dämo', wasser:'Wass',
};
const RACE_COLORS: Record<string, string> = {
  feuer:'#e05030', drache:'#8040c0', flug:'#4090c0', stein:'#808060',
  pflanze:'#40a050', krieger:'#c09030', magier:'#6060c0', elfe:'#90c060',
  daemon:'#804090', wasser:'#3080b0',
};

interface Props {
  card: any;
  fc?: any | null;
  dimmed?: boolean;
  rotated?: boolean;
  big?: boolean;
  extraClass?: string;
}

export function Card({ card, fc = null, dimmed = false, rotated = false, big = false, extraClass = '' }: Props) {
  const levelStars = card.level ? '★'.repeat(Math.min(card.level, 12)) : '';
  const attrSym    = ATTR_SYMBOL[card.attribute] || '✦';
  const typeLabel  = TYPE_LABEL[card.type] || '';
  const effATK     = fc ? fc.effectiveATK() : (card.atk ?? 0);
  const effDEF     = fc ? fc.effectiveDEF() : (card.def ?? 0);
  const boosted    = fc && (fc.permATKBonus || fc.tempATKBonus);

  const raceBadge = card.race
    ? <span className="card-race-badge" style={{ background: RACE_COLORS[card.race] || '#444' }}>
        {RACE_ABBR[card.race] || card.race.slice(0, 4)}
      </span>
    : null;

  const rarityPip = card.rarity
    ? <span className="card-rarity-pip"
            style={{ background: RARITY_COLOR[card.rarity] || '#aaa' }}
            title={RARITY_NAME[card.rarity] || ''} />
    : null;

  const statsEl = card.atk !== undefined
    ? <div className={`card-stats${boosted ? ' stat-boosted' : ''}`}>
        <div className="stat-row">
          <span className="stat-label atk-label">ATK</span>
          <span className="stat-val">{effATK}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label def-label">DEF</span>
          <span className="stat-val">{effDEF}</span>
        </div>
      </div>
    : <div className="card-stats no-stats">
        <span className="type-badge-big">{typeLabel}</span>
      </div>;

  const cls = [
    'card',
    `${card.type}-card`,
    `attr-${card.attribute || 'spell'}`,
    big ? 'big-card' : '',
    extraClass,
  ].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      <div className="card-header">
        <span className="card-name-short">{card.name}</span>
        {raceBadge}
        <span className="card-attr">{rarityPip}{attrSym}</span>
      </div>
      <div className="card-art">
        <div className="art-attr-symbol">{attrSym}</div>
        <div className="type-badge">{typeLabel}</div>
      </div>
      <div className="card-level">{levelStars}</div>
      {statsEl}
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

  const raceAbbr   = RACE_ABBR[card.race] || (card.race ? card.race.slice(0, 4) : '');
  const raceColor  = RACE_COLORS[card.race] || '#444';
  const raceBadge  = card.race
    ? `<span class="card-race-badge" style="background:${raceColor}">${raceAbbr}</span>` : '';
  const rarityPip  = card.rarity
    ? `<span class="card-rarity-pip" style="background:${RARITY_COLOR[card.rarity] || '#aaa'}"></span>` : '';

  const statsHTML = card.atk !== undefined
    ? `<div class="card-stats${boosted ? ' stat-boosted' : ''}">
        <div class="stat-row"><span class="stat-label atk-label">ATK</span><span class="stat-val">${effATK}</span></div>
        <div class="stat-row"><span class="stat-label def-label">DEF</span><span class="stat-val">${effDEF}</span></div>
       </div>`
    : `<div class="card-stats no-stats"><span class="type-badge-big">${typeLabel}</span></div>`;

  return `
    <div class="card-header">
      <span class="card-name-short">${card.name}</span>${raceBadge}
      <span class="card-attr">${rarityPip}${attrSym}</span>
    </div>
    <div class="card-art">
      <div class="art-attr-symbol">${attrSym}</div>
      <div class="type-badge">${typeLabel}</div>
    </div>
    <div class="card-level">${levelStars}</div>
    ${statsHTML}
  `;
}
