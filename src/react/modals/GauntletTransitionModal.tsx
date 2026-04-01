import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';
import type { ModalState } from '../contexts/ModalContext.js';

interface Props { modal: Extract<ModalState, { type: 'gauntlet-transition' }>; }

export function GauntletTransitionModal({ modal }: Props) {
  const { duelIndex, totalDuels, nextOpponentName, resolve } = modal;
  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;
    gsap.set(contentRef.current, { y: 40, scale: 0.88, opacity: 0 });
    gsap.to(contentRef.current, { y: 0, scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.4)' });
  }, []);

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="result-content" ref={contentRef}>
        <h1 style={{ color: '#ffd700' }}>{t('gauntlet.victory')}</h1>
        <p style={{ color: '#a0c0e0', fontSize: '0.85rem', marginBottom: 8 }}>
          {t('gauntlet.progress', { current: duelIndex, total: totalDuels })}
        </p>
        <p style={{ color: '#e0e0e0', marginBottom: 16 }}>
          {t('gauntlet.next_opponent', { name: nextOpponentName })}
        </p>
        <div className="result-buttons">
          <button className="btn-primary" onClick={resolve}>
            {t('gauntlet.fight')}
          </button>
        </div>
      </div>
    </div>
  );
}
