import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { loadCoupleWorkspace } from '../services/coupleService';
import type { CoupleWorkspace } from '../types/couple';
import { CoupleContext } from './couple-context';

interface CoupleProviderProps {
  children: ReactNode;
}

/**
 * Loads the authenticated user's shared two-person workspace.
 * A request counter prevents an older request from replacing newer auth state.
 */
export function CoupleProvider({ children }: CoupleProviderProps) {
  const { user, loading: authLoading } = useAuth();
  const [workspace, setWorkspace] = useState<CoupleWorkspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestCounter = useRef(0);

  const refreshWorkspace = useCallback(async () => {
    const requestId = requestCounter.current + 1;
    requestCounter.current = requestId;

    if (!user) {
      setWorkspace(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextWorkspace = await loadCoupleWorkspace(user.id);

      if (requestCounter.current !== requestId) return;
      setWorkspace(nextWorkspace);
    } catch (loadError) {
      if (requestCounter.current !== requestId) return;

      setWorkspace(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to open the shared couple workspace.',
      );
    } finally {
      if (requestCounter.current === requestId) {
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refreshWorkspace();
  }, [authLoading, refreshWorkspace]);

  const value = useMemo(
    () => ({
      workspace,
      loading: authLoading || loading,
      error,
      refreshWorkspace,
    }),
    [authLoading, error, loading, refreshWorkspace, workspace],
  );

  return <CoupleContext.Provider value={value}>{children}</CoupleContext.Provider>;
}
