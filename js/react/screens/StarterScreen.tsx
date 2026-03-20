import { useState }      from 'react';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { Progression }    from '../../progression.js';
import { RACE_NAME }      from '../../cards.js';
import { STARTER_DECKS }  from '../../cards-data.js';

const RACE_INFO: Record<string, { icon: string; color: string; style: string }> = {
  feuer:   { icon: '🔥', color: '#e05030', style: 'Direktschaden & Burn' },
  drache:  { icon: '🐲', color: '#8040c0', style: 'Hohe ATK & Unverwundbar' },
  flug:    { icon: '🦅', color: '#4090c0', style: 'Ausweichen & Debuffs' },
  stein:   { icon: '🪨', color: '#808060', style: 'Hohe DEF & Heilung' },
  pflanze: { icon: '🌿', color: '#40a050', style: 'Heilung & Durchhalten' },
  krieger: { icon: '⚔️', color: '#c09030', style: 'Kampf & ATK-Stärkung' },
  magier:  { icon: '🔮', color: '#6060c0', style: 'Karten ziehen & Kontrolle' },
  elfe:    { icon: '✨', color: '#90c060', style: 'Gegner schwächen & Debuffs' },
  daemon:  { icon: '💀', color: '#804090', style: 'Hoher Schaden & Risiko' },
  wasser:  { icon: '🌊', color: '#3080b0', style: 'Bounce & Kontrolle' },
};

const RACE_FLAVOR: Record<string, string> = {
  feuer:   'Deine Monster verbrennen den Gegner bei jeder Beschwörung. Aggressiver Direktangriff.',
  drache:  'Mächtige Drachen mit hoher ATK. Viele können nicht als Ziel gewählt werden.',
  flug:    'Flinke Flieger schwächen alle Gegnermonster. Kaum aufzuhalten.',
  stein:   'Massive Verteidigung und starke LP-Heilung. Fast unzerstörbar.',
  pflanze: 'Heilung und Ausdauer. Deine Monster regenerieren sich immer wieder.',
  krieger: 'Stärke deine Monster dauerhaft und dominiere den Kampf.',
  magier:  'Ziehe mehr Karten als dein Gegner und behalte die Kontrolle.',
  elfe:    'Schwäche alle Gegnermonster dauerhaft. Macht starke Gegner hilflos.',
  daemon:  'Risikoreich aber verheerend: Enormer Schaden durch dunkle Magie.',
  wasser:  'Spiele feindliche Monster auf die Hand zurück und kontrolliere das Feld.',
};

export default function StarterScreen() {
  const { setScreen }              = useScreen();
  const { refresh, setCurrentDeck } = useProgression();
  const [selected, setSelected]    = useState<string | null>(null);

  function confirm() {
    if (!selected) return;
    const deckIds = (STARTER_DECKS as any)[selected];
    if (!deckIds) return;
    Progression.markStarterChosen(selected);
    Progression.addCardsToCollection(deckIds);
    Progression.saveDeck(deckIds);
    setCurrentDeck(deckIds);
    refresh();
    setScreen('save-point');
  }

  const info = selected ? RACE_INFO[selected] : null;

  return (
    <div id="starter-screen">
      <div className="starter-header">
        <div className="starter-rune">✦</div>
        <h2 className="starter-title">WÄHLE DEIN STARTERDECK</h2>
        <p className="starter-subtitle">Deine Rasse definiert deinen Spielstil. Diese Wahl ist für immer!</p>
      </div>

      <div id="starter-race-grid">
        {Object.entries(RACE_INFO).map(([race, ri]) => (
          <div
            key={race}
            className={`starter-race-card${selected === race ? ' selected' : ''}`}
            style={{ '--race-color': ri.color } as React.CSSProperties}
            onClick={() => setSelected(race)}
          >
            <div className="starter-race-icon">{ri.icon}</div>
            <div className="starter-race-name">{(RACE_NAME as any)[race] || race}</div>
            <div className="starter-race-style">{ri.style}</div>
          </div>
        ))}
      </div>

      <div id="starter-preview">
        <p id="starter-preview-name">
          {info ? `${info.icon} ${(RACE_NAME as any)[selected!] || selected}-Deck` : ''}
        </p>
        <p id="starter-preview-desc">{selected ? RACE_FLAVOR[selected] : ''}</p>
        {selected && (
          <button id="btn-starter-confirm" onClick={confirm}>✦ Dieses Deck wählen</button>
        )}
      </div>
    </div>
  );
}
