import type { CardData, FieldCard } from '../../../types.js';
import { CardType } from '../../../types.js';
import { getCardTypeById, getAttrById, getRaceById, getRarityById } from '../../../type-metadata.js';
import { highlightCardTextHTML } from '../../utils/highlightCardText.js';
import { getCardTokens, type CardSize } from './CardTokens.js';

interface RenderCardOptions {
  card: CardData;
  dimmed?: boolean;
  rotated?: boolean;
  fc?: FieldCard | null;
  size?: CardSize;
  layout?: 'full' | 'compact';
}

function typeCss(card: CardData): string {
  if (card.type === CardType.Monster) return card.effect ? 'effect-card' : 'normal-card';
  return `${getCardTypeById(card.type)?.key.toLowerCase() ?? 'monster'}-card`;
}

function attrCssKey(attr: number | undefined): string {
  if (!attr) return 'spell';
  return getAttrById(attr)?.key ?? 'spell';
}

function getPlaceholderUrl(card: CardData): string | null {
  switch (card.type) {
    case CardType.Monster: return './img/placeholders/monster.svg';
    case CardType.Fusion:  return './img/placeholders/fusion.svg';
    case CardType.Trap:    return './img/placeholders/trap.svg';
    case CardType.Equipment: return './img/placeholders/equipment.svg';
    case CardType.Spell:   return card.spellType === 'field' ? './img/placeholders/field-spell.svg' : './img/placeholders/spell.svg';
    default: return null;
  }
}

