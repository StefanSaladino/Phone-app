import { AppIcon } from '../components/ui/AppIcon';

/**
 * Notes feature landing page. Unseen next-login notes will later open as a modal.
 */
export function NotesPage() {
  return (
    <div className="page-stack">
      <section className="page-toolbar">
        <div>
          <p className="section-heading__eyebrow">Just because</p>
          <h2>Leave something little</h2>
        </div>
        <button className="compact-button" type="button">
          <AppIcon name="plus" size={18} />
          New note
        </button>
      </section>

      <section className="info-card">
        <span aria-hidden="true">♥</span>
        <div>
          <h3>Make it a surprise</h3>
          <p>
            A note can stay in the inbox or appear automatically the next time your partner
            opens the app.
          </p>
        </div>
      </section>

      <section className="empty-state empty-state--compact">
        <h3>No notes yet</h3>
        <p>The first one can be sweet, practical, or completely ridiculous.</p>
      </section>
    </div>
  );
}
