import { useEffect, useState } from 'react';
import { AppIcon } from '../ui/AppIcon';
import type { DateIdea, DateIdeaStatus, DateIdeaValues } from '../../types/dateIdea';

interface DateIdeaFormProps {
  idea: DateIdea | null;
  submitting: boolean;
  serverError: string | null;
  onCancel: () => void;
  onSubmit: (values: DateIdeaValues) => Promise<void>;
}

const emptyValues: DateIdeaValues = {
  title: '',
  description: '',
  status: 'idea',
  plannedFor: '',
  isFavorite: false,
};

/**
 * Converts a UTC database timestamp into a local datetime input value.
 */
function toLocalDateTimeInput(value: string | null): string {
  if (!value) return '';

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);

  return localDate.toISOString().slice(0, 16);
}

/**
 * Reusable create/edit form kept separate from the route-level page state.
 */
export function DateIdeaForm({
  idea,
  submitting,
  serverError,
  onCancel,
  onSubmit,
}: DateIdeaFormProps) {
  const [values, setValues] = useState<DateIdeaValues>(emptyValues);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setValues(
      idea
        ? {
            title: idea.title,
            description: idea.description ?? '',
            status: idea.status,
            plannedFor: toLocalDateTimeInput(idea.planned_for),
            isFavorite: idea.is_favorite,
          }
        : emptyValues,
    );
    setValidationError(null);
  }, [idea]);

  const updateStatus = (status: DateIdeaStatus) => {
    setValues((current) => ({
      ...current,
      status,
      plannedFor: status === 'planned' ? current.plannedFor : '',
    }));
  };

  const submitForm = async () => {
    const title = values.title.trim();

    if (!title) {
      setValidationError('Give the idea a title first.');
      return;
    }

    if (title.length > 120) {
      setValidationError('Keep the title to 120 characters or fewer.');
      return;
    }

    if (values.status === 'planned' && !values.plannedFor) {
      setValidationError('Choose a date and time for a planned idea.');
      return;
    }

    setValidationError(null);
    await onSubmit({ ...values, title });
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="idea-form-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="idea-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="idea-form-card__header">
          <div>
            <p className="section-heading__eyebrow">
              {idea ? 'Change of plans' : 'Something to look forward to'}
            </p>
            <h2 id="idea-form-title">{idea ? 'Edit date idea' : 'Add a date idea'}</h2>
          </div>

          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close form">
            <AppIcon name="close" size={19} />
          </button>
        </header>

        <div className="form-stack">
          <label className="field-group">
            <span>Idea</span>
            <input
              autoFocus
              type="text"
              maxLength={120}
              value={values.title}
              placeholder="Late-night dessert crawl"
              onChange={(event) =>
                setValues((current) => ({ ...current, title: event.target.value }))
              }
            />
          </label>

          <label className="field-group">
            <span>Details <small>optional</small></span>
            <textarea
              rows={4}
              maxLength={1000}
              value={values.description}
              placeholder="Add anything worth remembering."
              onChange={(event) =>
                setValues((current) => ({ ...current, description: event.target.value }))
              }
            />
          </label>

          <fieldset className="field-group field-group--fieldset">
            <legend>Status</legend>
            <div className="segmented-control">
              {([
                ['idea', 'Idea'],
                ['planned', 'Planned'],
                ['done', 'Completed'],
              ] as const).map(([value, label]) => (
                <button
                  className={values.status === value ? 'is-active' : ''}
                  type="button"
                  key={value}
                  aria-pressed={values.status === value}
                  onClick={() => updateStatus(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          {values.status === 'planned' ? (
            <label className="field-group">
              <span>When?</span>
              <span className="date-input-shell">
                <input
                  type="datetime-local"
                  value={values.plannedFor}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      plannedFor: event.target.value,
                    }))
                  }
                />
              </span>
            </label>
          ) : null}

          <label className="favorite-check">
            <input
              type="checkbox"
              checked={values.isFavorite}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  isFavorite: event.target.checked,
                }))
              }
            />
            <span aria-hidden="true">♥</span>
            Mark this as a favourite
          </label>

          {validationError || serverError ? (
            <p className="form-message form-message--error" role="alert">
              {validationError ?? serverError}
            </p>
          ) : null}
        </div>

        <footer className="idea-form-card__actions">
          <button className="secondary-button" type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button className="primary-button" type="button" onClick={() => void submitForm()} disabled={submitting}>
            {submitting ? 'Saving…' : idea ? 'Save changes' : 'Add idea'}
          </button>
        </footer>
      </section>
    </div>
  );
}
