import type { DateIdeaFilter } from '../../types/dateIdea';

interface DateIdeaFiltersProps {
  activeFilter: DateIdeaFilter;
  counts: Record<DateIdeaFilter, number>;
  onChange: (filter: DateIdeaFilter) => void;
}

const filters: Array<{ value: DateIdeaFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'idea', label: 'Ideas' },
  { value: 'planned', label: 'Planned' },
  { value: 'done', label: 'Completed' },
  { value: 'favorites', label: 'Favourites' },
];

/**
 * Horizontal mobile-friendly filter controls for the shared list.
 */
export function DateIdeaFilters({
  activeFilter,
  counts,
  onChange,
}: DateIdeaFiltersProps) {
  return (
    <div className="filter-row" aria-label="Filter date ideas">
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
