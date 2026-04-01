import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from '../locales/de.json';
import en from '../locales/en.json';
import { Progression } from './progression.js';

export const i18nReady = i18next
  .use(initReactI18next)
  .init({
    lng: Progression.getSettings().lang ?? 'en',
    fallbackLng: 'en',
    resources: {
      de: { translation: de },
      en: { translation: en },
    },
    interpolation: { escapeValue: false },
  })
  .then(() => {
    document.documentElement.lang = i18next.language;
  });

i18next.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

export default i18next;
