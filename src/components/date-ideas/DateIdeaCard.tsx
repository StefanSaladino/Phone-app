import { AppIcon } from '../ui/AppIcon';
import type { DateIdea } from '../../types/dateIdea';

interface DateIdeaCardProps {
  idea: DateIdea;
  busy: boolean;
  onEdit: (idea: DateIdea) => void;
  onDelete: (idea: DateIdea) => void;
  onToggleFavorite: (idea: DateIdea) => Promise<void>;
  onMarkComplete: (idea: DateIdea) => Promise<void>;
  onReturnToIdeas: (idea: DateIdea) => Promise<void>;
}

const statusLabels = {
  idea: 'Idea',
  planned: 'Planned',
  done: 'Completed',
} as const;

/**
 * Produces a short, human-readable planned date for the shared card.
 */
function formatPlannedDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

/**
 * One date idea with focused quick actions. Editing stays in the form component.
 */
export function DateIdeaCard({
  idea,
  busy,
  onEdit,
  onDelete,
  onToggleFavorite,
  onMarkComplete,
  onReturnToIdeas,
}: DateIdeaCardProps) {
  return (
    <article className={`date-idea-card date-idea-card--${idea.status}`}>
      <header className="date-idea-card__header">
        <span className={`status-badge status-badge--${idea.status}`}>
          {statusLabels[idea.status]}
        </span>

        <button
          className={`favorite-button${idea.is_favorite ? ' is-active' : ''}`}
          type="button"
          disabled={busy}
          aria-label={idea.is_favorite ? 'Remove from favourites' : 'Add to favourites'}
          aria-pressed={idea.is_favorite}
          onClick={() => void onToggleFavorite(idea)}
        >
          <AppIcon name="heart" size={19} />
        </button>
      </header>

      <div className="date-idea-card__body">
        <h3>{idea.title}</h3>
        {idea.description ? <p>{idea.description}</p> : null}

        {idea.status === 'planned' && idea.planned_for ? (
          <p className="date-idea-card__date">
            <AppIcon name="calendar" size={17} />
            {formatPlannedDate(idea.planned_for)}
          </p>
        ) : null}
      </div>

      <footer className="date-idea-card__actions">
        <button className="text-button" type="button" disabled={busy} onClick={() => onEdit(idea)}>
          <AppIcon name="edit" size={17} />
          Edit
        </button>

        {idea.status === 'done' ? (
          <button className="text-button" type="button" disabled={busy} onClick={() => void onReturnToIdeas(idea)}>
            <AppIcon name="undo" size={17} />
            Reopen
          </button>
        ) : (
          <button className="text-button" type="button" disabled={busy} onClick={() => void onMarkComplete(idea)}>
            <AppIcon name="check" size={17} />
            Complete
          </button>
        )}

        <button className="text-button text-button--danger" type="button" disabled={busy} onClick={() => onDelete(idea)}>
          <AppIcon name="trash" size={17} />
          Delete
        </button>
      </footer>
    </article>
  );
}
