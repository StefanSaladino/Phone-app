import type { Note } from '../../types/note';
import { AppIcon } from '../ui/AppIcon';

interface NoteCardProps {
  note: Note;
  direction: 'received' | 'sent';
  personFirstName: string;
  onDelete: (note: Note) => void;
}

function formatNoteDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

/** Compact note history card used by both received and sent views. */
export function NoteCard({ note, direction, personFirstName, onDelete }: NoteCardProps) {
  const isSurprise = note.delivery_mode === 'next_login';
  const isUnread = direction === 'received' && !note.seen_at;

  return (
    <article className={`note-card${isUnread ? ' note-card--unread' : ''}`}>
      <header className="note-card__header">
        <div>
          <span className={`note-badge${isSurprise ? ' note-badge--surprise' : ''}`}>
            <AppIcon name={isSurprise ? 'sparkle' : 'mail'} size={15} />
            {isSurprise ? 'Surprise' : 'Inbox'}
          </span>
          {isUnread ? <span className="note-unread-dot">New</span> : null}
        </div>

        <button
          className="text-button text-button--danger"
          type="button"
          onClick={() => onDelete(note)}
          aria-label="Delete note"
        >
          <AppIcon name="trash" size={17} />
          Delete
        </button>
      </header>

      <p className="note-card__message">{note.message}</p>

      <footer className="note-card__footer">
        <span className="note-card__person">
          <span>{direction === 'received' ? `From ${personFirstName}` : `To ${personFirstName}`}</span>
          {direction === 'sent' ? (
            <small>
              {note.seen_at
                ? 'Seen'
                : isSurprise
                  ? 'Waiting for next login'
                  : 'Unread'}
            </small>
          ) : null}
        </span>
        <time dateTime={note.created_at}>{formatNoteDate(note.created_at)}</time>
      </footer>
    </article>
  );
}
