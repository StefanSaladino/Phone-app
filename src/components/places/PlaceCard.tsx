import { getGoogleMapsUrl } from '../../lib/placeLinks';
import type { Place, PlaceCategory } from '../../types/place';
import { AppIcon } from '../ui/AppIcon';

interface PlaceCardProps {
  place: Place;
  busy: boolean;
  onEdit: (place: Place) => void;
  onDelete: (place: Place) => void;
  onToggleFavorite: (place: Place) => void;
  onToggleVisited: (place: Place) => void;
}

const categoryLabels: Record<PlaceCategory, string> = {
  food: 'Food',
  coffee: 'Coffee',
  drinks: 'Drinks',
  dessert: 'Dessert',
  recreation: 'Recreation',
};

/**
 * Individual place card with free external links and quick shared actions.
 */
export function PlaceCard({
  place,
  busy,
  onEdit,
  onDelete,
  onToggleFavorite,
  onToggleVisited,
}: PlaceCardProps) {
  const mapsUrl = getGoogleMapsUrl(place);

  return (
    <article className={`place-card${place.visited ? ' place-card--visited' : ''}`}>
      <header className="place-card__header">
        <span className={`category-badge category-badge--${place.category}`}>
          {categoryLabels[place.category]}
        </span>

        <button
          className={`favorite-button${place.is_favorite ? ' is-active' : ''}`}
          type="button"
          disabled={busy}
          aria-label={place.is_favorite ? `Remove ${place.name} from favourites` : `Add ${place.name} to favourites`}
          aria-pressed={place.is_favorite}
          onClick={() => onToggleFavorite(place)}
        >
          <AppIcon name="heart" size={18} />
        </button>
      </header>

      <div className="place-card__body">
        <div className="place-card__title-row">
          <h3>{place.name}</h3>
          {place.visited ? <span className="visited-label">Visited</span> : null}
        </div>

        {place.address ? (
          <p className="place-card__address">
            <AppIcon name="map" size={17} />
            <span>{place.address}</span>
          </p>
        ) : null}

        {place.notes ? <p className="place-card__notes">{place.notes}</p> : null}
      </div>

      <div className="place-card__links" aria-label={`Links for ${place.name}`}>
        <a
          className="secondary-button external-action"
          href={mapsUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          <AppIcon name="map" size={17} />
          Google Maps
          <AppIcon name="external-link" size={14} />
        </a>

        {place.website_url ? (
          <a
            className="secondary-button external-action"
            href={place.website_url}
            target="_blank"
            rel="noreferrer noopener"
          >
            <AppIcon name="globe" size={17} />
            Website
            <AppIcon name="external-link" size={14} />
          </a>
        ) : null}
      </div>

      <div className="place-card__actions">
        <button className="text-button" type="button" disabled={busy} onClick={() => onToggleVisited(place)}>
          <AppIcon name={place.visited ? 'undo' : 'check'} size={17} />
          {place.visited ? 'Mark unvisited' : 'Mark visited'}
        </button>
        <button className="text-button" type="button" disabled={busy} onClick={() => onEdit(place)}>
          <AppIcon name="edit" size={17} />
          Edit
        </button>
        <button className="text-button text-button--danger" type="button" disabled={busy} onClick={() => onDelete(place)}>
          <AppIcon name="trash" size={17} />
          Delete
        </button>
      </div>
    </article>
  );
}