export function renderCardToString({ card, dimmed = false, rotated = false, fc = null, size = 'sm', layout = 'full' }: RenderCardOptions): string {
  const tokens = getCardTokens(size);
  const isMonster = card.atk !== undefined && card.type !== CardType.Equipment;
  const isEquipment = card.type === CardType.Equipment;
  const baseATK = card.atk ?? 0;
  const baseDEF = card.def ?? 0;
  const effATK = fc ? fc.effectiveATK() : baseATK;
  const effDEF = fc ? fc.effectiveDEF() : baseDEF;

  const tCss = typeCss(card);
  const aCss = `attr${attrCssKey(card.attribute).charAt(0).toUpperCase() + attrCssKey(card.attribute).slice(1)}`;
  const width = tokens.width;
  const height = tokens.height;

  let extraStyle = '';
  if (dimmed) extraStyle += 'opacity:0.5;filter:grayscale(35%);';
  if (rotated) extraStyle += 'transform:rotate(90deg);';

  if (layout === 'compact') {
    const ph = getPlaceholderUrl(card);
    const artStyle = ph ? `background-image:url(${ph});background-size:cover;background-position:center;` : '';
    const raceMeta = card.race ? getRaceById(card.race) : undefined;
    const raceBadge = card.race
      ? `<span style="position:absolute;top:2px;left:2px;font-size:${tokens.badgeFont}px;font-weight:bold;background:${raceMeta?.color ?? '#444'};color:rgba(255,255,255,0.9);padding:${tokens.badgePaddingV}px ${tokens.badgePaddingH}px;z-index:1;">${(raceMeta?.value ?? '') || card.race}</span>`
      : '';
    let statsHtml = '';
    if (isMonster) {
      const atkColor = fc ? (effATK > baseATK ? 'color:#88ff88;' : effATK < baseATK ? 'color:#ff6666;' : '') : '';
      const defColor = fc ? (effDEF > baseDEF ? 'color:#88ff88;' : effDEF < baseDEF ? 'color:#ff6666;' : '') : '';
      statsHtml = `<div style="display:flex;gap:0;padding:0;border-top:1px solid #303030;background:#000;flex-shrink:0;"><span style="flex:1;text-align:center;padding:3px 0;font-size:${tokens.fontStats}px;font-weight:bold;${atkColor}border-right:1px solid #303030;font-family:var(--font-stats);">${effATK}</span><span style="flex:1;text-align:center;padding:3px 0;font-size:${tokens.fontStats}px;font-weight:bold;${defColor}font-family:var(--font-stats);">${effDEF}</span></div>`;
    } else if (isEquipment) {
      const eqA = card.atkBonus ?? 0;
      const eqD = card.defBonus ?? 0;
      const eqParts: string[] = [];
      if (eqA !== 0) eqParts.push(`<span style="font-size:${tokens.fontStats}px;font-weight:bold;color:#ff9955;">ATK ${eqA >= 0 ? '+' : ''}${eqA}</span>`);
      if (eqD !== 0) eqParts.push(`<span style="font-size:${tokens.fontStats}px;font-weight:bold;color:#55aaff;">DEF ${eqD >= 0 ? '+' : ''}${eqD}</span>`);
      statsHtml = eqParts.length
        ? `<div style="display:flex;gap:${tokens.statsGap}px;padding:${tokens.statsPaddingV}px ${tokens.statsPaddingH}px;background:#000;flex-shrink:0;">${eqParts.join('')}</div>`
        : `<div style="background:#000;flex-shrink:0;min-height:0;padding:0;"></div>`;
    } else {
      const typeLabel = getCardTypeById(card.type)?.value ?? '';
      statsHtml = `<div style="display:flex;gap:0;padding:0;background:#000;flex-shrink:0;"><span style="flex:1;text-align:center;padding:3px 0;font-size:${tokens.fontStats}px;font-weight:bold;color:#7090b0;">${typeLabel}</span></div>`;
    }

    return `<div class="cardFrame ${tCss} ${aCss}" style="width:${width}px;height:${height}px;border-radius:0;display:flex;flex-direction:column;overflow:hidden;position:relative;z-index:1;border:2px solid rgba(200,180,100,0.4);flex-shrink:0;background:var(--bg,#060e0a);${extraStyle}"><div style="aspect-ratio:1/1;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:0;border:1px solid rgba(255,255,255,0.2);border-radius:2px;width:calc(100% - ${tokens.artMargin * 2}px);margin:${tokens.artMargin}px;${artStyle}">${raceBadge}</div>${statsHtml}<div style="font-size:${tokens.fontNameSmall}px;font-weight:bold;color:var(--gold-light,#e0c870);text-align:center;padding:2px 3px 3px;background:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;">${card.name}</div></div>`;
  }

  // full layout
  const ph = getPlaceholderUrl(card);
  const artStyle = ph ? `background-image:url(${ph});background-size:cover;background-position:center;` : '';
  const attrMeta = card.attribute ? getAttrById(card.attribute) : undefined;
  const attrSym = attrMeta?.symbol ?? '\u2726';
  const orbColor = attrMeta?.color ?? '#444';
  const orbHtml = card.attribute
    ? `<span style="width:${tokens.orbSize}px;height:${tokens.orbSize}px;border-radius:0;display:flex;align-items:center;justify-content:center;font-size:${tokens.orbFont}px;color:#fff;flex-shrink:0;border:1px solid rgba(255,255,255,0.4);line-height:1;background:${orbColor};">${attrSym}</span>`
    : '';

  const isMonLevel = card.type === CardType.Monster || card.type === CardType.Fusion;
  const levelStars = isMonLevel && card.level ? '\u2605'.repeat(Math.min(card.level, 12)) : '';
  const raceMeta = card.race ? getRaceById(card.race) : undefined;
  const raceBadge = card.race
    ? `<span style="position:absolute;top:2px;left:2px;font-size:${tokens.badgeFont}px;font-weight:bold;background:${raceMeta?.color ?? '#444'};color:rgba(255,255,255,0.9);padding:${tokens.badgePaddingV}px ${tokens.badgePaddingH}px;z-index:1;">${(raceMeta?.value ?? '') || card.race}</span>`
    : '';
  const rarMeta = card.rarity ? getRarityById(card.rarity) : undefined;
  const rarityText = card.rarity
    ? `<span style="position:absolute;bottom:2px;right:3px;font-size:${tokens.badgeFont}px;font-weight:bold;color:${rarMeta?.color ?? '#aaa'};letter-spacing:0.3px;text-shadow:0 1px 2px rgba(0,0,0,0.8);pointer-events:none;z-index:1;">${rarMeta?.value ?? ''}</span>`
    : '';

  const typeLabel =
    card.type === CardType.Monster && card.effect
      ? 'Effect'
      : getCardTypeById(card.type)?.value ?? '';
  const raceLabel = raceMeta?.value ?? '';
  const typeSubtypeStr = isMonster && raceLabel ? `[${typeLabel} / ${raceLabel}]` : `[${typeLabel}]`;

  const descHtml = card.description ? highlightCardTextHTML(card.description) : '';

  let statsHtml = '';
  if (isMonster) {
    const atkCls = fc ? (effATK > baseATK ? 'color:#88ff88;' : effATK < baseATK ? 'color:#ff6666;' : '') : '';
    const defCls = fc ? (effDEF > baseDEF ? 'color:#88ff88;' : effDEF < baseDEF ? 'color:#ff6666;' : '') : '';
    statsHtml = `<div style="display:flex;gap:${tokens.statsGap}px;padding:${tokens.statsPaddingV}px ${tokens.statsPaddingH}px;background:#000;flex-shrink:0;"><span style="font-size:${tokens.fontStats}px;font-weight:bold;color:#ff9955;${atkCls}font-family:var(--font-stats);">ATK: ${effATK}</span><span style="font-size:${tokens.fontStats}px;font-weight:bold;color:#55aaff;${defCls}font-family:var(--font-stats);">DEF: ${effDEF}</span></div>`;
  } else if (isEquipment) {
    const eqA = card.atkBonus ?? 0;
    const eqD = card.defBonus ?? 0;
    const eqParts: string[] = [];
    if (eqA !== 0) eqParts.push(`<span style="font-size:${tokens.fontStats}px;font-weight:bold;color:#ff9955;">ATK ${eqA >= 0 ? '+' : ''}${eqA}</span>`);
    if (eqD !== 0) eqParts.push(`<span style="font-size:${tokens.fontStats}px;font-weight:bold;color:#55aaff;">DEF ${eqD >= 0 ? '+' : ''}${eqD}</span>`);
    statsHtml = eqParts.length
      ? `<div style="display:flex;gap:${tokens.statsGap}px;padding:${tokens.statsPaddingV}px ${tokens.statsPaddingH}px;background:#000;flex-shrink:0;">${eqParts.join('')}</div>`
      : `<div style="background:#000;flex-shrink:0;min-height:0;padding:0;"></div>`;
  } else {
    statsHtml = `<div style="background:#000;flex-shrink:0;min-height:0;padding:0;"></div>`;
  }

  return `<div class="cardFrame ${tCss} ${aCss}" style="width:${width}px;height:${height}px;border-radius:0;display:flex;flex-direction:column;overflow:hidden;position:relative;z-index:1;border:2px solid rgba(200,180,100,0.4);flex-shrink:0;background:var(--bg,#060e0a);${extraStyle}"><div style="display:flex;justify-content:space-between;align-items:center;min-height:0;flex-shrink:0;background:#000;padding:2px ${tokens.bodyPaddingH}px;"><span style="font-size:${tokens.fontName}px;font-weight:bold;color:var(--gold-light);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1;line-height:1.2;">${card.name}</span>${orbHtml}</div><div style="color:var(--gold);text-align:center;line-height:1;letter-spacing:-1px;flex-shrink:0;font-size:${tokens.fontLevel}px;padding:1px 2px;min-height:${tokens.fontLevel + 3}px;">${levelStars}</div><div style="aspect-ratio:1/1;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:0;border:1px solid rgba(255,255,255,0.2);border-radius:2px;width:calc(100% - ${tokens.artMargin * 2}px);margin:${tokens.artMargin}px;${artStyle}">${raceBadge}${rarityText}</div><div style="padding:${tokens.bodyPaddingV}px ${tokens.bodyPaddingH}px;display:flex;flex-direction:column;background:#080808;border-top:1px solid #303030;flex-shrink:0;overflow:hidden;max-height:${tokens.bodyMaxHeight}px;gap:${tokens.artGap}px;"><div style="color:var(--text-dim);font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;font-size:${tokens.fontType}px;">${typeSubtypeStr}</div><div style="color:var(--text);line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;font-size:${tokens.fontDesc}px;-webkit-line-clamp:2;">${descHtml}</div></div>${statsHtml}</div>`;
}

/**
 * Backward-compatible wrapper around `renderCardToString` with the old function signature.
 * @deprecated Use `renderCardToString` directly.
 */
export function cardInnerHTMLLegacy(
  card: CardData,
  dimmed = false,
  rotated = false,
  fc: FieldCard | null = null,
): string {
  return renderCardToString({ card, dimmed, rotated, fc, size: 'sm', layout: 'full' });
}
