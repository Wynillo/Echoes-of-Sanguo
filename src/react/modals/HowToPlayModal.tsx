import { useTranslation } from 'react-i18next';
import { useModal } from '../contexts/ModalContext.js';

export function HowToPlayModal() {
  const { t } = useTranslation();
  const { closeModal } = useModal();

  return (
    <div className="modal" style={{ maxWidth: '32rem', maxHeight: '80vh', overflowY: 'auto' }}>
      <h2 style={{ color: 'var(--gold)', marginBottom: '1rem' }}>{t('howToPlay.title')}</h2>

      <section style={{ marginBottom: '1rem' }}>
        <h3 style={{ color: 'var(--gold-light)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{t('howToPlay.goal_title')}</h3>
        <p style={{ fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--text-dim)' }}>{t('howToPlay.goal_text')}</p>
      </section>

      <section style={{ marginBottom: '1rem' }}>
        <h3 style={{ color: 'var(--gold-light)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{t('howToPlay.phases_title')}</h3>
        <p style={{ fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--text-dim)' }}>{t('howToPlay.phases_text')}</p>
      </section>

      <section style={{ marginBottom: '1rem' }}>
        <h3 style={{ color: 'var(--gold-light)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{t('howToPlay.fusion_title')}</h3>
        <p style={{ fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--text-dim)' }}>{t('howToPlay.fusion_text')}</p>
      </section>

      <section style={{ marginBottom: '1rem' }}>
        <h3 style={{ color: 'var(--gold-light)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{t('howToPlay.spells_title')}</h3>
        <p style={{ fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--text-dim)' }}>{t('howToPlay.spells_text')}</p>
      </section>

      <button className="btn-primary" onClick={closeModal} style={{ marginTop: '0.5rem' }}>{t('common.close')}</button>
    </div>
  );
}
