import { useEffect, useCallback } from 'react';

interface UseGlobalHotkeyOptions {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  onTrigger: () => void;
  enabled?: boolean;
}

export function useGlobalHotkey({
  key,
  metaKey = false,
  ctrlKey = false,
  shiftKey = false,
  altKey = false,
  onTrigger,
  enabled = true,
}: UseGlobalHotkeyOptions) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;
    
    const isMatchingKey = event.key.toLowerCase() === key.toLowerCase();
    const isMatchingMeta = metaKey === event.metaKey;
    const isMatchingCtrl = ctrlKey === event.ctrlKey;
    const isMatchingShift = shiftKey === event.shiftKey;
    const isMatchingAlt = altKey === event.altKey;
    
    if (isMatchingKey && isMatchingMeta && isMatchingCtrl && isMatchingShift && isMatchingAlt) {
      event.preventDefault();
      event.stopPropagation();
      onTrigger();
    }
  }, [key, metaKey, ctrlKey, shiftKey, altKey, onTrigger, enabled]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handleKeyDown, enabled]);
}