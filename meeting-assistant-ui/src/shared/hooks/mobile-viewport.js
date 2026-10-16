import { useSyncExternalStore } from 'react';

const query = () => window.matchMedia('(max-width: 767px)');
const subscribe = callback => {
  const media = query();
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
const snapshot = () => query().matches;
export const useMobileViewport = () => useSyncExternalStore(subscribe, snapshot, () => false);
