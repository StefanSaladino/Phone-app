import { useEffect, useRef, useState } from 'react';
import { normalizeExternalUrl, normalizeGoogleMapsUrl } from '../../lib/placeLinks';
import type { Place, PlaceCategory, PlaceValues } from '../../types/place';
import { AppIcon } from '../ui/AppIcon';

interface PlaceFormProps {
  place: Place | null;
  submitting: boolean;
  serverError: string | null;
  onCancel: () => void;
  onSubmit: (values: PlaceValues) => Promise<void>;
}

const emptyValues: PlaceValues = {
  name: '',
  category: 'food',
  address: '',
  websiteUrl: '',
  mapsUrl: '',
  notes: '',
  visited: false,
  isFavorite: false,
};

const categories: Array<{ value: PlaceCategory; label: string }> = [
  { value: 'food', label: 'Food' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'recreation', label: 'Recreation' },
];

/**
 * Mobile-first place editor. The sheet header and actions stay visible while
 * only the form body scrolls, preventing the close button from moving offscreen.
 */
export function PlaceForm({
  place,
  submitting,
  serverError,
  onCancel,
  onSubmit,
}: PlaceFormProps) {
  const [values, setValues] = useState<PlaceValues>(emptyValues);
  const [validationError, setValidationError] = useState<string | null>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    setValues(
      place
        ? {
            name: place.name,
            category: place.category,
            address: place.address ?? '',
            websiteUrl: place.website_url ?? '',
            mapsUrl: place.maps_url ?? '',
            notes: place.notes ?? '',
            visited: place.visited,
            isFavorite: place.is_favorite,
          }
        : emptyValues,
    );
    setValidationError(null);
  }, [place]);

  /** Lock the page behind the sheet and support the Escape key on desktop. */
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onCancelRef.current();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [submitting]);

  const submitForm = async () => {
    const name = values.name.trim();

    if (!name) {
      setValidationError('Give the place a name first.');
      return;
    }

    if (name.length > 140) {
      setValidationError('Keep the place name to 140 characters or fewer.');
      return;
    }

    try {
      normalizeExternalUrl(values.websiteUrl);
      normalizeGoogleMapsUrl(values.mapsUrl);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Check the links and try again.');
      return;
    }

    setValidationError(null);
    await onSubmit({ ...values, name });
  };

  return (
    <div
      className="modal-backdrop place-form-backdrop"
      role="presentation"
      onPointerDown={() => {
        if (!submitting) onCancel();
      }}
    >
      <form
        className="idea-form-card place-form-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-form-title"
        aria-busy={submitting}
        onSubmit={(event) => {
          event.preventDefault();
          void submitForm();
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="idea-form-card__header">
          <div>
            <p className="section-heading__eyebrow">
              {place ? 'Update the details' : 'Save it for later'}
            </p>
            <h2 id="place-form-title">{place ? 'Edit place' : 'Add a place'}</h2>
          </div>

          <button
            className="icon-button"
            type="button"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Close place form"
          >
            <AppIcon name="close" size={19} />
          </button>
        </header>

        <div className="place-form-card__body">
          <div className="form-stack">
            <label className="field-group">
              <span>Place name</span>
              <input
                type="text"
                maxLength={140}
                value={values.name}
                placeholder="Favourite café or activity"
                onChange={(event) =>
                  setValues((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>

            <label className="field-group">
              <span>Category</span>
              <select
                value={values.category}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    category: event.target.value as PlaceCategory,
                  }))
                }
              >
                {categories.map((category) => (
                  <option value={category.value} key={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span>Address <small>optional</small></span>
              <input
                type="text"
                maxLength={300}
                value={values.address}
                placeholder="123 Example Street, Toronto"
                onChange={(event) =>
                  setValues((current) => ({ ...current, address: event.target.value }))
                }
              />
              <small>Used to create a Google Maps search when no share link is pasted.</small>
            </label>

            <label className="field-group">
              <span>Website <small>optional</small></span>
              <input
                type="url"
                inputMode="url"
                value={values.websiteUrl}
                placeholder="example.com"
                onChange={(event) =>
                  setValues((current) => ({ ...current, websiteUrl: event.target.value }))
                }
              />
            </label>

            <label className="field-group">
              <span>Google Maps link <small>optional</small></span>
              <input
                type="url"
                inputMode="url"
                value={values.mapsUrl}
                placeholder="https://maps.app.goo.gl/..."
                onChange={(event) =>
                  setValues((current) => ({ ...current, mapsUrl: event.target.value }))
                }
              />
              <small>In Google Maps, choose Share, then copy and paste the link here.</small>
            </label>

            <label className="field-group">
              <span>Notes <small>optional</small></span>
              <textarea
                rows={4}
                maxLength={1500}
                value={values.notes}
                placeholder="What should we order, when should we go, or why did this look good?"
                onChange={(event) =>
                  setValues((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </label>

            <div className="place-form-options">
              <label className="favorite-check">
                <input
                  type="checkbox"
                  checked={values.isFavorite}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, isFavorite: event.target.checked }))
                  }
                />
                <span aria-hidden="true">♥</span>
                Favourite
              </label>

              <label className="favorite-check">
                <input
                  type="checkbox"
                  checked={values.visited}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, visited: event.target.checked }))
                  }
                />
                <AppIcon name="check" size={18} />
                Already visited
              </label>
            </div>

            {validationError || serverError ? (
              <p className="form-message form-message--error" role="alert">
                {validationError ?? serverError}
              </p>
            ) : null}
          </div>
        </div>

        <footer className="idea-form-card__actions place-form-card__actions">
          <button className="secondary-button" type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : place ? 'Save changes' : 'Save place'}
          </button>
        </footer>
      </form>
    </div>
  );
}
