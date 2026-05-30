import { useEffect } from 'react';

const APP_NAME = 'Stardew Companion';

/**
 * Sets the document title to "<page> | Stardew Companion".
 * Resets to just "Stardew Companion" on unmount.
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | ${APP_NAME}`;
    return () => {
      document.title = APP_NAME;
    };
  }, [title]);
}
