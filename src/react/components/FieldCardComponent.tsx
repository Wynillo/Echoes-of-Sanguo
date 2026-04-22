import { useTranslation } from 'react-i18next';
import { attachHover } from './hoverApi.js';
import { Card, cardTypeCss, ATTR_CSS } from './Card.js';
import type { FieldCard, CardData } from '../../types.js';

interface FieldCardComponentProps {
  fc: FieldCard;
  owner: 'player' | 'opponent';
  zone: number;
  selected: boolean;
  targetable: boolean;
  interactive: boolean;
  canAttack: boolean;
  viewable?: boolean;
  onOwnClick?: () => void;
  onAttackerSelect?: () => void;
  onDefenderClick?: () => void;
  onViewClick?: () => void;
  onDetail?: () => void;
}

const IS_TOUCH = window.matchMedia('(pointer: coarse)').matches;

export function FieldCardComponent({
  fc, owner, zone, selected, targetable, interactive, canAttack, viewable,
  onOwnClick, onAttackerSelect, onDefenderClick, onViewClick, onDetail,
}: FieldCardComponentProps) {
  const { t } = useTranslation();
  const { card } = fc;
  const isPlayer = owner === 'player';

  let cls: string;
  if (fc.faceDown && !isPlayer) {
    cls = `card field-card face-down${fc.position === 'def' ? ' pos-def' : ''}`;
  } else if (fc.faceDown && isPlayer) {
    cls = `card field-card face-down own-facedown attr-${card.attribute ? ATTR_CSS[card.attribute] || 'spell' : 'spell'}${fc.position === 'def' ? ' pos-def' : ''}`;
  } else {
    cls = `card field-card ${cardTypeCss(card)}-card attr-${card.attribute ? ATTR_CSS[card.attribute] || 'spell' : 'spell'} pos-${fc.position}`;
  }
  if (fc.hasAttacked && isPlayer) cls += ' exhausted';
  if (selected)    cls += ' selected';
  if (interactive) cls += ' interactive';
  if (canAttack)   cls += ' can-attack';
  if (targetable)  cls += ' targetable';
  if (viewable)    cls += ' viewable';

  function handleClick() {
    if (canAttack)     { onAttackerSelect?.(); return; }
    if (interactive)   { onOwnClick?.(); return; }
    if (targetable)    { onDefenderClick?.(); return; }
    if (viewable)      { onViewClick?.(); }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    if (!fc.faceDown || isPlayer) onDetail?.();
  }

  function attachRef(el: HTMLDivElement | null) {
    if (el && (!fc.faceDown || isPlayer)) attachHover(el, card, fc);
  }

  // Face-down opponent card
  if (fc.faceDown && !isPlayer) {
    return (
      <div className={cls} ref={attachRef} onClick={targetable ? onDefenderClick : undefined}>
        <div className="card-back-pattern"><span className="back-label">A</span></div>
      </div>
    );
  }

  // Face-down own card
  if (fc.faceDown && isPlayer) {
    return (
      <div className={cls} ref={attachRef} onClick={handleClick} onContextMenu={!IS_TOUCH ? handleContextMenu : undefined}>
        <Card card={card} fc={fc} small dimmed />
        <div className="facedown-overlay">{t('game.facedown')}</div>
      </div>
    );
  }

  const hasEquipment = fc.equippedCards && fc.equippedCards.length > 0;

  const passiveIcons: string[] = [];
  if (fc.indestructible) passiveIcons.push('\uD83D\uDEE1\uFE0F');
  if (fc.cannotBeAttacked) passiveIcons.push('\uD83D\uDEAB');
  if (fc.isEffectImmune)   passiveIcons.push('\u2726');
  if (fc.piercing)       passiveIcons.push('\u26A1');

  const effATK = fc.effectiveATK();
  const effDEF = fc.effectiveDEF();
  const atkBonus = effATK - (card.atk ?? 0);
  const defBonus = effDEF - (card.def ?? 0);
  const bonusTitle = card.atk !== undefined
    ? `ATK: ${card.atk}${atkBonus ? ` + ${atkBonus} = ${effATK}` : ''} | DEF: ${card.def ?? 0}${defBonus ? ` + ${defBonus} = ${effDEF}` : ''}`
    : undefined;

  return (
    <div className={cls} ref={attachRef} onClick={handleClick} onContextMenu={!IS_TOUCH ? handleContextMenu : undefined} title={bonusTitle}>
      <Card card={card} fc={fc} small />
      {hasEquipment && <span className="equip-badge" title={fc.equippedCards.map((e: { zone: number; card: CardData }) => e.card.name).join(', ')}>⚔</span>}
      {passiveIcons.length > 0 && (
        <span className="passive-badges">{passiveIcons.join('')}</span>
      )}
    </div>
  );
}
