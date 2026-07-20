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
 * Initial loads show the route loader; later refreshes happen in the background
 * so dashboard-count updates do not unmount the entire application shell.
 */
export function CoupleProvider({ children }: CoupleProviderProps) {
  const { user, loading: authLoading } = useAuth();
  const [workspace, setWorkspace] = useState<CoupleWorkspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestCounter = useRef(0);
  const workspaceRef = useRef<CoupleWorkspace | null>(null);
  const loadedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  const refreshWorkspace = useCallback(async () => {
    const requestId = requestCounter.current + 1;
    requestCounter.current = requestId;

    if (!user) {
      workspaceRef.current = null;
      loadedUserIdRef.current = null;
      setWorkspace(null);
      setError(null);
      setLoading(false);
      return;
    }

    const userChanged = loadedUserIdRef.current !== user.id;
    const shouldShowInitialLoader = userChanged || workspaceRef.current === null;

    if (userChanged) {
      workspaceRef.current = null;
      setWorkspace(null);
    }

    if (shouldShowInitialLoader) setLoading(true);
    setError(null);

    try {
      const nextWorkspace = await loadCoupleWorkspace(user.id);

      if (requestCounter.current !== requestId) return;
      loadedUserIdRef.current = user.id;
      workspaceRef.current = nextWorkspace;
      setWorkspace(nextWorkspace);
    } catch (loadError) {
      if (requestCounter.current !== requestId) return;

      // Preserve an already rendered workspace if only a background refresh fails.
      if (shouldShowInitialLoader) {
        workspaceRef.current = null;
        setWorkspace(null);
      }

      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to open the shared couple workspace.',
      );
    } finally {
      if (requestCounter.current === requestId) setLoading(false);
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
