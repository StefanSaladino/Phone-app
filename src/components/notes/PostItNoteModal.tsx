import type { Note } from '../../types/note';
import { AppIcon } from '../ui/AppIcon';

interface PostItNoteModalProps {
  note: Note;
  authorFirstName: string;
  dismissing: boolean;
  error: string | null;
  onDismiss: () => Promise<void>;
}

/** Warm post-it style reveal used for private next-login notes. */
export function PostItNoteModal({
  note,
  authorFirstName,
  dismissing,
  error,
  onDismiss,
}: PostItNoteModalProps) {
  return (
    <div className="surprise-backdrop" role="presentation">
      <section
        className="post-it-note"
        role="dialog"
        aria-modal="true"
        aria-labelledby="surprise-note-title"
        aria-describedby="surprise-note-message"
      >
        <span className="post-it-note__tape" aria-hidden="true" />
        <span className="post-it-note__fold" aria-hidden="true" />

        <header className="post-it-note__header">
          <span className="post-it-note__sparkle" aria-hidden="true">
            <AppIcon name="sparkle" size={22} />
          </span>
          <div>
            <p>A little note from</p>
            <h2 id="surprise-note-title">{authorFirstName}</h2>
          </div>
        </header>

        <p className="post-it-note__message" id="surprise-note-message">
          {note.message}
        </p>

        {error ? (
          <p className="post-it-note__error" role="alert">
            {error}
          </p>
        ) : null}

        <button
          className="post-it-note__button"
          type="button"
          onClick={() => void onDismiss()}
          disabled={dismissing}
        >
          <AppIcon name="heart" size={18} />
          {dismissing ? 'Saving…' : 'Keep this with me'}
        </button>
      </section>
    </div>
  );
}
