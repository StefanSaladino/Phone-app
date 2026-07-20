import { Link } from 'react-router-dom';
import { AppIcon } from '../components/ui/AppIcon';

const quickActions = [
  {
    to: '/ideas',
    icon: 'ideas' as const,
    label: 'Add a date idea',
    detail: 'Save something for later.',
  },
  {
    to: '/places',
    icon: 'places' as const,
    label: 'Save a place',
    detail: 'Food, coffee, drinks, dessert, or fun.',
  },
  {
    to: '/notes',
    icon: 'notes' as const,
    label: 'Leave a note',
    detail: 'Make it appear on their next visit.',
  },
];

/**
 * Initial landing page. Live summaries will replace the placeholder counts next.
 */
export function DashboardPage() {
  return (
    <div className="page-stack">
      <section className="hero-card">
        <p className="hero-card__eyebrow">Something to look forward to</p>
        <h2>Keep the good ideas somewhere you’ll both remember.</h2>
        <p>
          A shared list for spontaneous plans, favourite spots, and small messages meant for
          one another.
        </p>
      </section>

      <section aria-labelledby="quick-actions-title">
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">Start here</p>
            <h2 id="quick-actions-title">What are you thinking?</h2>
          </div>
        </div>

        <div className="quick-action-grid">
          {quickActions.map((action) => (
            <Link className="quick-action-card" to={action.to} key={action.to}>
              <span className="quick-action-card__icon" aria-hidden="true">
                <AppIcon name={action.icon} />
              </span>
              <span>
                <strong>{action.label}</strong>
                <small>{action.detail}</small>
              </span>
              <span className="quick-action-card__arrow" aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="summary-card" aria-label="Shared list summary">
        <div>
          <strong>0</strong>
          <span>Date ideas</span>
        </div>
        <div>
          <strong>0</strong>
          <span>Saved places</span>
        </div>
        <div>
          <strong>0</strong>
          <span>Unread notes</span>
        </div>
      </section>
    </div>
  );
}
