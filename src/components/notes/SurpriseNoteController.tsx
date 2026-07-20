import { useCallback, useEffect, useRef, useState } from 'react';
import { useCouple } from '../../hooks/useCouple';
import { supabase } from '../../lib/supabase';
import { claimNextLoginNote, dismissNote } from '../../services/noteService';
import type { Note } from '../../types/note';
import { PostItNoteModal } from './PostItNoteModal';

/**
 * Keeps a claim alive across React StrictMode's development-only remount.
 * The promise and resulting note are keyed to the signed-in couple member.
 */
const inFlightClaims = new Map<string, Promise<Note | null>>();
const claimedNotes = new Map<string, Note>();

function getOrClaimNextLoginNote(
  workspaceKey: string,
  coupleId: string,
  recipientId: string,
): Promise<Note | null> {
  const cachedNote = claimedNotes.get(workspaceKey);
  if (cachedNote) return Promise.resolve(cachedNote);

  const existingClaim = inFlightClaims.get(workspaceKey);
  if (existingClaim) return existingClaim;

  const claimPromise = claimNextLoginNote(coupleId, recipientId)
    .then((claimedNote) => {
      if (claimedNote) claimedNotes.set(workspaceKey, claimedNote);
      return claimedNote;
    })
    .finally(() => {
      inFlightClaims.delete(workspaceKey);
    });

  inFlightClaims.set(workspaceKey, claimPromise);
  return claimPromise;
}

/**
 * Displays surprise notes whenever the app opens, returns to the foreground,
 * or receives a new note through Supabase Realtime while already open.
 */
export function SurpriseNoteController() {
  const { workspace, refreshWorkspace } = useCouple();
  const [note, setNote] = useState<Note | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibleNoteRef = useRef<Note | null>(null);

  const coupleId = workspace?.couple.id ?? null;
  const recipientId = workspace?.currentMember.user_id ?? null;
  const workspaceKey = coupleId && recipientId ? `${coupleId}:${recipientId}` : null;

  /** Claims the oldest waiting surprise only when another popup is not visible. */
  const claimAndDisplay = useCallback(async () => {
    if (!workspaceKey || !coupleId || !recipientId || visibleNoteRef.current) return;

    setError(null);

    try {
      const claimedNote = await getOrClaimNextLoginNote(
        workspaceKey,
        coupleId,
        recipientId,
      );

      if (!claimedNote) return;

      visibleNoteRef.current = claimedNote;
      setNote(claimedNote);

      // Keep dashboard counts accurate after the note is marked as seen.
      void refreshWorkspace();
    } catch (claimError) {
      // Surprise delivery must never make the private app unusable.
      console.error('Unable to load surprise note:', claimError);
    }
  }, [coupleId, recipientId, refreshWorkspace, workspaceKey]);

  /** Check once as soon as the authenticated couple workspace is available. */
  useEffect(() => {
    if (!workspaceKey || !coupleId || !recipientId) {
      visibleNoteRef.current = null;
      setNote(null);
      return;
    }

    void claimAndDisplay();
  }, [claimAndDisplay, coupleId, recipientId, workspaceKey]);

  /**
   * An installed PWA can remain alive while hidden in the app switcher.
   * Re-checking on visibility, focus, and reconnection makes "open the app"
   * work even when React itself was never remounted.
   */
  useEffect(() => {
    if (!workspaceKey) return undefined;

    const checkWhenVisible = () => {
      if (document.visibilityState === 'visible') void claimAndDisplay();
    };

    const checkWhenFocused = () => void claimAndDisplay();

    document.addEventListener('visibilitychange', checkWhenVisible);
    window.addEventListener('focus', checkWhenFocused);
    window.addEventListener('online', checkWhenFocused);

    return () => {
      document.removeEventListener('visibilitychange', checkWhenVisible);
      window.removeEventListener('focus', checkWhenFocused);
      window.removeEventListener('online', checkWhenFocused);
    };
  }, [claimAndDisplay, workspaceKey]);

  /**
   * Listen for notes addressed to the current user. A surprise is claimed and
   * displayed immediately; a normal inbox note only refreshes the count.
   */
  useEffect(() => {
    if (!recipientId || !workspaceKey) return undefined;

    const channel = supabase
      .channel(`recipient-notes:${recipientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notes',
          filter: `recipient_id=eq.${recipientId}`,
        },
        (payload) => {
          const insertedNote = payload.new as Note;

          void refreshWorkspace();

          if (insertedNote.delivery_mode === 'next_login') {
            void claimAndDisplay();
          }
        },
      )
      .subscribe((status, subscribeError) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Unable to subscribe to surprise notes:', subscribeError);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [claimAndDisplay, recipientId, refreshWorkspace, workspaceKey]);

  const handleDismiss = async () => {
    if (!note || !workspaceKey) return;

    setDismissing(true);
    setError(null);

    try {
      await dismissNote(note.id);
      claimedNotes.delete(workspaceKey);
      visibleNoteRef.current = null;
      setNote(null);

      // Refresh counts, then reveal another queued surprise if one exists.
      void refreshWorkspace();
      window.setTimeout(() => void claimAndDisplay(), 180);
    } catch (dismissError) {
      setError(
        dismissError instanceof Error
          ? dismissError.message
          : 'Unable to close this note right now.',
      );
    } finally {
      setDismissing(false);
    }
  };

  if (!workspace || !note) return null;

  return (
    <PostItNoteModal
      note={note}
      authorFirstName={workspace.partnerMember.profile.first_name}
      dismissing={dismissing}
      error={error}
      onDismiss={handleDismiss}
    />
  );
}
