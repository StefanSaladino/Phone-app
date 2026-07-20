import { AppIcon } from '../components/ui/AppIcon';

const categories = ['All', 'Food', 'Coffee', 'Drinks', 'Dessert', 'Recreation'];

/**
 * Saved-place feature landing page with the agreed category structure.
 */
export function PlacesPage() {
  return (
    <div className="page-stack">
      <section className="page-toolbar">
        <div>
          <p className="section-heading__eyebrow">Our shortlist</p>
          <h2>Places worth remembering</h2>
        </div>
        <button className="compact-button" type="button">
          <AppIcon name="plus" size={18} />
          Add place
        </button>
      </section>

      <div className="filter-row" role="group" aria-label="Filter saved places">
        {categories.map((category, index) => (
          <button
            className={`filter-chip${index === 0 ? ' is-active' : ''}`}
            type="button"
            key={category}
          >
            {category}
          </button>
        ))}
      </div>

      <section className="empty-state">
        <span className="empty-state__mark" aria-hidden="true">
          ⌖
        </span>
        <h3>No places saved</h3>
        <p>Keep the restaurant, café, bar, dessert stop, or activity you don’t want to forget.</p>
      </section>
    </div>
  );
}
