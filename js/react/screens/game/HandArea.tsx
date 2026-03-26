import { useCallback } from 'react';
import { useGame }      from '../../contexts/GameContext.js';
import { useModal }     from '../../contexts/ModalContext.js';
import { useSelection } from '../../contexts/SelectionContext.js';
import { HandCard }     from '../../components/HandCard.js';
import { FusionChainBar } from '../../components/FusionChainBar.js';
import { checkFusion, resolveFusionChain } from '../../../cards.js';

export function HandArea() {
  const { gameState, gameRef, pendingDraw } = useGame();
  const { openModal }                       = useModal();
  const { sel, setSel, resetSel }           = useSelection();

  if (!gameState) return null;

  const player   = gameState.player;
  const phase    = gameState.phase;
  const isMyTurn = gameState.activePlayer === 'player';
  const selMode  = sel.mode;

  const handLen     = player.hand.length;
  const newDrawBase = handLen - pendingDraw;

  const onHandCardClick = useCallback((card: any, index: number) => {
    const game = gameRef.current;
    if (!game) return;

    // Legacy 2-card fusion mode (kept for backward compat if needed)
    if (selMode === 'fusion1') {
      if (index === sel.fusion1!.handIndex) { resetSel(); return; }
      const firstCard = player.hand[sel.fusion1!.handIndex];
      if (!firstCard) { resetSel(); return; }
      const recipe = checkFusion(card.id, firstCard.id);
      if (recipe) {
        const zone = player.field.monsters.findIndex((z: any) => z === null);
        if (zone !== -1) game.performFusion('player', sel.fusion1!.handIndex, index);
      }
      resetSel();
      return;
    }

    // FM-style play chain mode
    if (selMode === 'play-chain') {
      const chain = sel.playChain;

      // Clicking the last card in chain = undo
      if (chain.length > 0 && chain[chain.length - 1] === index) {
        const newChain = chain.slice(0, -1);
        if (newChain.length === 0) {
          resetSel();
          return;
        }
        const cardIds = newChain.map(i => player.hand[i].id);
        const preview = cardIds.length >= 2 ? resolveFusionChain(cardIds) : null;
        setSel({ playChain: newChain, playChainPreview: preview });
        return;
      }

      // Card already in chain (not last) — ignore
      if (chain.includes(index)) return;

      // Add to chain
      const newChain = [...chain, index];
      const cardIds = newChain.map(i => player.hand[i].id);
      const preview = cardIds.length >= 2 ? resolveFusionChain(cardIds) : null;
      setSel({ playChain: newChain, playChainPreview: preview });
      return;
    }

    openModal({ type: 'card-detail', card, index, state: gameState });
  }, [gameRef, selMode, sel.fusion1, sel.playChain, player.hand, player.field.monsters, resetSel, setSel, openModal, gameState]);

  const onConfirmChain = useCallback(() => {
    const game = gameRef.current;
    if (!game || sel.playChain.length === 0) return;
    game.performFusionChain('player', sel.playChain);
    resetSel();
  }, [gameRef, sel.playChain, resetSel]);

  return (
    <div id="hand-area">
      {selMode === 'play-chain' && (
        <FusionChainBar
          hand={player.hand}
          chain={sel.playChain}
          preview={sel.playChainPreview}
          onConfirm={onConfirmChain}
          onCancel={resetSel}
        />
      )}
      <div id="player-hand">
        {player.hand.map((card: any, i: number) => {
          const isNewlyDrawn = i >= newDrawBase;
          const playable     = isMyTurn && phase === 'main';
          const inChain      = selMode === 'play-chain' && sel.playChain.includes(i);
          const chainIdx     = inChain ? sel.playChain.indexOf(i) : undefined;
          const fusionable   = selMode === 'fusion1' && i !== sel.fusion1?.handIndex;
          const targetable   = (selMode === 'fusion1' && i !== sel.fusion1?.handIndex) ||
                               selMode === 'play-chain';
          return (
            <HandCard
              key={`${card.id}-${i}`}
              card={card} index={i}
              playable={playable}
              fusionable={fusionable}
              targetable={targetable}
              chainSelected={inChain}
              chainIndex={chainIdx}
              newlyDrawn={isNewlyDrawn}
              drawDelay={isNewlyDrawn ? (i - newDrawBase) * 80 : 0}
              onClick={() => onHandCardClick(card, i)}
            />
          );
        })}
      </div>
    </div>
  );
}
