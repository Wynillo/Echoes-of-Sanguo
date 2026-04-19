import { useTranslation } from 'react-i18next';
import { FIELD_RULES } from '../../rules.js';

interface FocusZone {
  type: 'monster' | 'spell' | 'field-spell' | 'hand' | 'grave' | 'phase-btn' | 'direct-btn';
  owner: 'player' | 'opponent';
  zone: number;
}

interface Props {
  connected: boolean;
  focusedZone: FocusZone | null;
}

export function ControllerFocusOverlay({ connected, focusedZone }: Props) {
  const { t } = useTranslation();

  if (!connected || !focusedZone) return null;

  return (
    <div 
      className="controller-focus-overlay" 
      role="status" 
      aria-live="polite"
      aria-label={t('controller.focus_indicator', 'Controller navigation active')}
    >
      <div 
        className={`controller-focus-ring ${focusedZone.type}`}
        style={getFocusPosition(focusedZone)}
      />
    </div>
  );
}

function getFocusPosition(focus: FocusZone): React.CSSProperties {
  const monsterZones = FIELD_RULES.MONSTER_ZONES_PER_PLAYER as number;
  const spellTrapZones = FIELD_RULES.SPELL_TRAP_ZONES_PER_PLAYER as number;
  
  // Monster zone positions: distributed from 25% to 50% of screen width
  // Formula: leftPercent = 25 + (zoneIndex * (50 - 25) / (monsterZones - 1))
  // For 5 zones: 25%, 31.25%, 37.5%, 43.75%, 50%
  if (focus.type === 'monster') {
    const leftPercent = monsterZones === 1 
      ? 37.5 
      : 25 + (focus.zone * (50 - 25) / (monsterZones - 1));
    const topPercent = focus.owner === 'player' ? 52 : 28;
    return { left: `${leftPercent}%`, top: `${topPercent}%` };
  }
  
  // Spell/trap zone positions: vertical column on right side
  // Player: top to bottom (45% to 73%), Opponent: top to bottom (10% to 38%)
  if (focus.type === 'spell') {
    const playerTopStart = 45;
    const playerTopEnd = 73;
    const opponentTopStart = 10;
    const opponentTopEnd = 38;
    
    if (spellTrapZones === 1) {
      const topPercent = focus.owner === 'player' ? 59 : 24;
      return { left: '65%', top: `${topPercent}%` };
    }
    
    const topPercent = focus.owner === 'player'
      ? playerTopStart + (focus.zone * (playerTopEnd - playerTopStart) / (spellTrapZones - 1))
      : opponentTopStart + (focus.zone * (opponentTopEnd - opponentTopStart) / (spellTrapZones - 1));
    
    return { left: '65%', top: `${topPercent}%` };
  }
  
  // Hand positions: horizontal row at bottom
  // 6 cards from 15% to 65% left
  if (focus.type === 'hand' && focus.owner === 'player') {
    const handLeftPercent = 15 + (focus.zone * (65 - 15) / 5);
    return { left: `${handLeftPercent}%`, bottom: '8%' };
  }
  
  // Fixed positions for other zones
  const positions: Record<string, React.CSSProperties> = {
    'phase-btn': { right: '12%', top: '50%' },
    'direct-btn-player-0': { left: '37.5%', top: '40%' },
    'grave-player': { left: '5%', top: '70%' },
    'grave-opponent': { left: '5%', top: '15%' },
    'field-spell-player-0': { left: '5%', top: '55%' },
    'field-spell-opponent-0': { left: '5%', top: '25%' },
  };
  
  const key = `${focus.type}-${focus.owner}-${focus.zone}`;
  return positions[key] || { left: '50%', top: '50%' };
}
