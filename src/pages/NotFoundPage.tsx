import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="standalone-page">
      <p className="section-heading__eyebrow">404</p>
      <h1>That page isn’t here.</h1>
      <Link className="primary-button primary-button--link" to="/">
        Return home
      </Link>
    </main>
  );
}
