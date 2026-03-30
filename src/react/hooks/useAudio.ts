import { useEffect } from 'react';
import { Audio } from '../../audio.js';

/** Call once in the root component to initialize audio and handle tab visibility. */
export function useAudioInit(): void {
  useEffect(() => {
    Audio.init();

    function onVisibility() {
      if (document.hidden) Audio.suspend();
      else Audio.resume();
    }

    function onButtonClick(e: MouseEvent) {
      if ((e.target as Element)?.closest('button')) {
        Audio.playSfx('sfx_button');
      }
    }

    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('click', onButtonClick);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('click', onButtonClick);
    };
  }, []);
}
