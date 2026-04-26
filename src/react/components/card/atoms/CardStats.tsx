import { CardType } from '../../../../types.js';
import type { CardData, FieldCard } from '../../../../types.js';
import type { CardSizeTokens } from '../CardTokens.js';
import styles from './CardStats.module.css';

interface CardStatsProps {
  card: CardData;
  fc?: FieldCard | null;
  tokens: CardSizeTokens;
  compact?: boolean;
}

export function CardStats({ card, fc = null, tokens, compact = false }: CardStatsProps) {
  const isMonster = card.atk !== undefined && card.type !== CardType.Equipment;
  const isEquipment = card.type === CardType.Equipment;
  const baseATK = card.atk ?? 0;
  const baseDEF = card.def ?? 0;
  const effATK = fc ? fc.effectiveATK() : baseATK;
  const effDEF = fc ? fc.effectiveDEF() : baseDEF;
  const atkCls = fc ? (effATK > baseATK ? ` ${styles.statBuffed}` : effATK < baseATK ? ` ${styles.statNerfed}` : '') : '';
  const defCls = fc ? (effDEF > baseDEF ? ` ${styles.statBuffed}` : effDEF < baseDEF ? ` ${styles.statNerfed}` : '') : '';
  const labelStyle = { fontSize: tokens.fontStats };

  if (isMonster) {
    if (compact) {
      return (
        <div className={styles.cardStats} style={{ gap: 0, padding: 0, borderTop: '1px solid #303030' }}>
          <span className={`${styles.atkVal}${atkCls}`} style={{ ...labelStyle, flex: 1, textAlign: 'center', padding: '3px 0', borderRight: '1px solid #303030' }}>{effATK}</span>
          <span className={`${styles.defVal}${defCls}`} style={{ ...labelStyle, flex: 1, textAlign: 'center', padding: '3px 0' }}>{effDEF}</span>
        </div>
      );
    }
    return (
      <div className={styles.cardStats} style={{ padding: `${tokens.statsPaddingV}px ${tokens.statsPaddingH}px`, gap: tokens.statsGap }}>
        <span className={`${styles.atkVal}${atkCls}`} style={labelStyle}>ATK: {effATK}</span>
        <span className={`${styles.defVal}${defCls}`} style={labelStyle}>DEF: {effDEF}</span>
      </div>
    );
  }

  if (isEquipment) {
    const eqA = card.atkBonus ?? 0;
    const eqD = card.defBonus ?? 0;
    return (
      <div className={styles.cardStats} style={{ padding: `${tokens.statsPaddingV}px ${tokens.statsPaddingH}px`, gap: tokens.statsGap }}>
        {eqA !== 0 && <span className={styles.atkVal} style={labelStyle}>ATK {eqA >= 0 ? '+' : ''}{eqA}</span>}
        {eqD !== 0 && <span className={styles.defVal} style={labelStyle}>DEF {eqD >= 0 ? '+' : ''}{eqD}</span>}
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`${styles.cardStats} ${styles.noStats}`}>
        <span style={{ ...labelStyle, flex: 1, textAlign: 'center', padding: '3px 0', color: '#7090b0', fontWeight: 'bold' }}>
          {(() => { const { getCardTypeById } = require('../../../type-metadata.js'); return getCardTypeById(card.type)?.value ?? ''; })()}
        </span>
      </div>
    );
  }

  return <div className={`${styles.cardStats} ${styles.noStats}`} />;
}
