import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';

export function NotFoundPage() {
  usePageTitle('Page Not Found');

  return (
    <div className="page not-found">
      <h1 className="page__title not-found__title">404 — Page Not Found</h1>
      <p className="page__subtitle not-found__subtitle">
        Looks like you wandered too far from the farm.
      </p>
      <div className="not-found__art" aria-hidden="true">🐟</div>
      <p className="not-found__hint">
        The page you're looking for doesn't exist, or may have moved.
      </p>
      <Link to="/" className="btn btn--primary not-found__home">
        Back to Home
      </Link>
    </div>
  );
}
