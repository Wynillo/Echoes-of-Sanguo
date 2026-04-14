import { useTranslation } from 'react-i18next';

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
  const positions: Record<string, React.CSSProperties> = {
    'monster-player-0': { left: '25%', top: '52%' },
    'monster-player-1': { left: '37.5%', top: '52%' },
    'monster-player-2': { left: '50%', top: '52%' },
    'monster-opponent-0': { left: '25%', top: '28%' },
    'monster-opponent-1': { left: '37.5%', top: '28%' },
    'monster-opponent-2': { left: '50%', top: '28%' },
    'spell-player-0': { left: '65%', top: '45%' },
    'spell-player-1': { left: '65%', top: '52%' },
    'spell-player-2': { left: '65%', top: '59%' },
    'spell-player-3': { left: '65%', top: '66%' },
    'spell-player-4': { left: '65%', top: '73%' },
    'spell-opponent-0': { left: '65%', top: '10%' },
    'spell-opponent-1': { left: '65%', top: '17%' },
    'spell-opponent-2': { left: '65%', top: '24%' },
    'spell-opponent-3': { left: '65%', top: '31%' },
    'spell-opponent-4': { left: '65%', top: '38%' },
    'hand-player-0': { left: '15%', bottom: '8%' },
    'hand-player-1': { left: '25%', bottom: '8%' },
    'hand-player-2': { left: '35%', bottom: '8%' },
    'hand-player-3': { left: '45%', bottom: '8%' },
    'hand-player-4': { left: '55%', bottom: '8%' },
    'hand-player-5': { left: '65%', bottom: '8%' },
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
