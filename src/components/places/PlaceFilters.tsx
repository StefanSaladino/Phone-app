import {
  ALL_CITIES_FILTER,
  UNKNOWN_CITY_FILTER,
  type PlaceFilter,
} from '../../types/place';
import { AppIcon } from '../ui/AppIcon';

interface PlaceFiltersProps {
  activeFilter: PlaceFilter;
  activeCityFilter: string;
  cities: string[];
  counts: Record<PlaceFilter, number>;
  unknownCityCount: number;
  onChange: (filter: PlaceFilter) => void;
  onCityChange: (city: string) => void;
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

/** Category/status chips plus a separate location filter. */
export function PlaceFilters({
  activeFilter,
  activeCityFilter,
  cities,
  counts,
  unknownCityCount,
  onChange,
  onCityChange,
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

      <label className="place-city-filter">
        <span>
          <AppIcon name="map" size={18} />
          Location
        </span>

        <select
          aria-label="Filter saved places by city"
          value={activeCityFilter}
          onChange={(event) => onCityChange(event.target.value)}
        >
          <option value={ALL_CITIES_FILTER}>All locations</option>

          {cities.map((city) => (
            <option value={city} key={city.toLocaleLowerCase()}>
              {city}
            </option>
          ))}

          {unknownCityCount > 0 ? (
            <option value={UNKNOWN_CITY_FILTER}>
              Unknown city ({unknownCityCount})
            </option>
          ) : null}
        </select>
      </label>
    </section>
  );
}
