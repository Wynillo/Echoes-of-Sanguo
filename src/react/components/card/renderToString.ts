import { CardType, type CardData, type FieldCard } from '../../../types.js';
import { getCardTypeById, getAttrById, getRaceById, getRarityById } from '../../../type-metadata.js';
import { highlightCardTextHTML } from '../../utils/highlightCardText.js';

export type CardSize = 'sm' | 'md' | 'lg';

export interface RenderOptions {
  card: CardData;
  dimmed?: boolean;
  rotated?: boolean;
  fc?: FieldCard | null;
  size?: CardSize;
  layout?: 'full' | 'compact';
}

const SIZE_DIMENSIONS: Record<CardSize, { width: number; height: number }> = {
  sm: { width: 200, height: 290 },
  md: { width: 240, height: 348 },
  lg: { width: 280, height: 406 },
};

function getTypeClass(card: CardData): string {
  if (card.type === CardType.Monster) {
    return card.effect ? 'effect-card' : 'normal-card';
  }
  const typeMeta = getCardTypeById(card.type);
  const key = typeMeta?.key?.toLowerCase() ?? 'monster';
  return `${key}-card`;
}

function getAttrClass(card: CardData): string {
  const attr = card.attribute;
  if (!attr) return 'attr-spell';
  const attrMeta = getAttrById(attr);
  const key = attrMeta?.key ?? 'spell';
  return `attr-${key}`;
}

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
  if (card.type === CardType.Monster && card.effect) return 'Effect';
  return getCardTypeById(card.type)?.value ?? '';
}

function formatStatValue(base: number, effective: number): string {
  if (effective > base) return `<span style="color:#88ff88">${effective}</span>`;
  if (effective < base) return `<span style="color:#ff6666">${effective}</span>`;
  return String(effective);
}

export function renderCardToString(options: RenderOptions): string {
  const {
    card,
    dimmed = false,
    rotated = false,
    fc = null,
    size = 'sm',
    layout = 'full',
  } = options;

  const dimensions = SIZE_DIMENSIONS[size];
  const typeClass = getTypeClass(card);
  const attrClass = getAttrClass(card);
  const isMonster = card.type === CardType.Monster || card.type === CardType.Fusion;
  const isEquipment = card.type === CardType.Equipment;
  const levelStars = isMonster && card.level ? '\u2605'.repeat(Math.min(card.level, 12)) : '';
  const attrMeta = card.attribute ? getAttrById(card.attribute) : undefined;
  const attrSym = attrMeta?.symbol ?? '\u2726';
  const attrColor = attrMeta?.color ?? '#444';
  const typeLabel = getTypeLabel(card);
  const placeholderUrl = getPlaceholderUrl(card);
  const artStyle = placeholderUrl
    ? `background-image:url(${placeholderUrl});background-size:cover;background-position:center`
    : '';

  const raceMeta = card.race ? getRaceById(card.race) : undefined;
  const raceColor = raceMeta?.color ?? '#444';
  const raceLabel = raceMeta?.value ?? '';
  const raceBadge = card.race
    ? `<span class="card-race-badge" style="background:${raceColor}">${raceLabel || card.race}</span>`
    : '';

  const rarMeta = card.rarity ? getRarityById(card.rarity) : undefined;
  const rarityColor = rarMeta?.color ?? '#aaa';
  const rarityText = card.rarity
    ? `<span class="card-rarity-text" style="color:${rarityColor}">${rarMeta?.value ?? ''}</span>`
    : '';

  const baseATK = card.atk ?? 0;
  const baseDEF = card.def ?? 0;
  const effATK = fc ? fc.effectiveATK() : baseATK;
  const effDEF = fc ? fc.effectiveDEF() : baseDEF;

  const typeSubtypeStr = isMonster && raceLabel
    ? `[${typeLabel} / ${raceLabel}]`
    : `[${typeLabel}]`;

  const extraStyles: string[] = [];
  if (dimmed) {
    extraStyles.push('opacity:0.5;filter:grayscale(35%)');
  }
  if (rotated) {
    extraStyles.push('transform:rotate(90deg)');
  }
  const extraStyleStr = extraStyles.length > 0 ? `;${extraStyles.join(';')}` : '';

  if (layout === 'compact') {
    const compactStats = isMonster
      ? `<div class="card-stats-compact"><span>${formatStatValue(baseATK, effATK)}</span><span>${formatStatValue(baseDEF, effDEF)}</span></div>`
      : isEquipment
      ? `<div class="card-stats-compact"><span>${card.atkBonus ?? 0}</span><span>${card.defBonus ?? 0}</span></div>`
      : '';

    return `
<div class="cardFrame ${typeClass} ${attrClass}" style="width:${dimensions.width}px;height:${dimensions.height}px${extraStyleStr}">
  <div class="card-art"${artStyle ? ` style="${artStyle}"` : ''}>
    ${raceBadge}
  </div>
  ${compactStats}
  <div class="card-name-compact">${card.name}</div>
</div>`.trim();
  }

  const orbHTML = card.attribute
    ? `<span class="card-attr-orb" style="background:${attrColor}">${attrSym}</span>`
    : '';

  const statsHTML = isMonster
    ? `<div class="card-stats">
        <span class="card-atk-val${fc && effATK !== baseATK ? (effATK > baseATK ? ' stat-buffed' : ' stat-nerfed') : ''}">ATK: ${formatStatValue(baseATK, effATK)}</span>
        <span class="card-def-val${fc && effDEF !== baseDEF ? (effDEF > baseDEF ? ' stat-buffed' : ' stat-nerfed') : ''}">DEF: ${formatStatValue(baseDEF, effDEF)}</span>
       </div>`
    : isEquipment
    ? `<div class="card-stats">
        ${(card.atkBonus ?? 0) !== 0 ? `<span class="card-atk-val">ATK ${(card.atkBonus ?? 0) >= 0 ? '+' : ''}${card.atkBonus}</span>` : ''}
        ${(card.defBonus ?? 0) !== 0 ? `<span class="card-def-val">DEF ${(card.defBonus ?? 0) >= 0 ? '+' : ''}${card.defBonus}</span>` : ''}
       </div>`
    : `<div class="card-stats card-no-stats"></div>`;

  return `
<div class="cardFrame ${typeClass} ${attrClass}" style="width:${dimensions.width}px;height:${dimensions.height}px${extraStyleStr}">
  <div class="card-header">
    <span class="card-name-short">${card.name}</span>${orbHTML}
  </div>
  <div class="card-level">${levelStars}</div>
  <div class="card-art"${artStyle ? ` style="${artStyle}"` : ''}>
    ${raceBadge}${rarityText}
  </div>
  <div class="card-body">
    <div class="card-type-subtype">${typeSubtypeStr}</div>
    <div class="card-desc-text">${card.description ? highlightCardTextHTML(card.description) : ''}</div>
  </div>
  ${statsHTML}
</div>`.trim();
}

export function cardInnerHTMLLegacy(
  card: CardData,
  dimmed: boolean = false,
  rotated: boolean = false,
  fc: FieldCard | null = null
): string {
  return renderCardToString({
    card,
    dimmed,
    rotated,
    fc,
    size: 'sm',
    layout: 'full',
  });
}
