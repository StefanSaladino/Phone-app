import { createContext } from 'react';
import type { CoupleWorkspace } from '../types/couple';

/**
 * Public state exposed by the couple workspace provider.
 */
export interface CoupleContextValue {
  workspace: CoupleWorkspace | null;
  loading: boolean;
  error: string | null;
  refreshWorkspace: () => Promise<void>;
}

export const CoupleContext = createContext<CoupleContextValue | undefined>(undefined);
