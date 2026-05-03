import { useSyncExternalStore } from 'react';
import { getStoreVersion, subscribeStore } from '../lib/storage';

/**
 * Subscribe a component to localStorage mutations made through `store`.
 * Returns the current monotonically-increasing version. Components don't need
 * the value — calling this hook is enough to trigger a re-render when any
 * store mutation occurs.
 */
export function useStoreVersion(): number {
  return useSyncExternalStore(subscribeStore, getStoreVersion, getStoreVersion);
}
