import { useCallback, useEffect, useRef, useState } from 'react';
import { useCouple } from '../../hooks/useCouple';
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

/** Claims and displays pending next-login notes one at a time. */
export function SurpriseNoteController() {
  const { workspace, refreshWorkspace } = useCouple();
  const [note, setNote] = useState<Note | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibleNoteRef = useRef<Note | null>(null);

  const coupleId = workspace?.couple.id ?? null;
  const recipientId = workspace?.currentMember.user_id ?? null;
  const workspaceKey = coupleId && recipientId ? `${coupleId}:${recipientId}` : null;

  const claimAndDisplay = useCallback(async () => {
    if (!workspaceKey || !coupleId || !recipientId || visibleNoteRef.current) return;

    setError(null);

    try {
      const claimedNote = await getOrClaimNextLoginNote(
        workspaceKey,
        coupleId,
        recipientId,
      );
      visibleNoteRef.current = claimedNote;
      setNote(claimedNote);
    } catch (claimError) {
      // Surprise delivery must never make the private app unusable.
      console.error('Unable to load surprise note:', claimError);
    }
  }, [coupleId, recipientId, workspaceKey]);

  useEffect(() => {
    let isActive = true;

    if (!workspaceKey || !coupleId || !recipientId) {
      visibleNoteRef.current = null;
      setNote(null);
      return undefined;
    }

    void getOrClaimNextLoginNote(workspaceKey, coupleId, recipientId)
      .then((claimedNote) => {
        if (!isActive) return;
        visibleNoteRef.current = claimedNote;
        setNote(claimedNote);
      })
      .catch((claimError: unknown) => {
        if (!isActive) return;
        console.error('Unable to load surprise note:', claimError);
      });

    return () => {
      isActive = false;
    };
  }, [coupleId, recipientId, workspaceKey]);

  const handleDismiss = async () => {
    if (!note || !workspaceKey) return;

    setDismissing(true);
    setError(null);

    try {
      await dismissNote(note.id);
      claimedNotes.delete(workspaceKey);
      visibleNoteRef.current = null;
      setNote(null);

      // Refresh dashboard counts in the background without unmounting the app.
      void refreshWorkspace();

      window.setTimeout(() => {
        void claimAndDisplay();
      }, 180);
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
