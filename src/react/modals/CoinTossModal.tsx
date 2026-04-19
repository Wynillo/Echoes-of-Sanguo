import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useModal } from '../contexts/ModalContext.js';
import { ANIMATION_TIMING } from '../../constants.js';
import type { ModalState } from '../contexts/ModalContext.js';

interface Props { modal: Extract<ModalState, { type: 'coin-toss' }>; }

export function CoinTossModal({ modal }: Props) {
  const { playerGoesFirst, resolve } = modal;
  const { closeModal } = useModal();
  const { t } = useTranslation();
  const [flipping, setFlipping] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setFlipping(false), ANIMATION_TIMING.COIN_FLIP_MS);
    return () => clearTimeout(timer);
  }, []);

  function handleContinue() {
    closeModal();
    resolve();
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" style={{ textAlign: 'center' }}>
      <h2 style={{ marginBottom: '16px' }}>{t('coin_toss.title')}</h2>
      <div style={{
        fontSize: '64px',
        margin: '20px 0',
        animation: flipping ? 'spin-coin 0.3s linear infinite' : undefined,
        display: 'inline-block',
      }}>
        {flipping ? '\u{1FA99}' : (playerGoesFirst ? '\u2694\uFE0F' : '\u{1F6E1}\uFE0F')}
      </div>
      {!flipping && (
        <>
          <p style={{ fontSize: '16px', margin: '12px 0', color: playerGoesFirst ? '#4fc' : '#f84' }}>
            {playerGoesFirst ? t('coin_toss.player_first') : t('coin_toss.opponent_first')}
          </p>
          <button className="menu-action-btn" onClick={handleContinue} style={{ marginTop: '12px' }}>
            {t('coin_toss.continue')}
          </button>
        </>
      )}
    </div>
  );
}
