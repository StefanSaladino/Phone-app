import { AppIcon } from '../components/ui/AppIcon';

/**
 * Date-idea feature landing page. Data entry and Supabase queries come next.
 */
export function DateIdeasPage() {
  return (
    <div className="page-stack">
      <section className="page-toolbar">
        <div>
          <p className="section-heading__eyebrow">Shared inspiration</p>
          <h2>Things we should do</h2>
        </div>
        <button className="compact-button" type="button">
          <AppIcon name="plus" size={18} />
          Add idea
        </button>
      </section>

      <section className="empty-state">
        <span className="empty-state__mark" aria-hidden="true">
          ✦
        </span>
        <h3>No date ideas yet</h3>
        <p>Add anything from a quiet night in to a full weekend away.</p>
      </section>
    </div>
  );
}
