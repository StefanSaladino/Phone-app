import type { PlaceFilter } from '../../types/place';

interface PlaceFiltersProps {
  activeFilter: PlaceFilter;
  counts: Record<PlaceFilter, number>;
  onChange: (filter: PlaceFilter) => void;
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

/**
 * Horizontally scrollable place filters designed for narrow phone screens.
 */
export function PlaceFilters({ activeFilter, counts, onChange }: PlaceFiltersProps) {
  return (
    <div className="filter-row" aria-label="Filter saved places">
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
  );
}
