'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

// Keep localStorage-backed UI identical during SSR and the first client render.
export function useHydrated() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
