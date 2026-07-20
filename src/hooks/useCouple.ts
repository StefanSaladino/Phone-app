import { useContext } from 'react';
import { CoupleContext } from '../contexts/couple-context';

/**
 * Typed access point for the shared couple workspace.
 */
export function useCouple() {
  const context = useContext(CoupleContext);

  if (!context) {
    throw new Error('useCouple must be used inside CoupleProvider.');
  }

  return context;
}
