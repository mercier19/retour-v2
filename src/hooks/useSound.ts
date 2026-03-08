import { useCallback, useRef } from 'react';

export const useSound = () => {
  const successRef = useRef<HTMLAudioElement | null>(null);
  const errorRef = useRef<HTMLAudioElement | null>(null);
  const partRef = useRef<HTMLAudioElement | null>(null);

  const play = (ref: React.MutableRefObject<HTMLAudioElement | null>, src: string) => {
    if (!ref.current) {
      ref.current = new Audio(src);
      ref.current.volume = 1.0;
    }
    ref.current.currentTime = 0;
    ref.current.play().catch(() => {});
  };

  const playSuccess = useCallback(() => play(successRef, '/sounds/success.mp3'), []);
  const playError = useCallback(() => play(errorRef, '/sounds/error.mp3'), []);
  const playPart = useCallback(() => play(partRef, '/sounds/part.mp3'), []);

  return { playSuccess, playError, playPart };
};
