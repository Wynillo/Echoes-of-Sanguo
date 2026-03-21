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

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
}
