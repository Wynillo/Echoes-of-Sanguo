import { useCallback } from 'react';
import { useGame }      from '../../contexts/GameContext.js';
import { useModal }     from '../../contexts/ModalContext.js';
import { useSelection } from '../../contexts/SelectionContext.js';
import { HandCard }     from '../../components/HandCard.js';
import { checkFusion }  from '../../../cards.js';

export function HandArea() {
  const { gameState, gameRef, pendingDraw } = useGame();
  const { openModal }                       = useModal();
  const { sel, resetSel }                   = useSelection();

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
    openModal({ type: 'card-action', card, index, state: gameState });
  }, [gameRef, selMode, sel.fusion1, player.hand, player.field.monsters, resetSel, openModal, gameState]);

  return (
    <div id="hand-area">
      <div id="player-hand">
        {player.hand.map((card: any, i: number) => {
          const isNewlyDrawn = i >= newDrawBase;
          const playable     = isMyTurn && phase === 'main';
          const fusionable   = selMode === 'fusion1' && i !== sel.fusion1?.handIndex;
          const targetable   = selMode === 'fusion1' && i !== sel.fusion1?.handIndex;
          return (
            <HandCard
              key={`${card.id}-${i}`}
              card={card} index={i}
              playable={playable}
              fusionable={fusionable}
              targetable={targetable && selMode === 'fusion1'}
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
