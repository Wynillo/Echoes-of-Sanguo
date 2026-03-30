import { useRef, useCallback } from 'react';

interface UseLongPressOptions {
  onLongPress: () => void;
  onClick?: () => void;
  threshold?: number;
  moveThreshold?: number;
}

export function useLongPress({
  onLongPress,
  onClick,
  threshold = 400,
  moveThreshold = 10,
}: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    firedRef.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    const target = e.currentTarget as HTMLElement;
    target.classList.add('long-press-active');
    clear();
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      timerRef.current = null;
      target.classList.remove('long-press-active');
      onLongPress();
    }, threshold);
  }, [onLongPress, threshold, clear]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!startPos.current) return;
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    if (dx * dx + dy * dy > moveThreshold * moveThreshold) {
      clear();
    }
  }, [moveThreshold, clear]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    clear();
    (e.currentTarget as HTMLElement).classList.remove('long-press-active');
    startPos.current = null;
  }, [clear]);

  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    clear();
    (e.currentTarget as HTMLElement).classList.remove('long-press-active');
    startPos.current = null;
  }, [clear]);

  // Native click handler — more reliable than synthesizing clicks from onPointerUp
  const handleClick = useCallback(() => {
    if (!firedRef.current && onClick) {
      onClick();
    }
  }, [onClick]);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    if (firedRef.current) e.preventDefault();
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClick: handleClick, onContextMenu };
}
