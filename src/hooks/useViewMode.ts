import { useCallback, useState } from 'react';

export type ViewMode = 'tile' | 'table';

/** Reads/writes the preferred view mode for a given page from localStorage. */
export function useViewMode(pageKey: string, defaultMode: ViewMode = 'tile'): [ViewMode, (m: ViewMode) => void] {
  const storageKey = `view-mode:${pageKey}`;
  const [mode, setModeState] = useState<ViewMode>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return (stored === 'tile' || stored === 'table') ? stored : defaultMode;
    } catch {
      return defaultMode;
    }
  });

  const setMode = useCallback((m: ViewMode) => {
    setModeState(m);
    try { localStorage.setItem(storageKey, m); } catch { /* ignore */ }
  }, [storageKey]);

  return [mode, setMode];
}
