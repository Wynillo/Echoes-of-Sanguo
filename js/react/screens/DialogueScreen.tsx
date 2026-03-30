import { useState } from 'react';
import { useScreen }   from '../contexts/ScreenContext.js';
import { useGame }     from '../contexts/GameContext.js';
import { CAMPAIGN_IMAGES, CAMPAIGN_I18N } from '../../campaign.js';
import { Progression } from '../../progression.js';
import type { DialogueScene, ForegroundSprite } from '@wynillo/tcg-format';
import type { Screen } from '../contexts/ScreenContext.js';
import type { OpponentConfig } from '../../types.js';

const POSITION_LEFT: Record<string, string> = {
  'far-left': '5%',
  'left':     '18%',
  'center':   '40%',
  'right':    '60%',
  'far-right':'75%',
};

function getCampaignText(textKey: string): string {
  const lang = Progression.getSettings().lang ?? 'en';
  return CAMPAIGN_I18N.get(lang)?.[textKey]
    ?? CAMPAIGN_I18N.get('en')?.[textKey]
    ?? textKey;
}

function getImageUrl(path: string): string {
  return CAMPAIGN_IMAGES.get(path) ?? '';
}

export default function DialogueScreen() {
  const { screenData, navigateTo } = useScreen();
  const { startGame } = useGame();

  const scene = screenData?.scene as unknown as DialogueScene | undefined;
  const nextScreen  = (screenData?.nextScreen  as Screen)              ?? 'campaign';
  const nextData    = (screenData?.nextScreenData as Record<string, unknown>) ?? null;

  const [lineIndex, setLineIndex] = useState(0);
  const [currentForegrounds, setCurrentForegrounds] = useState<ForegroundSprite[]>([]);

  if (!scene || !scene.dialogue || scene.dialogue.length === 0) {
    // No scene data — go to next screen immediately
    navigateTo(nextScreen, nextData ?? undefined);
    return null;
  }

  const line = scene.dialogue[lineIndex];

  // Update foregrounds only when non-null
  const visibleForegrounds = line.foregrounds !== null ? line.foregrounds : currentForegrounds;

  function advance() {
    if (line.foregrounds !== null) {
      setCurrentForegrounds(line.foregrounds);
    }

    if (lineIndex < scene!.dialogue.length - 1) {
      setLineIndex(lineIndex + 1);
    } else {
      // Last line — transition to next screen
      if (nextScreen === 'game') {
        const oppConfig = nextData?.campaignOpponentConfig as unknown as OpponentConfig | null ?? null;
        startGame(oppConfig);
      } else {
        navigateTo(nextScreen, nextData ?? undefined);
      }
    }
  }

  const bgUrl = getImageUrl(scene.background);

  return (
    <div
      style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#000' }}
      onClick={advance}
    >
      {/* Background */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: bgUrl ? `url(${bgUrl})` : 'none',
        backgroundSize: 'cover', backgroundPosition: 'center',
        backgroundColor: bgUrl ? 'transparent' : '#1a1a2e',
      }} />

      {/* Foreground sprites */}
      {visibleForegrounds.map((sprite, i) => {
        const spriteUrl = getImageUrl(sprite.sprite);
        return (
          <div
            key={`${sprite.sprite}-${i}`}
            style={{
              position: 'absolute',
              bottom: '25%',
              left: POSITION_LEFT[sprite.position] ?? '50%',
              transform: `translateX(-50%)${sprite.flipX ? ' scaleX(-1)' : ''}`,
              height: '65%',
              opacity: sprite.active ? 1 : 0.4,
              filter: sprite.active ? 'none' : 'grayscale(0.6)',
              transition: 'opacity 0.3s',
              pointerEvents: 'none',
            }}
          >
            {spriteUrl
              ? <img src={spriteUrl} alt={sprite.sprite} style={{ height: '100%', objectFit: 'contain' }} />
              : (
                <div style={{
                  width: 80, height: '100%', background: 'rgba(255,255,255,0.1)',
                  border: '2px dashed rgba(255,255,255,0.3)', borderRadius: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', textAlign: 'center',
                  padding: '0.5rem',
                }}>
                  {sprite.sprite.split('/').pop()}
                </div>
              )
            }
          </div>
        );
      })}

      {/* Dialogue box */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(10,15,30,0.92)',
          borderTop: '2px solid #3a2a1a',
          padding: '1rem 1.5rem',
          display: 'flex', gap: '1rem', alignItems: 'flex-start',
          cursor: 'pointer',
          minHeight: '22%',
        }}
        onClick={e => { e.stopPropagation(); advance(); }}
      >
        {/* Portrait */}
        {line.portrait && (
          <div style={{
            flexShrink: 0,
            order: line.side === 'right' ? 1 : 0,
            width: 72, height: 72,
            borderRadius: 4,
            border: '2px solid #3a2a1a',
            overflow: 'hidden',
            background: '#1a2a3a',
          }}>
            {(() => {
              const portraitUrl = getImageUrl(line.portrait);
              return portraitUrl
                ? <img src={portraitUrl} alt={line.speaker} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '0.7rem' }}>{line.speaker[0]?.toUpperCase()}</div>;
            })()}
          </div>
        )}

        {/* Text area */}
        <div style={{ flex: 1, order: line.side === 'right' ? 0 : 1 }}>
          <div style={{ color: '#c8a96e', fontWeight: 'bold', marginBottom: '0.4rem', fontSize: '0.95rem' }}>
            {getCampaignText(line.speaker) !== line.speaker ? getCampaignText(line.speaker) : line.speaker}
          </div>
          <div style={{ color: '#e8d5a3', fontSize: '1rem', lineHeight: 1.5 }}>
            {getCampaignText(line.textKey)}
          </div>
        </div>

        {/* Next indicator */}
        <div style={{
          flexShrink: 0, alignSelf: 'flex-end',
          color: '#c8a96e', fontSize: '1.2rem',
          animation: 'pulse 1.2s ease-in-out infinite',
        }}>
          {lineIndex < scene.dialogue.length - 1 ? '▶' : '✓'}
        </div>
      </div>

      {/* Progress dots */}
      {scene.dialogue.length > 1 && (
        <div style={{
          position: 'absolute', bottom: '23%', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: '0.4rem',
        }}>
          {scene.dialogue.map((_, i) => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: i === lineIndex ? '#c8a96e' : 'rgba(200,169,110,0.3)',
            }} />
          ))}
        </div>
      )}
    </div>
  );
}
