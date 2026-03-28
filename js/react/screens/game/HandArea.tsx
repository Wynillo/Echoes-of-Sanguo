import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame }      from '../../contexts/GameContext.js';
import { useModal }     from '../../contexts/ModalContext.js';
import { useSelection } from '../../contexts/SelectionContext.js';
import { HandCard }     from '../../components/HandCard.js';
import { checkFusion, resolveFusionChain, CARD_DB } from '../../../cards.js';
import { isMonsterType } from '../../../types.js';
import type { CardData } from '../../../types.js';
import type { FieldCard } from '../../../field.js';

export function HandArea() {
  const { gameState, gameRef, pendingDraw } = useGame();
  const { openModal }                       = useModal();
  const { sel, setSel, resetSel }           = useSelection();
  const { t } = useTranslation();

  if (!gameState) return null;

  const player   = gameState.player;
  const phase    = gameState.phase;
  const isMyTurn = gameState.activePlayer === 'player';
  const selMode  = sel.mode;

  const handLen     = player.hand.length;
  const newDrawBase = handLen - pendingDraw;

  const fusionGroup = sel.fusionGroup;

  // Validate fusion group indices when hand changes
  useEffect(() => {
    if (fusionGroup.length === 0) return;
    const valid = fusionGroup.filter(i => i < player.hand.length);
    if (valid.length !== fusionGroup.length) {
      const cardIds = valid.map(i => player.hand[i].id);
      const preview = cardIds.length >= 2 ? resolveFusionChain(cardIds) : null;
      setSel({ fusionGroup: valid, fusionGroupPreview: preview });
    }
  }, [player.hand.length, fusionGroup, setSel, player.hand]);

  const onHandCardClick = useCallback((card: CardData, index: number) => {
    const game = gameRef.current;
    if (!game) return;

    // Legacy 2-card fusion mode (kept for backward compat if needed)
    if (selMode === 'fusion1') {
      if (index === sel.fusion1!.handIndex) { resetSel(); return; }
      const firstCard = player.hand[sel.fusion1!.handIndex];
      if (!firstCard) { resetSel(); return; }
      const recipe = checkFusion(card.id, firstCard.id);
      if (recipe) {
        const zone = player.field.monsters.findIndex((z): z is null => z === null);
        if (zone !== -1) game.performFusion('player', sel.fusion1!.handIndex, index);
      }
      resetSel();
      return;
    }

    // If card is in fusion group, remove it
    if (fusionGroup.includes(index)) {
      const newGroup = fusionGroup.filter(i => i !== index);
      const cardIds = newGroup.map(i => player.hand[i].id);
      const preview = cardIds.length >= 2 ? resolveFusionChain(cardIds) : null;
      setSel({ fusionGroup: newGroup, fusionGroupPreview: preview });
      return;
    }

    openModal({ type: 'card-detail', card, index, state: gameState });
  }, [gameRef, selMode, sel.fusion1, fusionGroup, player.hand, player.field.monsters, resetSel, setSel, openModal, gameState]);

  const onHandCardLongPress = useCallback((card: CardData, index: number) => {
    if (!isMyTurn || phase !== 'main') return;
    if (!isMonsterType(card.type)) return;
    if (player.normalSummonUsed) return;
    const freeZone = player.field.monsters.findIndex((z): z is null => z === null);
    if (freeZone === -1) return;
    // Toggle: remove if already in group
    if (fusionGroup.includes(index)) {
      const newGroup = fusionGroup.filter(i => i !== index);
      const cardIds = newGroup.map(i => player.hand[i].id);
      const preview = cardIds.length >= 2 ? resolveFusionChain(cardIds) : null;
      setSel({ fusionGroup: newGroup, fusionGroupPreview: preview });
      return;
    }

    const newGroup = [...fusionGroup, index];
    const cardIds = newGroup.map(i => player.hand[i].id);
    const preview = cardIds.length >= 2 ? resolveFusionChain(cardIds) : null;
    setSel({ fusionGroup: newGroup, fusionGroupPreview: preview });
  }, [isMyTurn, phase, player.normalSummonUsed, player.field.monsters, player.hand, fusionGroup, setSel]);

  const onFusionExecute = useCallback(() => {
    const game = gameRef.current;
    if (!game || fusionGroup.length < 2) return;
    game.performFusionChain('player', fusionGroup);
    setSel({ fusionGroup: [], fusionGroupPreview: null });
  }, [gameRef, fusionGroup, setSel]);

  const onFusionClear = useCallback(() => {
    setSel({ fusionGroup: [], fusionGroupPreview: null });
  }, [setSel]);

  // Fusion preview data
  const preview = sel.fusionGroupPreview;
  const previewCard = preview ? CARD_DB[preview.finalCardId] : null;

  return (
    <div id="hand-area">
      {fusionGroup.length >= 2 && (
        <div className="floating-fusion-bar">
          {previewCard && (
            <span className="fusion-preview-text">
              {previewCard.name}
              {previewCard.atk !== undefined && ` (ATK ${previewCard.atk})`}
            </span>
          )}
          <button className="fusion-execute-btn" onClick={onFusionExecute}>
            {t('fusion_chain.confirm')}
          </button>
          <button className="fusion-clear-btn" onClick={onFusionClear}>
            {t('fusion_chain.cancel')}
          </button>
        </div>
      )}
      <div id="player-hand">
        {player.hand.map((card, i) => {
          const isNewlyDrawn = i >= newDrawBase;
          const isMon        = isMonsterType(card.type);
          const playable     = isMyTurn && phase === 'main' && (
            isMon
              ? !player.normalSummonUsed && player.field.monsters.some(z => z === null)
              : player.field.spellTraps.some(z => z === null)
          );
          const inFusion     = fusionGroup.includes(i);
          const fusionIdx    = inFusion ? fusionGroup.indexOf(i) : undefined;
          const fusionable   = selMode === 'fusion1' && i !== sel.fusion1?.handIndex;
          const targetable   = selMode === 'fusion1' && i !== sel.fusion1?.handIndex;
          const dimmed       = isMyTurn && phase === 'main' && !playable && !inFusion;
          return (
            <HandCard
              key={`${card.id}-${i}`}
              card={card} index={i}
              playable={playable}
              dimmed={dimmed}
              fusionable={fusionable}
              targetable={targetable}
              fusionSelected={inFusion}
              fusionIndex={fusionIdx}
              newlyDrawn={isNewlyDrawn}
              drawDelay={isNewlyDrawn ? (i - newDrawBase) * 80 : 0}
              onClick={() => onHandCardClick(card, i)}
              onLongPress={() => onHandCardLongPress(card, i)}
            />
          );
        })}
      </div>
    </div>
  );
}
