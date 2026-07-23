import {
  ALL_LOCATIONS_FILTER,
  UNKNOWN_LOCATION_FILTER,
  type PlaceFilter,
} from '../../types/place';
import { AppIcon } from '../ui/AppIcon';

interface PlaceFiltersProps {
  activeFilter: PlaceFilter;
  activeLocationFilter: string;
  locations: string[];
  counts: Record<PlaceFilter, number>;
  unknownLocationCount: number;
  onChange: (filter: PlaceFilter) => void;
  onLocationChange: (location: string) => void;
}

const filters: Array<{ value: PlaceFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'food', label: 'Food' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'recreation', label: 'Recreation' },
  { value: 'want-to-go', label: 'Want to go' },
  { value: 'visited', label: 'Visited' },
  { value: 'favorites', label: 'Favourites' },
];

/** Category/status chips plus a separate flexible location filter. */
export function PlaceFilters({
  activeFilter,
  activeLocationFilter,
  locations,
  counts,
  unknownLocationCount,
  onChange,
  onLocationChange,
}: PlaceFiltersProps) {
  return (
    <section className="place-filter-stack" aria-label="Filter saved places">
      <div className="filter-row" aria-label="Filter saved places by type or status">
        {filters.map((filter) => (
          <button
            className={`filter-chip${activeFilter === filter.value ? ' is-active' : ''}`}
            type="button"
            key={filter.value}
            aria-pressed={activeFilter === filter.value}
            onClick={() => onChange(filter.value)}
          >
            {filter.label}
            <span className="filter-chip__count">{counts[filter.value]}</span>
          </button>
        ))}
      </div>

      <label className="place-location-filter">
        <span>
          <AppIcon name="map" size={18} />
          Location
        </span>

        <select
          aria-label="Filter saved places by location"
          value={activeLocationFilter}
          onChange={(event) => onLocationChange(event.target.value)}
        >
          <option value={ALL_LOCATIONS_FILTER}>All locations</option>

          {locations.map((location) => (
            <option value={location} key={location.toLocaleLowerCase()}>
              {location}
            </option>
          ))}

          {unknownLocationCount > 0 ? (
            <option value={UNKNOWN_LOCATION_FILTER}>
              Unknown location ({unknownLocationCount})
            </option>
          ) : null}
        </select>
      </label>
    </section>
  );
}
