import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

/**
 * Public shape exposed by the authentication provider.
 * The context definition stays separate from the provider for clean Fast Refresh.
 */
export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
