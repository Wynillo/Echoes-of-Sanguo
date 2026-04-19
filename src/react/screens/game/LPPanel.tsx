import { useAnimatedNumber } from '../../hooks/useAnimatedNumber.js';
import RaceIcon from '../../components/RaceIcon.js';

interface LPPanelProps {
  playerLp:    number;
  oppLp:       number;
  playerDeck:  number;
  oppDeck:     number;
}

const START_LP = 8000;
function lpPct(lp: number) { return `${Math.max(0, Math.min(100, lp / START_LP * 100))}%`; }

export function LPPanel({ playerLp, oppLp, playerDeck, oppDeck }: LPPanelProps) {
  const playerLpDisplay = useAnimatedNumber(playerLp);
  const oppLpDisplay    = useAnimatedNumber(oppLp);

  return (
    <div id="lp-panel">
      <div className="lp-row opp-lp-row">
        <span className="lp-who">COM</span>
        <div className="lp-bottom">
          <div className="io-bar-bg">
            <div id="opp-lp-bar" className="lp-bar opp-lp-bar" style={{ width: lpPct(oppLp) }}></div>
          </div>
          <span className="lp-value" id="opp-lp" aria-live="polite" aria-label={`Opponent LP: ${oppLpDisplay}`}>{oppLpDisplay}</span>
          <span className="lp-deck" id="opp-deck-count" aria-label={`Opponent deck: ${oppDeck} cards`}><RaceIcon icon="GiCardDraw" />{oppDeck}</span>
        </div>
      </div>
      <div className="lp-row player-lp-row">
        <span className="lp-who">YOU</span>
        <div className="lp-bottom">
          <div className="io-bar-bg">
            <div id="player-lp-bar" className="lp-bar" style={{ width: lpPct(playerLp) }}></div>
          </div>
          <span className="lp-value" id="player-lp" aria-live="polite" aria-label={`Your LP: ${playerLpDisplay}`}>{playerLpDisplay}</span>
          <span className="lp-deck" id="player-deck-count" aria-label={`Your deck: ${playerDeck} cards`}><RaceIcon icon="GiCardDraw" />{playerDeck}</span>
        </div>
      </div>
    </div>
  );
}
