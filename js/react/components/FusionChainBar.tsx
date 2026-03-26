import { useTranslation } from 'react-i18next';
import { CARD_DB } from '../../cards.js';
import type { FusionChainResult } from '../../cards.js';
import type { CardData } from '../../types.js';

interface Props {
  hand: CardData[];
  chain: number[];
  preview: FusionChainResult | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function FusionChainBar({ hand, chain, preview, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();

  const finalCard = preview ? CARD_DB[preview.finalCardId] : (chain.length === 1 ? hand[chain[0]] : null);

  return (
    <div className="fusion-chain-bar">
      <div className="fusion-chain-cards">
        {chain.map((handIdx, i) => {
          const card = hand[handIdx];
          if (!card) return null;
          return (
            <span key={i} className="chain-card-name">
              {i > 0 && <span className="chain-arrow">+</span>}
              {card.name}
            </span>
          );
        })}
        {finalCard && chain.length >= 1 && (
          <>
            <span className="chain-arrow">=</span>
            <span className="chain-result-name">{finalCard.name}</span>
            {finalCard.atk !== undefined && (
              <span className="chain-result-stats">
                (ATK {finalCard.atk})
              </span>
            )}
          </>
        )}
      </div>
      {preview && preview.steps.length > 0 && (
        <div className="fusion-chain-steps">
          {preview.steps.map((step, i) => {
            const stepClass = step.fused ? 'chain-step-fused' : 'chain-step-fallback';
            const label = step.fused
              ? t('fusion_chain.step_fused')
              : step.discardedId
                ? t('fusion_chain.step_discarded', { name: CARD_DB[step.discardedId]?.name ?? '?' })
                : '';
            return (
              <span key={i} className={`chain-step ${stepClass}`}>
                {label}
              </span>
            );
          })}
        </div>
      )}
      <div className="fusion-chain-actions">
        <button
          className="menu-action-btn chain-confirm-btn"
          disabled={chain.length === 0}
          onClick={onConfirm}
        >
          {chain.length >= 2 ? t('fusion_chain.confirm') : t('fusion_chain.summon')}
        </button>
        <button className="btn-cancel" onClick={onCancel}>
          {t('fusion_chain.cancel')}
        </button>
      </div>
    </div>
  );
}
